import { recordOutreach, optOuts, outreachLog, listCustomers, getSettings } from './db.js';
import { sendCheckoutReminder } from './email.js';
import { unsubscribeUrl } from './outreach.js';
import { checkoutFunnel } from './funnel.js';

/**
 * The abandoned-checkout reminder, shared by the scheduled run and the button
 * in the dashboard so the two cannot drift apart.
 */

export const KIND = 'checkout-reminder';

export const DEFAULTS = {
  reminderEnabled: 'on',
  reminderDelayHours: '2'
};

export async function reminderSettings() {
  const s = await getSettings();
  const delay = Number.parseFloat(s.reminderDelayHours ?? DEFAULTS.reminderDelayHours);
  return {
    enabled: (s.reminderEnabled ?? DEFAULTS.reminderEnabled) === 'on',
    // Guard rails: never instant, never so far out it is pointless.
    delayHours: Number.isFinite(delay) ? Math.min(Math.max(delay, 0.25), 168) : 2
  };
}

/**
 * Everyone who entered an address at checkout, never paid, never got an
 * account, has not unsubscribed, and has not already been sent this.
 *
 * Rebuilt from Stripe every time rather than kept in a list of our own: Stripe
 * is what actually knows whether the money arrived, so asking it is the only
 * way to be sure a reminder never lands on someone who has in fact paid.
 */
export async function eligibleForReminder() {
  const [{ people }, customers, optedOut, already] = await Promise.all([
    checkoutFunnel({ limit: 500 }), listCustomers(), optOuts(), outreachLog(KIND)
  ]);
  const accounts = new Set(customers.map((c) => c.email));
  return people.filter((p) =>
    p.email && !p.paid && !accounts.has(p.email) && !optedOut.has(p.email) && !already.has(p.email));
}

function priceLabel() {
  const amount = Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10);
  const currency = (process.env.PRICE_CURRENCY ?? 'usd').toUpperCase();
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100); }
  catch { return `${(amount / 100).toFixed(2)} ${currency}`; }
}

/** Send to these people. Returns what went and what did not, and why. */
export async function sendRemindersTo(people) {
  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  const label = priceLabel();
  const sent = [], skipped = [];

  for (const person of people) {
    try {
      await sendCheckoutReminder(person.email, {
        name: person.name,
        checkoutUrl: `${site}/checkout.html`,
        unsubscribeUrl: unsubscribeUrl(person.email),
        priceLabel: label
      });
      // Recorded only after the send succeeds, so a failure is retried next
      // time rather than silently marked as done.
      await recordOutreach(person.email, KIND);
      sent.push(person.email);
    } catch (err) {
      console.error('[reminders] failed for', person.email, err.message);
      skipped.push({ email: person.email, why: err.message });
    }
  }
  return { sent, skipped };
}
