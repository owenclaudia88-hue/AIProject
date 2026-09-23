import { readSession } from '../../lib/session.js';
import { listCustomers, displayNameFor, outreachLog, optOuts } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { checkoutFunnel } from '../../lib/funnel.js';
import { reminderSettings, abandonedCheckouts, STEPS } from '../../lib/reminders.js';

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
    const [customers, optedOut, reminders, ...logs] = await Promise.all([
      listCustomers(), optOuts(), reminderSettings(),
      ...STEPS.map((s) => outreachLog(s.kind))
    ]);
    // kind -> Map(email -> when it was sent)
    const sentByKind = new Map(STEPS.map((s, i) => [s.kind, logs[i]]));

    let funnel = null, funnelError = null;
    try {
      funnel = await checkoutFunnel({ limit: 500 });
    } catch (err) {
      console.error('[admin/members] funnel unavailable:', err.message);
      funnelError = 'Could not reach Stripe, so the checkout figures are missing.';
    }

    // Reads our own leads table as well as Stripe, and tolerates Stripe being
    // down — so the people to chase still appear even when the funnel numbers
    // above could not be worked out.
    const abandoned = await abandonedCheckouts();

    const members = customers.map((c) => ({
      email: c.email,
      name: displayNameFor(c.email, c.name),
      hasName: !!(c.name && c.name.trim()),
      status: c.status,
      paymentIntent: c.last_payment_intent,
      joinedAt: c.created_at,
      updatedAt: c.updated_at
    }));

    // Anyone who gave their details at checkout and never ended up with an
    // account. This is the list worth doing something about — and it comes
    // from the same function the reminder sequence uses, so what the dashboard
    // shows and what actually gets emailed cannot drift apart.
    const accounts = new Map(members.map((m) => [m.email, m.status]));
    const didNotConvert = abandoned
      .map((p) => ({
        email: p.email, name: p.name, status: p.status, createdAt: p.createdAt,
        // when each step of the sequence went out, so staff can see exactly
        // where someone is in it rather than just "reminded" or not
        sent: Object.fromEntries(STEPS.map((s) => [s.kind, sentByKind.get(s.kind).get(p.email) || null])),
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
      // The Stripe stats may be missing, but the people to chase no longer
      // depend on Stripe — so they are returned either way rather than
      // disappearing along with the numbers above.
      funnel: {
        ...(funnel ? funnel.stats : {}),
        didNotConvert,
        paidWithoutAccess
      },
      funnelError,
      reminders
    });
  } catch (err) {
    console.error('[admin/members]', err);
    return res.status(500).json({ error: 'server' });
  }
}
