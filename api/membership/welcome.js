import Stripe from 'stripe';
import { sendWelcomeFor } from '../../lib/welcome.js';

/**
 * POST /api/membership/welcome — the buyer has reached their confirmation page,
 * so every choice they were going to make has been made. Send the welcome now.
 *
 * The webhook queued it when the payment cleared rather than sending it, because
 * at that point nobody had seen the membership offer yet. This is the other end
 * of that: whatever they took or turned down is on their record by the time they
 * land here, however long they took over it. The cron's sweep exists only for
 * the people who never arrive.
 *
 * Identified by the payment intent's client secret, like the two offers before
 * it. Answers 204 whatever happens — the buyer is looking at their order, and
 * nothing on that page should depend on an email.
 *
 * Body: { paymentIntentId, clientSecret }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const paymentIntentId = String(body.paymentIntentId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();
  if (!paymentIntentId || !clientSecret) return res.status(204).end();

  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return res.status(204).end();
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    if (!pi || pi.client_secret !== clientSecret || pi.status !== 'succeeded') {
      console.warn('[welcome] unverified', paymentIntentId);
      return res.status(204).end();
    }

    const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
    const email = customerId
      ? (await stripe.customers.retrieve(customerId).catch(() => null))?.email
      : null;
    if (!email) return res.status(204).end();

    const out = await sendWelcomeFor(email, { reason: 'confirmation page' });
    if (!out.sent) console.log('[welcome] not sent to', email, '-', out.why);
    return res.status(204).end();
  } catch (err) {
    // The sweep will pick it up: sendWelcomeFor hands a failed send back.
    console.error('[welcome]', err);
    return res.status(204).end();
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
