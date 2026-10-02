import { sessionEmail } from '../../lib/session.js';
import { listCustomers, displayNameFor, outreachLog, optOuts, bouncedEmails,
         convertedAfterReminder } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { checkoutFunnel } from '../../lib/funnel.js';
import { reminderSettings, abandonedCheckouts, STEPS } from '../../lib/reminders.js';
import { listLeads } from '../../lib/db.js';

/**
 * GET /api/admin/members — everyone who has an account, everyone who started
 * checkout, and how many of the second became the first.
 *
 * The Stripe half is best-effort: if it cannot be reached the members list
 * still returns, because losing the funnel should not cost staff the ability
 * to see and manage their members.
 */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    const [customers, optedOut, bounced, reminders, ...logs] = await Promise.all([
      listCustomers(), optOuts(), bouncedEmails(), reminderSettings(),
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
    // Who has a subscription that could be ended, in one pass. Best-effort:
    // if Stripe cannot be reached the member list still renders, just without
    // the button - losing the page would be the worse failure.
    const subscribed = new Set();
    const endingAt = new Map();
    try {
      const Stripe = (await import('stripe')).default;
      const sk = process.env.STRIPE_SECRET_KEY;
      if (sk) {
        const stripe = new Stripe(sk, { apiVersion: '2024-12-18.acacia' });
        for await (const sub of stripe.subscriptions.list({
          status: 'all', limit: 100, expand: ['data.customer']
        })) {
          if (!['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) continue;
          const addr = typeof sub.customer === 'object' ? sub.customer?.email : null;
          if (!addr) continue;
          const at = String(addr).trim().toLowerCase();
          subscribed.add(at);
          // Scheduled to end but not ended. Worth saying, because it can be
          // undone and nothing else on the page would show it.
          if (sub.cancel_at_period_end) endingAt.set(at, sub.cancel_at || sub.current_period_end || null);
        }
      }
    } catch (err) {
      console.error('[admin/members] subscription pass failed:', err.message);
    }

    const abandoned = await abandonedCheckouts();

    // Everyone who handed over a name and an email, which is the only honest
    // denominator for "how many of the people we know about went on to pay".
    // Stripe's own figure counts PaymentIntents instead, so it read 16 of 17
    // beside a list of 19 members and looked like a member had gone missing.
    const leadRows = await listLeads(5000).catch((err) => {
      console.error('[admin/members] leads unavailable:', err.message);
      return [];
    });

    // The mirror of the list above: the people who were chased and did buy.
    // The query returns a row per reminder they had been sent, collapsed here
    // to a row per buyer, so somebody who got four emails is one sale and not
    // four.
    const wins = await convertedAfterReminder();
    const byBuyer = new Map();
    for (const w of wins) {
      const cur = byBuyer.get(w.email);
      if (!cur) {
        byBuyer.set(w.email, {
          email: w.email, name: w.name, source: w.source,
          boughtAt: w.bought_at,
          // The email they actually clicked through, when it is known. This is
          // the half that is proof rather than inference.
          arrivedThrough: w.arrived_through || null,
          // The last reminder to go out before they bought: the one most likely
          // to have moved them, and the only honest guess available when
          // arrivedThrough is null.
          lastReminder: w.reminder_kind, lastSentAt: w.sent_at,
          hoursAfter: Number(w.hours_after),
          reminderCount: 1
        });
      } else {
        cur.reminderCount++;
        if (new Date(w.sent_at) > new Date(cur.lastSentAt)) {
          cur.lastReminder = w.reminder_kind;
          cur.lastSentAt = w.sent_at;
          cur.hoursAfter = Number(w.hours_after);
        }
      }
    }
    const convertedFromReminder = [...byBuyer.values()];

    const members = customers.map((c) => {
      // A member the sequence won back, and how many reminders had reached them
      // by the time they bought. Shown on the member rather than in the chase
      // list, because once somebody buys they stop being work to do and start
      // being a member who happens to have arrived that way.
      const won = byBuyer.get(c.email) || null;
      return {
        email: c.email,
        name: displayNameFor(c.email, c.name),
        hasName: !!(c.name && c.name.trim()),
        status: c.status,
        paymentIntent: c.last_payment_intent,
        joinedAt: c.created_at,
        updatedAt: c.updated_at,
        // Whether there is a subscription to end. Absent means no button, which
        // is right: there is nothing to cancel.
        viaSubscription: subscribed.has(String(c.email).toLowerCase()),
        // Set to end, not ended. The admin offers to undo it.
        endingAt: endingAt.get(String(c.email).toLowerCase()) || null,
        viaReminder: won
          ? {
            count: won.reminderCount,
            // The email they actually clicked, when it is known, rather than
            // the last one that happened to go out before they bought.
            through: won.arrivedThrough || null,
            hoursAfter: won.hoursAfter
          }
          : null
      };
    });

    // Anyone who gave their details at checkout and never ended up with an
    // account. This is the list worth doing something about — and it comes
    // from the same function the reminder sequence uses, so what the dashboard
    // shows and what actually gets emailed cannot drift apart.
    const accounts = new Map(members.map((m) => [m.email, m.status]));
    // Open leads only. Somebody who has bought is a member now, and listing
    // them here would turn a to-do list into a mixed history of one.
    const didNotConvert = abandoned
      .filter((p) => !p.purchased)
      .map((p) => ({
        email: p.email, name: p.name, status: p.status, createdAt: p.createdAt,
        // when each step of the sequence went out, so staff can see exactly
        // where someone is in it rather than just "reminded" or not
        sent: Object.fromEntries(STEPS.map((s) => [s.kind, sentByKind.get(s.kind).get(p.email) || null])),
        unsubscribed: optedOut.has(p.email),
        // An address that does not exist. Shown rather than hidden, so a dead
        // lead reads as dead instead of as one the sequence forgot.
        bounced: bounced.has(p.email)
      }));

    // How often chasing somebody actually works.
    //
    // The denominator is everyone who handed over their details and did not buy
    // there and then - the whole pool the sequence exists to win back, open
    // leads and recovered ones together. The numerator is the ones a reminder
    // actually brought back, which is why it counts convertedFromReminder
    // rather than every lead who later bought: somebody who returned on their
    // own was not won by an email.
    const wasReminded = (p) => STEPS.some((s2) => sentByKind.get(s2.kind).has(p.email));
    // The people the sequence exists for: still to win back, plus the ones it
    // won. Anybody who was ever sent a reminder was in this pool by definition,
    // because that is the only list reminders are sent from - and a buyer who
    // never abandoned anything is correctly outside it.
    const wonBack = convertedFromReminder.length;
    const pool = didNotConvert.length + wonBack;
    const reminderStats = {
      pool,
      bought: wonBack,
      stillOpen: didNotConvert.length,
      reminded: abandoned.filter(wasReminded).length,
      // Null rather than zero on an empty pool: no data is not the same as a
      // nought per cent conversion rate.
      rate: pool ? Math.round((wonBack / pool) * 1000) / 10 : null
    };

    // Of everyone who gave their details, how many paid. Counted over our own
    // records rather than Stripe's, so the figure sits in the same world as the
    // member list beside it.
    const gaveDetails = leadRows.length;
    const gaveDetailsBought = leadRows.filter((l) => l.purchased).length;
    const detailsStats = {
      gaveDetails,
      bought: gaveDetailsBought,
      rate: gaveDetails ? Math.round((gaveDetailsBought / gaveDetails) * 1000) / 10 : null
    };

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
        convertedFromReminder,
        reminderStats,
        detailsStats,
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
