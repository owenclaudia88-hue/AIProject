import Stripe from 'stripe';
import { sessionEmail } from '../../lib/session.js';
import { grantEntitlement, listEntitlementHolders } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { ALL_ACCESS } from '../../lib/products.js';

/**
 * GET  /api/admin/open-courses   who would be opened up, and who already is
 * POST /api/admin/open-courses   do it
 *
 * The webhook grants all-access when an invoice is paid, so this is only ever
 * the catch-up for people who subscribed before that existed: they have no new
 * invoice to trigger it and would otherwise wait until their renewal.
 *
 * It lives here rather than only as a script because running the script needs
 * the live Stripe key in a terminal, and this runs where that key already is.
 * Nothing is granted on the GET, so the list can be checked before anything
 * changes.
 */

// A subscription live in any of these senses entitles the member to the
// courses. past_due is deliberate: a card that failed this morning has not
// stopped being a membership, and Stripe is still retrying it.
const LIVE = new Set(['active', 'trialing', 'past_due']);

async function subscribers(stripe) {
  const found = new Map();
  for await (const sub of stripe.subscriptions.list({
    status: 'all', limit: 100, expand: ['data.customer']
  })) {
    if (!LIVE.has(sub.status)) continue;
    const email = typeof sub.customer === 'object' ? sub.customer?.email : null;
    if (!email) continue;
    const at = String(email).trim().toLowerCase();
    if (!found.has(at)) found.set(at, sub.status);
  }
  return found;
}

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe is not configured.' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const live = key.startsWith('sk_live_') || key.startsWith('rk_live_');

    const subs = await subscribers(stripe);
    const held = new Set((await listEntitlementHolders(ALL_ACCESS)).map((e) => e.toLowerCase()));

    const toGrant = [...subs.keys()].filter((e) => !held.has(e));
    const already = [...subs.keys()].filter((e) => held.has(e));
    // Holding it without a live subscription. Listed but never touched here:
    // they may have been granted it for another reason, and taking it away is
    // the webhook's job when a subscription actually ends.
    const extra = [...held].filter((e) => !subs.has(e));

    if (req.method === 'GET') {
      return res.status(200).json({
        mode: live ? 'live' : 'test',
        subscribers: subs.size,
        already: already.length,
        toGrant: toGrant.map((e) => ({ email: e, status: subs.get(e) })),
        extra
      });
    }

    if (req.method === 'POST') {
      for (const e of toGrant) await grantEntitlement(e, ALL_ACCESS);
      console.log('[admin/open-courses]', email, 'opened the courses to', toGrant.length, 'member(s)');
      return res.status(200).json({
        ok: true, granted: toGrant.length, already: already.length, mode: live ? 'live' : 'test'
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[admin/open-courses]', err);
    return res.status(500).json({ error: 'Could not reach Stripe.' });
  }
}
