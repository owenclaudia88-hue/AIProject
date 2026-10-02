import { recordOutreach, optOuts, bouncedEmails, outreachLog, listCustomers, listLeads, getSettings } from './db.js';
import { sendCheckoutReminder, sendSecondReminder, sendThirdReminder, sendBonusReminder, sendBonusLastHour } from './email.js';
import { bonusToken, deadlineLabel, BONUS_HOURS } from './bonus.js';
import { unsubscribeUrl } from './outreach.js';
import { checkoutFunnel } from './funnel.js';
import { productFor, priceLabelFor, DEFAULT_SOURCE, ENGINE_SOURCE } from './products.js';

/**
 * The abandoned-checkout sequence, shared by the scheduled run and the buttons
 * in the dashboard so the two cannot drift apart.
 *
 * Three messages. The first is a short nudge a couple of hours after someone
 * walks away; the second, a day later, makes the case; the third, a day after
 * that, stops selling and explains what the thing actually does — by which
 * point the price is not what is in the way.
 *
 * Each step waits on a different clock. The first counts from the abandoned
 * checkout, the second from when the first was actually sent — so a delayed or
 * failed first email pushes the second along with it rather than both landing
 * at once.
 */

// The bonus email is logged under its own kind as well as 'checkout-reminder',
// so the last-hour email can tell a bonus recipient from someone who got the
// older plain reminder, and can time itself from the moment the bonus began.
const BONUS_KIND = 'bonus-offer';
const LAST_HOUR_KIND = 'checkout-bonus-last-hour';

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
    // The last hour of the 24-hour bonus. Only for people whose first reminder
    // was the bonus email (logged as BONUS_KIND), timed from that email, and
    // never after the bonus has run out — see eligibleFor.
    kind: LAST_HOUR_KIND,
    label: 'Bonus last hour',
    after: 'checkout-reminder',
    delayKey: 'bonusLastHourDelayHours',
    defaultHours: 23,
    send: sendBonusLastHour
  },
  {
    kind: 'checkout-reminder-2',
    label: 'Follow-up',
    after: 'checkout-reminder',
    delayKey: 'reminder2DelayHours',
    defaultHours: 24,
    send: sendSecondReminder
  },
  {
    kind: 'checkout-reminder-3',
    label: 'Explainer',
    after: 'checkout-reminder-2',
    delayKey: 'reminder3DelayHours',
    defaultHours: 24,
    send: sendThirdReminder
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
    // When the scheduled job last actually ran, and what it did. A sequence
    // that quietly stopped firing looks exactly like one with nobody due.
    lastRunAt: s.reminderLastRunAt ?? null,
    lastRunReport: s.reminderLastRunReport ?? null,
    // Shown in the second email. Blank means the line is left out entirely
    // rather than an empty price appearing in it.
    regularPriceLabel: (s.regularPriceLabel ?? '').trim(),
    steps,
    // kept for the older shape the dashboard first spoke
    delayHours: steps[0].delayHours
  };
}

/**
 * Everyone who gave us their details at checkout, never paid, never got an
 * account, and has not unsubscribed.
 *
 * The list comes from our own leads table. It used to be rebuilt from Stripe
 * alone, on the reasoning that Stripe is what knows whether money arrived —
 * true, but it cannot answer the other half. A PaymentIntent is created when
 * the checkout page loads, before anything is typed, and an email only ever
 * reaches Stripe if a card is actually submitted. So this sequence could only
 * ever reach people whose card was declined, and the people it was written
 * for — name and email in, never got as far as a card — were invisible to it.
 * Not one reminder had ever been sent.
 *
 * Stripe is still asked, for two reasons: anyone it says has paid is removed
 * no matter what our own tables think, and any older non-buyer it knows about
 * is folded in, since the leads table only starts from the day it shipped. If
 * Stripe cannot be reached we still write to the leads — better a reminder
 * sent from slightly staler knowledge than a sequence that silently stops.
 */
