import { recordOutreach, optOuts, outreachLog, listCustomers, getSettings } from './db.js';
import { sendCheckoutReminder, sendSecondReminder } from './email.js';
import { unsubscribeUrl } from './outreach.js';
import { checkoutFunnel } from './funnel.js';

/**
 * The abandoned-checkout sequence, shared by the scheduled run and the buttons
 * in the dashboard so the two cannot drift apart.
 *
 * Two messages. The first is a short nudge a couple of hours after someone
 * walks away; the second, a day later, explains what the product actually is,
 * which is the only reason a second email earns its place.
 *
 * Each step waits on a different clock. The first counts from the abandoned
 * checkout, the second from when the first was actually sent — so a delayed or
 * failed first email pushes the second along with it rather than both landing
 * at once.
 */

export const STEPS = [
  {
    kind: 'checkout-reminder',
    label: 'First reminder',
    after: 'checkout',
    delayKey: 'reminderDelayHours',
    defaultHours: 2,
    send: sendCheckoutReminder
  },
  {
    kind: 'checkout-reminder-2',
    label: 'Follow-up',
    after: 'checkout-reminder',
    delayKey: 'reminder2DelayHours',
    defaultHours: 24,
    send: sendSecondReminder
  }
];

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

export async function reminderSettings() {
  const s = await getSettings();
  const steps = STEPS.map((step) => {
    const raw = Number.parseFloat(s[step.delayKey] ?? String(step.defaultHours));
    return {
      kind: step.kind,
      label: step.label,
      after: step.after,
      delayKey: step.delayKey,
      // Guard rails: never instant, never so far out it is pointless.
      delayHours: Number.isFinite(raw) ? clamp(raw, 0.25, 168) : step.defaultHours
    };
  });
  return {
    enabled: (s.reminderEnabled ?? 'on') === 'on',
    // Shown in the second email. Blank means the line is left out entirely
    // rather than an empty price appearing in it.
    regularPriceLabel: (s.regularPriceLabel ?? '').trim(),
    steps,
    // kept for the older shape the dashboard first spoke
    delayHours: steps[0].delayHours
  };
}

/**
 * Everyone who entered an address at checkout, never paid, never got an
 * account, and has not unsubscribed.
 *
 * Rebuilt from Stripe every time rather than kept in a list of our own: Stripe
 * is what actually knows whether the money arrived, so asking it is the only
 * way to be sure a reminder never lands on someone who has in fact paid.
 */
export async function openCheckouts() {
  const [{ people }, customers, optedOut] = await Promise.all([
    checkoutFunnel({ limit: 500 }), listCustomers(), optOuts()
  ]);
  const accounts = new Set(customers.map((c) => c.email));
  return people.filter((p) => p.email && !p.paid && !accounts.has(p.email) && !optedOut.has(p.email));
}

/** Who is eligible for one particular step, and who is already past it. */
export async function eligibleFor(kind) {
  const step = STEPS.find((s) => s.kind === kind);
  if (!step) throw new Error('unknown reminder step: ' + kind);

  const [people, done, prior] = await Promise.all([
    openCheckouts(),
    outreachLog(step.kind),
    step.after === 'checkout' ? Promise.resolve(null) : outreachLog(step.after)
  ]);

  return people.filter((p) => {
    if (done.has(p.email)) return false;                    // already had this one
    if (prior && !prior.has(p.email)) return false;         // has not had the one before it
    return true;
  }).map((p) => ({
    ...p,
    // the moment the clock for this step started running
    since: prior ? prior.get(p.email) : p.createdAt
  }));
}

/** Of those, the ones whose wait has now elapsed. */
export async function dueFor(kind, delayHours) {
  const cutoff = Date.now() - delayHours * 3600 * 1000;
  return (await eligibleFor(kind)).filter((p) => new Date(p.since).getTime() <= cutoff);
}

function priceLabel() {
  const amount = Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10);
  const currency = (process.env.PRICE_CURRENCY ?? 'usd').toUpperCase();
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100); }
  catch { return `${(amount / 100).toFixed(2)} ${currency}`; }
}

/** Send one step to these people. Returns what went and what did not, and why. */
export async function sendStepTo(kind, people, opts = {}) {
  const step = STEPS.find((s) => s.kind === kind);
  if (!step) throw new Error('unknown reminder step: ' + kind);

  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  const label = priceLabel();
  const regularPriceLabel = opts.regularPriceLabel ?? (await reminderSettings()).regularPriceLabel;
  const sent = [], skipped = [];

  for (const person of people) {
    try {
      await step.send(person.email, {
        name: person.name,
        checkoutUrl: `${site}/checkout.html`,
        unsubscribeUrl: unsubscribeUrl(person.email),
        priceLabel: label,
        regularPriceLabel
      });
      // Recorded only after the send succeeds, so a failure is retried next
      // time rather than silently marked as done.
      await recordOutreach(person.email, step.kind);
      sent.push(person.email);
    } catch (err) {
      console.error(`[reminders] ${step.kind} failed for`, person.email, err.message);
      skipped.push({ email: person.email, why: err.message });
    }
  }
  return { sent, skipped };
}
