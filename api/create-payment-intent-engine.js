import Stripe from 'stripe';

/**
 * PaymentIntent for the Claude Automation Engine ($4.99, one-off).
 *
 * A separate endpoint from create-payment-intent.js on purpose: this product
 * has its own price and, unlike the 70 AI Specialists purchase, is NOT tied to
 * the membership subscription — so it never creates a Customer or sets
 * setup_future_usage, and a card is not saved for later billing.
 *
 * The amount is read from server-side env only. It is deliberately NOT accepted
 * from the request body — otherwise anyone could post their own price.
 */

const PRICE_AMOUNT = Number.parseInt(process.env.ENGINE_PRICE_AMOUNT ?? '499', 10); // 499 = $4.99
const PRICE_CURRENCY = (process.env.ENGINE_PRICE_CURRENCY ?? process.env.PRICE_CURRENCY ?? 'usd').toLowerCase();
const PRODUCT_NAME = 'Claude Automation Engine — 59 Routines';
const SOURCE = 'claude-automation-engine';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    console.error('[create-payment-intent-engine] Stripe keys are not configured.');
    return res.status(500).json({
      error: 'Payments are not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.'
    });
  }

  if (!Number.isInteger(PRICE_AMOUNT) || PRICE_AMOUNT < 1) {
    console.error('[create-payment-intent-engine] ENGINE_PRICE_AMOUNT is invalid:', process.env.ENGINE_PRICE_AMOUNT);
    return res.status(500).json({ error: 'Price is misconfigured.' });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = typeof body.email === 'string' ? body.email.slice(0, 320) : undefined;

    const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || '';
    const clientUa = req.headers['user-agent'] || '';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICE_AMOUNT,
      currency: PRICE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      description: PRODUCT_NAME,
      // No customer / setup_future_usage: this is a one-off, not a membership.
      // No receipt_email: we send our own branded email from the webhook.
      metadata: {
        product: PRODUCT_NAME,
        // The webhook branches on this to fulfil the Engine (deliver the
        // routines) instead of the 70 AI Specialists membership.
        source: SOURCE,
        ...(email ? { buyer_email: email } : {}),
        ...(typeof body.fbclid === 'string' && body.fbclid ? { fbclid: body.fbclid.slice(0, 300) } : {}),
        ...(Number(body.fbclidAt) > 0 ? { fbclid_at: String(Math.round(Number(body.fbclidAt))) } : {}),
        ...(typeof body.fbp === 'string' && body.fbp ? { fbp: body.fbp.slice(0, 100) } : {}),
        ...(clientIp ? { client_ip: clientIp } : {}),
        ...(clientUa ? { client_ua: clientUa.slice(0, 480) } : {})
      }
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      publishableKey,
      amount: PRICE_AMOUNT,
      currency: PRICE_CURRENCY
    });
  } catch (err) {
    console.error('[create-payment-intent-engine]', err);
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
}
