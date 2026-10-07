import Stripe from 'stripe';
import { recordUpsellChoice, recordDownsellChoice } from '../../lib/db.js';

/**
 * POST /api/membership/upsell-choice — note what a buyer did with the offer
 * shown straight after checkout.
 *
 * Everybody who buys is put on the three-day trial by the webhook, so a trial
 * is not a signal. What this records is the choice made with the offer in
 * front of them: kept the trial, said no thanks, or simply looked. Taking the
 * year is recorded by /api/membership/upgrade-annual instead, where the charge
 * actually succeeds, so that one cannot be claimed from the browser.
 *
 * Identified the same way as the upgrade: by the payment intent's client
 * secret, which Stripe gives to the buyer's browser and nowhere else.
 *
 * Body: { paymentIntentId, clientSecret, choice: 'seen' | 'trial' | 'declined' }
 *
 * Answers 204 either way. This is a note taken while somebody is on their way
 * to the confirmation page, and nothing they see should depend on it.
 */

/**
 * Two offers, asked in order, so which one is being answered has to be said.
 * Buying is recorded where the money moves, not from here: 'year' by
 * upgrade-annual and 'bought' by the webhook that grants the course.
 */
const OFFERS = {
  membership: { allowed: new Set(['seen', 'trial', 'declined']), record: recordUpsellChoice },
  course: { allowed: new Set(['seen', 'declined']), record: recordDownsellChoice }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const paymentIntentId = String(body.paymentIntentId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();
  const choice = String(body.choice || '').trim();
  // The membership offer came first and is what an older page would be asking
  // about, so it is what an unnamed offer means.
  const offer = OFFERS[String(body.offer || 'membership').trim()];

  if (!paymentIntentId || !clientSecret || !offer || !offer.allowed.has(choice)) {
    return res.status(204).end();
  }

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(204).end();
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    // A mismatch is somebody guessing at an id, and a note is not worth saying
    // so about. Logged, ignored, no different answer.
    if (!pi || pi.client_secret !== clientSecret || pi.status !== 'succeeded') {
      console.warn('[upsell-choice] unverified', paymentIntentId);
      return res.status(204).end();
    }

    const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
    const email = customerId
      ? (await stripe.customers.retrieve(customerId).catch(() => null))?.email
      : null;
    if (!email) return res.status(204).end();

    await offer.record(email, choice);
    console.log('[upsell-choice]', email, String(body.offer || 'membership'), choice);
    return res.status(204).end();
  } catch (err) {
    // Never the buyer's problem: they are mid-way to their confirmation page.
    console.error('[upsell-choice]', err);
    return res.status(204).end();
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
