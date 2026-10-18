import Stripe from 'stripe';
import {
  getCustomer, createLoginToken, claimWelcome, releaseWelcome,
  saveWelcomeCopy, getWelcomeCopy
} from './db.js';
import { sendWelcome, sendWelcomeCopy, welcomeCopyOf } from './email.js';
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
    const { bought, membership, until, price } = await welcomeContentFor(customer);

    const loginUrl = await loginUrlFor(email);
    const out = await sendWelcome(email, loginUrl, { name: customer.name, bought, membership, until, price });
    await keepWelcomeCopy(email, out, loginUrl);
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
 * The welcome again, sent by support to one address on the account.
 *
 * Support resends it when the first never arrived - usually to an address
 * added because the original inbox refuses our mail. What arrives there is the
 * email that was sent the first time, word for word, with only the sign-in
 * link replaced: that one lasted fifteen minutes. It is not rebuilt from the
 * account as it is today, which can say something different - a trial since
 * ended, a date moved on, Stripe out of reach and the add-ons left off.
 *
 * An account welcomed before copies were kept, or never welcomed at all (access
 * granted by hand), is sent one built the usual way, and that one is kept so
 * every resend after it matches.
 *
 * No claim: the first send already happened or was never queued, and a resend
 * is a decision support makes on purpose. The link is minted for the account,
 * whichever inbox it is read in.
 */
export async function resendWelcome(email, to = email) {
  const customer = await getCustomer(email);
  if (!customer) throw new Error('no customer row');
  const loginUrl = await loginUrlFor(customer.email);

  const copy = await getWelcomeCopy(customer.email);
  if (copy) {
    await sendWelcomeCopy(to, copy, loginUrl);
    return { copy: true };
  }

  const { bought, membership, until, price } = await welcomeContentFor(customer);
  const out = await sendWelcome(to, loginUrl, { name: customer.name, bought, membership, until, price });
  await keepWelcomeCopy(customer.email, out, loginUrl);
  return { copy: false, bought, membership };
}

/**
 * Keep what was just sent, for resending. Never allowed to fail the send: the
 * email has already gone, and a throw here would hand the welcome back to the
 * sweep and send it a second time.
 */
export async function keepWelcomeCopy(email, out, loginUrl) {
  try {
    const copy = welcomeCopyOf(out?.sent, loginUrl);
    if (copy) await saveWelcomeCopy(email, copy);
  } catch (err) {
    console.error('[welcome] sent, but could not keep a copy for', email, '-', err.message);
  }
}

/** What the welcome says: what was bought, and the membership if they chose one. */
async function welcomeContentFor(customer) {
  // Joined the membership straight from the homepage, with no $1 order. Their
  // welcome is about the membership alone - there are no Specialists to install.
  const joined = customer.source === 'home-join' && !customer.last_payment_intent;

  if (joined) {
    const plan = await joinedPlan(customer);
    return {
      bought: { member: true },
      membership: plan.interval === 'year' ? 'year' : 'month',
      until: plan.until,
      price: plan.amount == null ? null : { amount: plan.amount, currency: plan.currency }
    };
  }

  const bought = await whatThisOrderBought(customer);

  // What they chose when the offer was in front of them. Everybody is put on
  // a trial whether they asked or not, so only a deliberate choice earns the
  // membership section - 'declined', 'seen' and nothing at all say nothing.
  const chose = customer.upsell_choice;
  const membership = chose === 'year' ? 'year' : chose === 'trial' ? 'trial' : null;
  const until = membership ? await membershipEndsAt(customer, membership) : null;
  return { bought, membership, until, price: null };
}

async function loginUrlFor(email) {
  const token = await createLoginToken(email);
  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  return `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;
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
  const none = { engine: false, carousel: false, adstudio: false, course: false };
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

    return { engine: addons.has('engine'), carousel: addons.has('carousel'), adstudio: addons.has('adstudio'), course };
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
  const unknown = { interval: 'month', until: null, amount: null, currency: null };
  if (!key || !id) return unknown;
  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const subs = await stripe.subscriptions.list({ customer: id, status: 'all', limit: 10 });
    const live = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
    const end = live?.current_period_end;
    /* The amount comes off the same price object the interval does, so saying
       what they pay costs nothing extra. Taken from Stripe rather than written
       into the copy because this is the figure on their card: a founding price
       that later moves would otherwise leave the email quoting a number the
       member was never charged. */
    const price = live?.items?.data?.[0]?.price;
    return {
      interval: price?.recurring?.interval || 'month',
      until: end ? new Date(end * 1000) : null,
      amount: typeof price?.unit_amount === 'number' ? price.unit_amount : null,
      currency: price?.currency || null
    };
  } catch (err) {
    console.error('[welcome] could not read the membership plan:', err.message);
    return unknown;
  }
}
