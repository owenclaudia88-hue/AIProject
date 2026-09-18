import Stripe from 'stripe';
import { grantAccess, revokeAccess, createLoginToken } from '../lib/db.js';
import { sendPurchaseConfirmation } from '../lib/email.js';

/**
 * Stripe webhook receiver.
 *
 * Fulfilment belongs HERE, not on the success page. A browser redirect can be
 * closed, blocked or replayed, so it is not proof of payment — this webhook is.
 *
 * Signature verification needs the raw request body, so Vercel's body parser is
 * turned off below and the stream is read manually. If you re-enable parsing,
 * verification will fail with "No signatures found matching the expected signature".
 */

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing.');
    return res.status(500).send('Webhook is not configured.');
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Unverified payloads are rejected outright — never act on them.
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('[stripe-webhook] Payment succeeded:', pi.id, pi.amount, pi.currency);

        const email = pi.receipt_email || pi.charges?.data?.[0]?.billing_details?.email;
        if (!email) {
          console.warn('[stripe-webhook] No email on PaymentIntent', pi.id, '- cannot grant access');
          break;
        }

        // Grant access. grantAccess is an idempotent upsert, so Stripe retries
        // are safe. It also tells us whether this row was new, so the welcome
        // email is only sent on the first successful payment for this buyer.
        const created = await grantAccess(email, {
          paymentIntent: pi.id,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : undefined
        });
        console.log('[stripe-webhook] Access granted:', email);

        // Fulfilment IS the member area: email a one-time link that signs them in.
        try {
          const token = await createLoginToken(email);
          const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
          const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;
          if (created) await sendPurchaseConfirmation(email, loginUrl);
        } catch (mailErr) {
          // Don't fail the webhook over email — access is already granted and
          // they can request a fresh link from the login page.
          console.error('[stripe-webhook] Welcome email failed:', mailErr.message);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.warn('[stripe-webhook] Payment failed:', pi.id, pi.last_payment_error?.message);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const email = charge.billing_details?.email || charge.receipt_email;
        console.log('[stripe-webhook] Refunded:', charge.id, email || '(no email)');
        // Revoke access, matching the 14-day guarantee in terms.html#refunds.
        if (email) { await revokeAccess(email); console.log('[stripe-webhook] Access revoked:', email); }
        break;
      }

      default:
        // Unhandled types are fine — acknowledge so Stripe stops retrying.
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want if fulfilment broke.
    console.error('[stripe-webhook] Handler error:', err);
    return res.status(500).send('Webhook handler failed.');
  }
}
