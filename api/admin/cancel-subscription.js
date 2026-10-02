import Stripe from 'stripe';
import { sessionEmail } from '../../lib/session.js';
import { revokeEntitlement } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { ALL_ACCESS } from '../../lib/products.js';

/**
 * POST /api/admin/cancel-subscription  { email, immediate? }
 *
 * Ends the monthly membership. It does not touch the account and it does not
 * touch anything the member bought: the plugin packs and the courses that teach
 * them carry no gate at all, and routines, Carousel Studio and any paid course
 * are their own entitlements, written when they paid for them. Only ALL_ACCESS
 * is taken back, and that is the one that was lent.
 *
 * By default the subscription runs to the end of the period they have paid for,
 * because taking away a month somebody has already bought is a refund question
 * rather than a cancellation. `immediate: true` ends it now, and only then is
 * access removed here — otherwise the webhook does it when the period ends.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const staff = await sessionEmail(req);
  if (!staff) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(staff)) return res.status(403).json({ error: 'not an admin' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe is not configured.' });

  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = String(b.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Which member?' });
    const immediate = b.immediate === true;

    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    // One person can own several Stripe customers — every checkout made a new
    // one — so every live subscription under this address has to be found, not
    // just the first.
    const customers = await stripe.customers.list({ email, limit: 100 });
    const live = [];
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 100 });
      for (const s of subs.data) {
        if (['active', 'trialing', 'past_due', 'unpaid'].includes(s.status)) live.push(s);
      }
    }

    if (!live.length) {
      return res.status(404).json({ error: 'No live subscription for that member.' });
    }

    const done = [];
    for (const s of live) {
      const updated = immediate
        ? await stripe.subscriptions.cancel(s.id)
        : await stripe.subscriptions.update(s.id, { cancel_at_period_end: true });
      done.push({
        id: updated.id,
        status: updated.status,
        endsAt: updated.cancel_at || updated.current_period_end || null
      });
    }

    // Ended now means closed now. Ended at the period's end means the webhook
    // closes it when that arrives, so nothing is taken away early.
    if (immediate) {
      await revokeEntitlement(email, ALL_ACCESS);
      console.log('[admin/cancel-subscription]', staff, 'ended', email, 'immediately');
    } else {
      console.log('[admin/cancel-subscription]', staff, 'set', email, 'to end at the period end');
    }

    return res.status(200).json({
      ok: true,
      immediate,
      cancelled: done,
      // Said back plainly, because this is the part that must not go wrong.
      kept: immediate
        ? 'Their purchases are untouched: the plugin packs, the specialist courses, and any upsell they bought.'
        : 'Nothing changes until the period ends. Their purchases are never affected.'
    });
  } catch (err) {
    console.error('[admin/cancel-subscription]', err);
    return res.status(500).json({ error: 'Could not cancel that subscription.' });
  }
}
