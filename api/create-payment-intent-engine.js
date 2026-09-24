import Stripe from 'stripe';

/**
 * PaymentIntent for the Claude Automation Engine ($4.99).
 *
 * A separate endpoint from create-payment-intent.js because the product has its
 * own price and its own metadata source — the webhook branches on that source
 * to decide which entitlement to grant. Everything else mirrors the 70 AI
 * Specialists flow: the $4.99 also opens the membership on a trial, so the card
 * has to be saved against a Customer here (setup_future_usage), or the
 * subscription has nothing to charge when the trial ends.
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

    // Same as the Specialists checkout: the purchase also opens the membership
    // on a trial, and Stripe will not retain a payment method without a
    // Customer on the intent. The email is not known yet — the form posts it on
    // confirm — so the customer starts empty and the webhook fills it in.
    const wantsSubscription = !!process.env.STRIPE_MONTHLY_PRICE_ID;
    let customerId;
    if (wantsSubscription) {
      const customer = await stripe.customers.create({ metadata: { source: SOURCE } });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICE_AMOUNT,
      currency: PRICE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      description: PRODUCT_NAME,
      // No receipt_email: we send our own branded email from the webhook.
      ...(customerId ? { customer: customerId, setup_future_usage: 'off_session' } : {}),
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
