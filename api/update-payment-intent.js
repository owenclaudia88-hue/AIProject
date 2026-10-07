import Stripe from 'stripe';
import { ADDONS, ADDON_SOURCES, parseAddons } from '../lib/products.js';
import { BONUS_ADDONS, bonusActive } from '../lib/bonus.js';

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
    // A bonus order (24-hour offer from the first reminder) already has both
    // add-ons free and stays at the base price: the page can only refresh
    // the email on it, never change what is included or what it costs.
    //
    // Unless the deadline has passed. The token was checked when the intent was
    // created; this re-checks the clock, so an order left sitting open goes back
    // to the ordinary prices rather than staying free for as long as the tab is.
    const hadBonus = pi.metadata?.bonus === '1';
    const isBonus = hadBonus && bonusActive(pi.metadata?.bonus_expires);
    const bonusEnded = hadBonus && !isBonus;
    const addons = isBonus ? BONUS_ADDONS.slice() : parseAddons(body.addons);

    // Refuse add-ons this order cannot have — but only when some are actually
    // being asked for.
    //
    // The checkout calls this on every change of the email field with an empty
    // list, purely to record the address, and refusing that refused the order
    // itself: the submit handler will not confirm a payment whose last update
    // failed. So anybody whose visit began somewhere other than the lifetime
    // lander — the home page, a link, anywhere — could not pay at all, and the
    // message they were shown talked about add-ons they had never chosen.
    if (addons.length && !isBonus && !ADDON_SOURCES.has(pi.metadata?.source)) {
      return res.status(409).json({ error: 'Add-ons are not available for this order.' });
    }
    if (!EDITABLE.has(pi.status)) return res.status(409).json({ error: 'This order can no longer be changed.' });
    const amount = isBonus
      ? BASE_AMOUNT
      : BASE_AMOUNT + addons.reduce((sum, k) => sum + ADDONS[k].priceAmount(), 0);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : '';

    const updated = await stripe.paymentIntents.update(id, {
      amount,
      description: [BASE_NAME, ...addons.map((k) => ADDONS[k].short + (isBonus ? ' (free bonus)' : ''))].join(' + '),
      metadata: {
        // Empty string deletes the key in Stripe, so unticking everything
        // leaves no stale add-on behind for the webhook to grant.
        addons: addons.join(','),
        // Same trick for an expired bonus: clear the marks so the webhook
        // cannot grant a free upsell against an order that is no longer one.
        ...(bonusEnded ? { bonus: '', bonus_expires: '' } : {}),
        ...(EMAIL_RE.test(email) ? { buyer_email: email } : {})
      }
    });

    return res.status(200).json({
      amount: updated.amount, currency: updated.currency, addons,
      // The page reverts on its own clock; this is the server saying the same
      // thing, for a tab that was asleep when the deadline passed.
      bonusEnded
    });
  } catch (err) {
    console.error('[update-payment-intent]', err.message);
    return res.status(500).json({ error: 'Could not update your order. Please try again.' });
  }
}
