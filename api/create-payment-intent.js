import Stripe from 'stripe';

/**
 * Creates the PaymentIntent the checkout page confirms against, and hands the
 * browser the client secret plus the publishable key.
 *
 * The amount is read from server-side env only. It is deliberately NOT accepted
 * from the request body — otherwise anyone could post their own price and pay a
 * cent for the product.
 */

const PRICE_AMOUNT = Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10); // 100 = $1.00
const PRICE_CURRENCY = (process.env.PRICE_CURRENCY ?? 'usd').toLowerCase();
const PRODUCT_NAME = '70 AI Specialists + Business Growth System for Claude';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    console.error('[create-payment-intent] Stripe keys are not configured.');
    return res.status(500).json({
      error: 'Payments are not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.'
    });
  }

  if (!Number.isInteger(PRICE_AMOUNT) || PRICE_AMOUNT < 1) {
    console.error('[create-payment-intent] PRICE_AMOUNT is invalid:', process.env.PRICE_AMOUNT);
    return res.status(500).json({ error: 'Price is misconfigured.' });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

    // The email labels the payment in the dashboard and is what the webhook
    // grants access to. It is never trusted for anything that affects the
    // amount.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = typeof body.email === 'string' ? body.email.slice(0, 320) : undefined;

    const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || '';
    const clientUa = req.headers['user-agent'] || '';

    // When the membership subscription is configured, the $1 purchase also has
    // to save the card so the subscription can charge it after the trial. That
    // needs a Customer on the PaymentIntent and setup_future_usage — without a
    // customer Stripe will not retain the payment method. The email is not
    // known yet (the form posts it on confirm), so the customer starts empty
    // and the webhook fills in name/email once the payment lands.
    const wantsSubscription = !!process.env.STRIPE_MONTHLY_PRICE_ID;
    let customerId;
    if (wantsSubscription) {
      const customer = await stripe.customers.create({
        metadata: { source: '70-ai-specialists-for-claude' }
      });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICE_AMOUNT,
      currency: PRICE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      description: PRODUCT_NAME,
      // Deliberately NO receipt_email. Setting it makes Stripe send its own
      // receipt, and we send ours instead — one branded email that also states
      // the membership terms, which Stripe's receipt does not.
      ...(customerId ? { customer: customerId, setup_future_usage: 'off_session' } : {}),
      metadata: {
        product: PRODUCT_NAME,
        source: '70-ai-specialists-for-claude',
        // The address used to reach the webhook via receipt_email. With that
        // gone it travels here instead, so granting access never depends on a
        // second API call to fetch the charge succeeding.
        ...(email ? { buyer_email: email } : {}),
        // Carried so the webhook can attribute the Purchase to the ad click
        // that started it. The webhook is the only place that knows the
        // payment succeeded, and by then the browser is long gone.
        ...(typeof body.fbclid === 'string' && body.fbclid ? { fbclid: body.fbclid.slice(0, 300) } : {}),
        ...(Number(body.fbclidAt) > 0 ? { fbclid_at: String(Math.round(Number(body.fbclidAt))) } : {}),
        ...(typeof body.fbp === 'string' && body.fbp ? { fbp: body.fbp.slice(0, 100) } : {}),
        // The buyer's IP and browser, kept for the same reason: Meta matches a
        // conversion far better with them, and the webhook only ever sees
        // Stripe's own IP, never the buyer's.
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
    console.error('[create-payment-intent]', err);
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
}
