import { readSession } from '../../lib/session.js';
import { getCustomer, normalizeEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { memberPayments, activeSubscriptions } from '../../lib/funnel.js';

/**
 * GET /api/admin/member-payments?email=… — every payment this member has made
 * and any live subscription, for the refund picker in the dashboard.
 */
export default async function handler(req, res) {
  const actor = readSession(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    const email = normalizeEmail(new URL(req.url, 'http://localhost').searchParams.get('email') || '');
    if (!email) return res.status(400).json({ error: 'missing email' });

    const customer = await getCustomer(email);
    if (!customer) return res.status(404).json({ error: 'no such member' });

    const { customerId, items } = await memberPayments(customer);
    const subs = await activeSubscriptions(customerId);

    return res.status(200).json({
      email,
      payments: items,
      subscriptions: subs.map((s) => ({
        id: s.id, status: s.status,
        amount: s.items.data[0]?.price?.unit_amount ?? null,
        currency: s.items.data[0]?.price?.currency ?? null,
        interval: s.items.data[0]?.price?.recurring?.interval ?? null
      }))
    });
  } catch (err) {
    console.error('[admin/member-payments]', err);
    return res.status(500).json({ error: 'server' });
  }
}