export async function abandonedCheckouts() {
  const [leads, customers, funnel] = await Promise.all([
    listLeads(2000),
    listCustomers(),
    checkoutFunnel({ limit: 500 }).catch((err) => {
      console.error('[reminders] Stripe unreachable, using leads only:', err.message);
      return { people: [] };
    })
  ]);

  const accounts = new Set(customers.map((c) => c.email));
  const paid = new Set(funnel.people.filter((p) => p.paid && p.email).map((p) => p.email));

  const byEmail = new Map();
  // Our own records first: they carry the moment somebody actually walked
  // away, which is the clock the first reminder runs on.
  for (const l of leads) {
    byEmail.set(l.email, {
      email: l.email,
      name: l.name || null,
      status: 'lead',
      // Which page they came through, so the reminder links to that one.
      // Null on rows written before the column existed, which predate the
      // second product — the default is the right answer for them.
      source: l.source || DEFAULT_SOURCE,
      createdAt: new Date(l.first_seen).toISOString()
    });
  }
  // Then anyone Stripe knows abandoned, for the period before the leads table
  // existed and for cards that were tried and declined.
  for (const p of funnel.people) {
    // Somebody Stripe only ever saw pay has nothing to be chased about and was
    // never a lead we lost. Our own leads rows are kept either way, a few lines
    // above, because those people did hand over their details first.
    if (!p.email || p.paid || byEmail.has(p.email)) continue;
    byEmail.set(p.email, p);
  }

  // Everybody who started, each marked with whether they have since bought.
  // The flag is carried rather than used to drop them here, so the dashboard
  // can show a sale the sequence won instead of the person simply vanishing
  // from the list the moment they convert.
  return [...byEmail.values()].map((p) => ({
    ...p,
    purchased: accounts.has(p.email) || paid.has(p.email) || !!p.purchased
  }));
}

/**
 * The same list with unsubscribes removed — who may actually be written to.
 *
 * Kept separate from abandonedCheckouts because the dashboard needs to show
 * someone who has opted out, greyed out and with no send button, rather than
 * have them vanish and look like a person who was never there.
 */
