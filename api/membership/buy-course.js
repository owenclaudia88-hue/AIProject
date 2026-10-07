import Stripe from 'stripe';
import { COURSES } from '../../lib/products.js';

/**
 * POST /api/membership/buy-course — the course offered to somebody who has just
 * turned down the membership.
 *
 * $37 once on the card they paid the $1 with. Not a subscription and not part
 * of the membership: it grants the course's own entitlement, which is what the
 * member area has always gated it on, so it stays theirs whatever happens to
 * any subscription afterwards.
 *
 * Identified by the payment intent's client secret, the same way the membership
 * offer is: Stripe gives that to the buyer's browser and nowhere else.
 *
 * The entitlement is granted by the webhook on payment_intent.succeeded rather
 * than here, so the hosted-checkout fallback below ends in the same place as the
 * one-click charge. This endpoint only decides whether money moves.
 *
 * Body: { paymentIntentId, clientSecret, course }
 * Returns { ok, paymentIntent } | { already } | { url } | { error }
 */

const PRICE = { 'business-builder': { amount: 3700, currency: 'usd' } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Payments are not configured yet.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const paymentIntentId = String(body.paymentIntentId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();
  const course = String(body.course || '').trim();

  const priced = PRICE[course];
  const known = COURSES[course];
  if (!priced || !known) return res.status(400).json({ error: 'Unknown course.' });
  if (!paymentIntentId || !clientSecret) return res.status(400).json({ error: 'Missing the order reference.' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    if (!pi) return res.status(404).json({ error: 'That order could not be found.' });
    if (pi.client_secret !== clientSecret) {
      console.error('[buy-course] client secret mismatch for', paymentIntentId);
      return res.status(403).json({ error: 'That order could not be verified.' });
    }
    if (pi.status !== 'succeeded') return res.status(409).json({ error: 'That order has not completed yet.' });

    const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
    if (!customerId) return res.status(409).json({ error: 'That order has no customer on it.' });

    // Bought already — a second click, or a reload. The charge is keyed on the
    // original payment intent, so Stripe would refuse a duplicate anyway; this
    // answers plainly instead of letting it look like a failure.
    const earlier = await stripe.paymentIntents
      .list({ customer: customerId, limit: 20 })
      .then((r) => r.data.find((p) => p.metadata?.course === course
        && ['succeeded', 'processing'].includes(p.status)))
      .catch(() => null);
    if (earlier) return res.status(200).json({ already: true, paymentIntent: earlier.id });

    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    const paymentMethod = typeof pi.payment_method === 'string'
      ? pi.payment_method : pi.payment_method?.id;

    let charged = null;
    if (paymentMethod) {
      try {
        charged = await stripe.paymentIntents.create({
          amount: priced.amount, currency: priced.currency,
          customer: customerId, payment_method: paymentMethod,
          // Nobody is at a card form: they clicked a button on a page that
          // promised no card entry. A decline or a demand for the bank's say-so
          // both land in the catch, and are answered with a checkout link.
          off_session: true, confirm: true,
          description: known.name,
          metadata: { course, source: 'post-membership-downsell', payment_intent: pi.id }
        }, { idempotencyKey: `course_${course}_${pi.id}` });
      } catch (err) {
        console.log('[buy-course] off-session charge not possible for', customerId, '-', err.message);
      }
    }

    if (!charged || charged.status !== 'succeeded') {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: priced.currency,
            unit_amount: priced.amount,
            product_data: { name: known.name }
          }
        }],
        payment_intent_data: {
          metadata: { course, source: 'post-membership-downsell', payment_intent: pi.id }
        },
        success_url: `${site}/lifetime-access/success.html?course=${encodeURIComponent(course)}&payment_intent=${encodeURIComponent(pi.id)}`,
        cancel_url: `${site}/lifetime-access/success.html?payment_intent=${encodeURIComponent(pi.id)}`,
        metadata: { course, payment_intent: pi.id }
      });
      return res.status(200).json({ url: session.url });
    }

    return res.status(200).json({ ok: true, paymentIntent: charged.id });
  } catch (err) {
    console.error('[buy-course]', err);
    return res.status(500).json({ error: 'Could not take that payment. Please try again.' });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
