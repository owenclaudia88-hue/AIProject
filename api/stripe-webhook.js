import Stripe from 'stripe';

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

        // TODO: fulfil the order here.
        //   - send the product email (download link / plugin ZIP / course access)
        //   - create the customer record or membership
        //   - add them to your email list
        //
        // Stripe retries on a non-2xx, so make this idempotent: check whether
        // pi.id has already been fulfilled before doing the work again.
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.warn('[stripe-webhook] Payment failed:', pi.id, pi.last_payment_error?.message);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('[stripe-webhook] Refunded:', charge.id);
        // TODO: revoke access, matching the 14-day guarantee in terms.html#refunds.
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