export async function openCheckouts() {
  const [people, optedOut, bounced] = await Promise.all([
    abandonedCheckouts(), optOuts(), bouncedEmails()
  ]);
  // Buying ends the sequence. This is the only place that decides it, so a
  // reminder cannot be sent to somebody who has already paid - not by the
  // cron, and not by the Send button on the dashboard, which asks the same
  // question through eligibleFor.
  //
  // Unsubscribed is a decision they made; bounced is an address that does not
  // exist. Either way there is nothing to write to, and writing anyway costs
  // sender reputation that the receipts and login links depend on.
  return people.filter((p) =>
    !p.purchased && !optedOut.has(p.email) && !bounced.has(p.email));
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

  if (step.kind === LAST_HOUR_KIND) {
    const bonusSent = await outreachLog(BONUS_KIND);
    const now = Date.now();
    return people.filter((p) => {
      if (done.has(p.email)) return false;
      const started = bonusSent.get(p.email);
      if (!started) return false;                             // got the old plain reminder, not the bonus
      if ((p.source || DEFAULT_SOURCE) === ENGINE_SOURCE) return false;
      // Never announce "one hour left" for a bonus that has already ended.
      return new Date(started).getTime() + BONUS_HOURS() * 3600 * 1000 > now;
    }).map((p) => ({ ...p, since: bonusSent.get(p.email) }));
  }

  // Whether someone is on the bonus track changes which second and third
  // emails they get, so both steps below need to know.
  const onBonusTrack = step.kind === 'checkout-reminder-2' || step.kind === 'checkout-reminder-3'
    ? await outreachLog(BONUS_KIND)
    : null;

  if (step.kind === 'checkout-reminder-2') {
    const lastHour = await outreachLog(LAST_HOUR_KIND);
    const now = Date.now();
    return people.filter((p) => {
      if (done.has(p.email)) return false;
      if (prior && !prior.has(p.email)) return false;
      const started = onBonusTrack.get(p.email);
      if (started) {
        // Their second email is the last-hour one, not this. Skip if it has
        // already gone out, or if the bonus is still running and it is coming.
        if (lastHour.has(p.email)) return false;
        if (new Date(started).getTime() + BONUS_HOURS() * 3600 * 1000 > now) return false;
        // The bonus ended and the last-hour email never went — a stopped cron,
        // say. Send the plain follow-up rather than leave them with one email.
      }
      return true;
    }).map((p) => ({ ...p, since: prior.get(p.email) }));
  }

  if (step.kind === 'checkout-reminder-3') {
    // The explainer follows whichever second email they actually got, so the
    // bonus track reaches it too instead of stopping at two.
    const lastHour = await outreachLog(LAST_HOUR_KIND);
    return people.filter((p) => {
      if (done.has(p.email)) return false;
      return lastHour.has(p.email) || prior.has(p.email);
    }).map((p) => ({ ...p, since: lastHour.get(p.email) || prior.get(p.email) }));
  }

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

/* Price and link now depend on which page the lead came from, so both are
   resolved per person in sendStepTo rather than once for the whole batch. */

/** Send one step to these people. Returns what went and what did not, and why. */
export async function sendStepTo(kind, people, opts = {}) {
  const step = STEPS.find((s) => s.kind === kind);
  if (!step) throw new Error('unknown reminder step: ' + kind);

  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  const regularPriceLabel = opts.regularPriceLabel ?? (await reminderSettings()).regularPriceLabel;
  const sent = [], skipped = [];

  for (const person of people) {
    try {
      // Send them back to the page they actually left, at the price it
      // actually charges. Chasing an Automation Engine lead to the $1
      // Specialists checkout is not a near miss — it is a different product.
      const source = person.source || DEFAULT_SOURCE;
      const product = productFor(source);

      // The first reminder for the $1 Specialists carries the 24-hour bonus:
      // the Engine and Carousel Studio free with the order. The clock starts
      // now, at send, and the signed link is what makes the checkout honour it.
      // It goes to the lifetime-access checkout, the one that can show and
      // apply the bonus. Engine leads keep the plain reminder — the bonus is
      // built around the Specialists offer.
      if (step.kind === 'checkout-reminder' && source !== ENGINE_SOURCE) {
        // Whole minutes, so the last-hour email — which rebuilds the deadline
        // from the logged send time — lands on the same one.
        const expiresAt = Math.floor(Date.now() / 60000) * 60000 + BONUS_HOURS() * 3600 * 1000;
        const token = bonusToken(person.email, expiresAt);
        await sendBonusReminder(person.email, {
          name: person.name,
          checkoutUrl: `${site}/lifetime-access/checkout.html?bonus=${encodeURIComponent(token)}`
            + `&r=${encodeURIComponent(BONUS_KIND)}`,
          unsubscribeUrl: unsubscribeUrl(person.email),
          deadline: deadlineLabel(expiresAt)
        });
        await recordOutreach(person.email, step.kind);
        await recordOutreach(person.email, BONUS_KIND);
        sent.push(person.email);
        continue;
      }

      // One hour before the bonus ends. The deadline is rebuilt from when the
      // bonus email went out, which gives the same token — so this link and
      // the first one apply the same bonus until the same moment.
      if (step.kind === LAST_HOUR_KIND) {
        const expiresAt = Math.floor(new Date(person.since).getTime() / 60000) * 60000 + BONUS_HOURS() * 3600 * 1000;
        const token = bonusToken(person.email, expiresAt);
        await sendBonusLastHour(person.email, {
          name: person.name,
          checkoutUrl: `${site}/lifetime-access/checkout.html?bonus=${encodeURIComponent(token)}`
            + `&r=${encodeURIComponent(step.kind)}`,
          unsubscribeUrl: unsubscribeUrl(person.email),
          deadline: deadlineLabel(expiresAt)
        });
        await recordOutreach(person.email, step.kind);
        sent.push(person.email);
        continue;
      }

      await step.send(person.email, {
        name: person.name,
        // The reminder's own name, so a sale that follows it is attributable
        // rather than merely later than it.
        checkoutUrl: `${site}${product.checkoutPath}?r=${encodeURIComponent(step.kind)}`,
        unsubscribeUrl: unsubscribeUrl(person.email),
        priceLabel: priceLabelFor(source),
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
