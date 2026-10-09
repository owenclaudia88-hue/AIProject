import Stripe from 'stripe';
import {
  getCustomer, createLoginToken, claimWelcome, releaseWelcome
} from './db.js';
import { sendWelcome } from './email.js';
import { parseAddons } from './products.js';

/**
 * Send the one welcome, working out what it should say.
 *
 * Deliberately reads the world at send time rather than being told: what they
 * hold, what they chose, when their trial ends. The alternative is passing a
 * description of the order through a queue and hoping it still matches by the
 * time it is sent, which it would not - the whole reason this is queued is that
 * the buyer is still making choices.
 *
 * Safe to call twice. Only one caller can claim a send, and a failure hands it
 * back for the sweep to retry rather than swallowing it.
 */

export async function sendWelcomeFor(email, { reason = 'unknown' } = {}) {
  const customer = await getCustomer(email);
  if (!customer) return { sent: false, why: 'no customer row' };

  // One claim wins; everybody else is told it is already in hand.
  if (!(await claimWelcome(email))) return { sent: false, why: 'already sent or not queued' };

  try {
    // Joined the membership straight from the homepage, with no $1 order. Their
    // welcome is about the membership alone - there are no Specialists to install.
    const joined = customer.source === 'home-join' && !customer.last_payment_intent;

    let bought, membership, until = null;
    if (joined) {
      const plan = await joinedPlan(customer);
      bought = { member: true };
      membership = plan.interval === 'year' ? 'year' : 'month';
      until = plan.until;
    } else {
      bought = await whatThisOrderBought(customer);

      // What they chose when the offer was in front of them. Everybody is put on
      // a trial whether they asked or not, so only a deliberate choice earns the
      // membership section - 'declined', 'seen' and nothing at all say nothing.
      const chose = customer.upsell_choice;
      membership = chose === 'year' ? 'year' : chose === 'trial' ? 'trial' : null;
      if (membership) until = await membershipEndsAt(customer, membership);
    }

    const token = await createLoginToken(email);
    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;

    await sendWelcome(email, loginUrl, { name: customer.name, bought, membership, until });
    console.log('[welcome] sent to', email, `(${reason})`,
      JSON.stringify({ ...bought, membership }));
    return { sent: true, bought, membership };
  } catch (err) {
    // Put it back. A welcome that failed to send must not be marked as sent,
    // or the buyer is left with a charge and no way in.
    await releaseWelcome(email).catch(() => {});
    console.error('[welcome] failed for', email, '-', err.message);
    throw err;
  }
}

/**
 * What this order included — not what the account holds.
 *
 * The difference only shows on a repeat buyer or somebody who was already a
 * member: reading their entitlements would list everything they own and call it
 * their order. So the add-ons come from the payment intent that was actually
 * charged, and the course from the separate charge that names it as its parent.
 *
 * If Stripe cannot be reached, the email goes out describing the Specialists
 * alone. That understates the order, which is recoverable — everything is still
 * in their member area — where claiming things they did not buy is not.
 */
async function whatThisOrderBought(customer) {
  const none = { engine: false, carousel: false, course: false };
  const key = process.env.STRIPE_SECRET_KEY;
  const piId = customer.last_payment_intent;
  if (!key || !piId) return none;

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const pi = await stripe.paymentIntents.retrieve(piId);
    // A bonus order carries its free add-ons in the same field, so this covers
    // both without having to know which kind of order it was.
    const addons = new Set(parseAddons(pi.metadata?.addons));

    // The course is its own charge, made minutes later, which points back at
    // this order. Found by that link rather than by the entitlement, so a course
    // bought on an earlier order is not claimed by this email.
    const later = await stripe.paymentIntents
      .list({ customer: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id, limit: 20 })
      .then((r) => r.data)
      .catch(() => []);
    const course = later.some((p) => p.status === 'succeeded'
      && p.metadata?.course && p.metadata?.payment_intent === piId);

    return { engine: addons.has('engine'), carousel: addons.has('carousel'), course };
  } catch (err) {
    console.error('[welcome] could not read the order, describing the specialists only:', err.message);
    return none;
  }
}

/** When the year runs to, or when the trial turns into $39. */
async function membershipEndsAt(customer, membership) {
  const key = process.env.STRIPE_SECRET_KEY;
  const id = customer.stripe_customer_id;
  if (!key || !id) return null;
  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const subs = await stripe.subscriptions.list({ customer: id, status: 'all', limit: 10 });
    const live = subs.data.filter((s) => ['trialing', 'active'].includes(s.status));
    if (!live.length) return null;
    if (membership === 'trial') {
      const t = live.find((s) => s.status === 'trialing');
      return t?.trial_end ? new Date(t.trial_end * 1000) : null;
    }
    // The yearly one, by its price rather than by being the newest.
    const year = live.find((s) => s.items?.data?.some((i) => i.price?.recurring?.interval === 'year'));
    const end = year?.current_period_end || live[0]?.current_period_end;
    return end ? new Date(end * 1000) : null;
  } catch (err) {
    // A date is worth less than the email. Send it without one.
    console.error('[welcome] could not read the subscription dates:', err.message);
    return null;
  }
}

/** The plan a homepage member is on, and when it next renews. */
async function joinedPlan(customer) {
  const key = process.env.STRIPE_SECRET_KEY;
  const id = customer.stripe_customer_id;
  if (!key || !id) return { interval: 'month', until: null };
  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const subs = await stripe.subscriptions.list({ customer: id, status: 'all', limit: 10 });
    const live = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
    const interval = live?.items?.data?.[0]?.price?.recurring?.interval || 'month';
    const end = live?.current_period_end;
    return { interval, until: end ? new Date(end * 1000) : null };
  } catch (err) {
    console.error('[welcome] could not read the membership plan:', err.message);
    return { interval: 'month', until: null };
  }
}
