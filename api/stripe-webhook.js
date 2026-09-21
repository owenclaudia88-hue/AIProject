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
        // Checkout asks for a full name and sends it as billing_details.name.
        // Where it lands depends on how the PaymentIntent came back: older
        // shapes carry an expanded `charges` list, newer ones only
        // `latest_charge`, so take whichever is actually here.
        const charge = pi.charges?.data?.[0]
          || (pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null);
        const name = charge?.billing_details?.name || pi.shipping?.name || undefined;

        const created = await grantAccess(email, {
          paymentIntent: pi.id,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : undefined,
          name
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

        // The same $1 purchase also enrols the buyer in the monthly membership
        // with a free trial. The card was saved against pi.customer at
        // checkout (setup_future_usage), so the subscription can charge it once
        // the trial ends. Guarded so a site without the price configured keeps
        // its old one-off behaviour, and keyed on the PaymentIntent so a
        // webhook retry can never create a second subscription.
        const monthlyPrice = process.env.STRIPE_MONTHLY_PRICE_ID;
        const customerId = typeof pi.customer === 'string' ? pi.customer : null;
        const paymentMethod = typeof pi.payment_method === 'string' ? pi.payment_method : null;
        if (monthlyPrice && customerId && paymentMethod) {
          try {
            // Put the buyer's details on the customer and make the saved card
            // its default, so the trial-end invoice charges the right method.
            await stripe.customers.update(customerId, {
              email,
              ...(name ? { name } : {}),
              invoice_settings: { default_payment_method: paymentMethod }
            });

            const trialDays = Math.max(0, Number.parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS ?? '7', 10) || 0);
            await stripe.subscriptions.create({
              customer: customerId,
              items: [{ price: monthlyPrice }],
              trial_period_days: trialDays,
              default_payment_method: paymentMethod,
              // If the card is declined when the trial ends, cancel rather than
              // leave the subscription dangling past due.
              trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
              metadata: { source: '70-ai-specialists-for-claude', payment_intent: pi.id }
            }, { idempotencyKey: `sub_${pi.id}` });

            console.log('[stripe-webhook] Membership subscription started for', email);
          } catch (subErr) {
            // Access and fulfilment already succeeded, so don't fail the whole
            // webhook — but make the miss loud, since a buyer who was meant to
            // be enrolled was not.
            console.error('[stripe-webhook] Subscription enrol failed for', email, subErr.message);
          }
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
