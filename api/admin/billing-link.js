import { sessionEmail } from '../../lib/session.js';
import { getCustomer, normalizeEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { billingUrl } from '../../lib/billing-token.js';

/**
 * A card-update link for one member, by hand.
 *
 *   GET /api/admin/billing-link?email=…   →  { url, expires }
 *
 * The same link the payment reminders carry, made on demand. Two uses, and the
 * second is the reason it exists at all:
 *
 *   - Support can send somebody a way to fix their card without waiting for
 *     the next failed attempt to generate one.
 *   - It is the only way to see the live billing portal open before a real
 *     member's card fails. The account page's own button needs a live
 *     subscription to render, which the one account we can safely sign into
 *     does not have; this needs nothing but a Stripe customer id, exactly like
 *     the emails.
 *
 * It mints rather than sends. Nothing leaves the building from here — the admin
 * decides what to do with the link, which is the right shape for something that
 * carries a credential for a fortnight.
 */
export default async function handler(req, res) {
  const actor = await sessionEmail(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const email = normalizeEmail(url.searchParams.get('email') || '');
    if (!email) return res.status(400).json({ error: 'missing email' });

    const customer = await getCustomer(email);
    if (!customer) return res.status(404).json({ error: 'no such member' });
    if (!customer.stripe_customer_id) {
      // Nothing to open. Said plainly rather than handing back a link that
      // dead-ends on Stripe's side.
      return res.status(409).json({
        error: 'This member has no Stripe customer, so there is no billing to open.'
      });
    }

    const link = billingUrl(email, 'portal');
    console.log(`[admin] ${actor} made a billing link for ${email}`);

    return res.status(200).json({
      url: link,
      email,
      expires: new Date(Date.now() + 14 * 864e5).toISOString(),
      note: 'Opens their Stripe billing portal. Good for 14 days. Carries no session.'
    });
  } catch (err) {
    console.error('[admin/billing-link]', err);
    return res.status(500).json({ error: 'could not make a link' });
  }
}
