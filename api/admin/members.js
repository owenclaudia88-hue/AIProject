import { readSession } from '../../lib/session.js';
import { listCustomers, displayNameFor, outreachLog, optOuts } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { checkoutFunnel } from '../../lib/funnel.js';
import { reminderSettings } from '../../lib/reminders.js';

/**
 * GET /api/admin/members — everyone who has an account, everyone who started
 * checkout, and how many of the second became the first.
 *
 * The Stripe half is best-effort: if it cannot be reached the members list
 * still returns, because losing the funnel should not cost staff the ability
 * to see and manage their members.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    const [customers, reminded, optedOut, reminders] = await Promise.all([
      listCustomers(), outreachLog('checkout-reminder'), optOuts(), reminderSettings()
    ]);

    let funnel = null, funnelError = null;
    try {
      funnel = await checkoutFunnel({ limit: 500 });
    } catch (err) {
      console.error('[admin/members] funnel unavailable:', err.message);
      funnelError = 'Could not reach Stripe, so the checkout figures are missing.';
    }

    const members = customers.map((c) => ({
      email: c.email,
      name: displayNameFor(c.email, c.name),
      hasName: !!(c.name && c.name.trim()),
      status: c.status,
      paymentIntent: c.last_payment_intent,
      joinedAt: c.created_at,
      updatedAt: c.updated_at
    }));

    // Anyone who entered an address at checkout and never ended up with an
    // account. This is the list worth doing something about.
    const accounts = new Map(members.map((m) => [m.email, m.status]));
    const didNotConvert = (funnel?.people || [])
      .filter((p) => !p.paid && p.email && !accounts.has(p.email))
      .map((p) => ({
        email: p.email, name: p.name, status: p.status, createdAt: p.createdAt,
        // so staff can see who has already been nudged, and who asked not to be
        remindedAt: reminded.get(p.email) || null,
        unsubscribed: optedOut.has(p.email)
      }));

    // Paid, not refunded, and yet has no access — a webhook that never
    // arrived, or a payment taken before it was wired up. Nobody would ever
    // go looking for this, so the dashboard has to put it in front of you.
    const paidWithoutAccess = (funnel?.people || [])
      .filter((p) => p.paid && !p.refunded && p.email && accounts.get(p.email) !== 'active')
      .map((p) => ({
        email: p.email, name: p.name, paymentIntent: p.id,
        amount: p.amount, currency: p.currency,
        accountStatus: accounts.get(p.email) || 'none', createdAt: p.createdAt
      }));

    return res.status(200).json({
      members,
      counts: {
        total: members.length,
        active: members.filter((m) => m.status === 'active').length,
        revoked: members.filter((m) => m.status !== 'active').length
      },
      funnel: funnel ? { ...funnel.stats, didNotConvert, paidWithoutAccess } : null,
      funnelError,
      reminders
    });
  } catch (err) {
    console.error('[admin/members]', err);
    return res.status(500).json({ error: 'server' });
  }
}
