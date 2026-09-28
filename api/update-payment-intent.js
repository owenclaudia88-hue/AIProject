import Stripe from 'stripe';
import { ADDONS, ADDON_SOURCES, parseAddons } from '../lib/products.js';

/**
 * POST /api/update-payment-intent  { clientSecret, addons: ['engine','carousel'], email? }
 *
 * The lifetime-access checkout creates its $1 PaymentIntent on load, before
 * anyone has looked at the add-on boxes. Ticking one changes what the order
 * costs, so the intent's amount is rewritten here and the page asks Stripe for
 * the new total (elements.fetchUpdates) before it lets anybody pay.
 *
 * What the browser can do is narrow on purpose:
 *   - it proves it owns the intent with the client secret, which only the page
 *     that created it was ever given;
 *   - it names add-ons by key; the prices come from lib/products.js and env,
 *     never from the request;
 *   - only intents from a funnel that offers add-ons, and only ones not yet
 *     paid, can be changed — so the Engine checkout and a finished payment are
 *     out of reach.
 *
 * It also refreshes buyer_email, because the address can be edited on the
 * checkout after the intent was created, and the webhook grants access to
 * whatever address is on the metadata.
 */

const BASE_AMOUNT = Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10);
const BASE_NAME = '70 AI Specialists + Business Growth System for Claude';
const EDITABLE = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payments are not configured.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret : '';
    const id = clientSecret.split('_secret_')[0];
    if (!/^pi_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Bad request.' });

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
    const pi = await stripe.paymentIntents.retrieve(id);

    // Same answer for "not yours" and "does not exist", so the endpoint cannot
    // be used to probe for intents.
    if (pi.client_secret !== clientSecret) return res.status(404).json({ error: 'Not found.' });
    if (!ADDON_SOURCES.has(pi.metadata?.source)) return res.status(409).json({ error: 'Add-ons are not available for this order.' });
    if (!EDITABLE.has(pi.status)) return res.status(409).json({ error: 'This order can no longer be changed.' });

    const addons = parseAddons(body.addons);
    const amount = BASE_AMOUNT + addons.reduce((sum, k) => sum + ADDONS[k].priceAmount(), 0);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : '';

    const updated = await stripe.paymentIntents.update(id, {
      amount,
      description: [BASE_NAME, ...addons.map((k) => ADDONS[k].short)].join(' + '),
      metadata: {
        // Empty string deletes the key in Stripe, so unticking everything
        // leaves no stale add-on behind for the webhook to grant.
        addons: addons.join(','),
        ...(EMAIL_RE.test(email) ? { buyer_email: email } : {})
      }
    });

    return res.status(200).json({ amount: updated.amount, currency: updated.currency, addons });
  } catch (err) {
    console.error('[update-payment-intent]', err.message);
    return res.status(500).json({ error: 'Could not update your order. Please try again.' });
  }
}
