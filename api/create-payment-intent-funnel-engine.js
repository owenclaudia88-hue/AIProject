import Stripe from 'stripe';
import { FUNNEL_ENGINE_SOURCE, FUNNEL_ENGINE_NAME, funnelEnginePrice } from '../lib/products.js';
import { readDealToken, dealPrice, DEAL_PERCENT } from '../lib/roadmap-deal.js';

/**
 * PaymentIntent for The Funnel Engine ($100), before any bump is ticked.
 *
 * Its own endpoint for the same reason the Automation Engine has one: its own
 * price and its own metadata source, which the webhook branches on to grant the
 * engine and whichever bumps were bought. Ticking a bump reprices this intent
 * through /api/update-payment-intent, which reads the Funnel Engine's own bump
 * list for an intent from this source.
 *
 * No membership trial rides on this purchase, so no card is saved for later
 * (no setup_future_usage). A Customer is still created, so the sale has one to
 * hang the receipt, the refunds and the admin view on - the email is not known
 * yet, and the webhook fills it in.
 *
 * The amount is read from server-side env only, never from the request body.
 */

const PRICE_CURRENCY = (process.env.PRICE_CURRENCY ?? 'usd').toLowerCase();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) {
    console.error('[create-payment-intent-funnel-engine] Stripe keys are not configured.');
    return res.status(500).json({ error: 'Payments are not configured yet.' });
  }

  const full = funnelEnginePrice();
  if (!Number.isInteger(full) || full < 50) {
    console.error('[create-payment-intent-funnel-engine] FUNNEL_ENGINE_PRICE_AMOUNT is invalid:', process.env.FUNNEL_ENGINE_PRICE_AMOUNT);
    return res.status(500).json({ error: 'Price is misconfigured.' });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = typeof body.email === 'string' ? body.email.slice(0, 320) : undefined;
    // The roadmap members' price, from the link in their roadmap message. Checked
    // here, once; its deadline then rides on the intent (deal_ends), so a repricing
    // after it has passed goes back to the full price.
    const deal = readDealToken(body.deal);
    const amount = deal ? dealPrice() : full;
    const landingUrl = typeof body.landingUrl === 'string' ? body.landingUrl.slice(0, 500) : '';

    const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || '';
    const clientUa = req.headers['user-agent'] || '';

    const customer = await stripe.customers.create({ metadata: { source: FUNNEL_ENGINE_SOURCE } });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: PRICE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      description: FUNNEL_ENGINE_NAME,
      customer: customer.id,
      // No receipt_email: the webhook sends our own receipt.
      metadata: {
        product: FUNNEL_ENGINE_NAME,
        source: FUNNEL_ENGINE_SOURCE,
        ...(deal ? { deal: `roadmap-${DEAL_PERCENT}`, deal_ends: new Date(deal.endsAt).toISOString(), deal_email: deal.email } : {}),
        ...(landingUrl ? { landing_url: landingUrl } : {}),
        ...(email ? { buyer_email: email } : {}),
        ...(typeof body.fbclid === 'string' && body.fbclid ? { fbclid: body.fbclid.slice(0, 300) } : {}),
        ...(Number(body.fbclidAt) > 0 ? { fbclid_at: String(Math.round(Number(body.fbclidAt))) } : {}),
        ...(typeof body.fbp === 'string' && body.fbp ? { fbp: body.fbp.slice(0, 100) } : {}),
        ...(typeof body.msclkid === 'string' && body.msclkid ? { msclkid: body.msclkid.slice(0, 100) } : {}),
        ...(typeof body.vid === 'string' && /^[0-9a-f]{32}$/i.test(body.vid) ? { vid: body.vid } : {}),
        ...(typeof body.reminder === 'string' && body.reminder ? { reminder: body.reminder.slice(0, 60) } : {}),
        ...(clientIp ? { client_ip: clientIp } : {}),
        ...(clientUa ? { client_ua: clientUa.slice(0, 480) } : {})
      }
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      publishableKey,
      amount,
      currency: PRICE_CURRENCY,
      // What the page shows: the price and when it runs out, or nothing.
      deal: deal ? { endsAt: deal.endsAt, base: amount, full } : null
    });
  } catch (err) {
    console.error('[create-payment-intent-funnel-engine]', err);
    return res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
}
