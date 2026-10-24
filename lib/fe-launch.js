import { funnelEngineLaunchAudience, outreachLog, recordOutreach, optOuts, bouncedEmails,
         getSettings } from './db.js';
import { sendFunnelEngineLaunch } from './email.js';
import { LAUNCH } from './funnel-engine-launch.js';

/**
 * The Funnel Engine introduction, as a sequence every member goes through once.
 *
 * Not a broadcast: clients join every day, and each of them should meet it
 * too. So each member has their own start, and the seven emails run from it
 * on LAUNCH's days (0, 1, 2, 4, 5, 7, 9):
 *
 *   - somebody who was already a member when it was switched on starts then;
 *   - somebody who joins later starts `fe_launch_delay_days` after joining
 *     (3 by default), so it lands after their welcome and upgrade emails
 *     rather than on top of them.
 *
 * Owning the Funnel Engine ends it, and so does starting its checkout - that
 * person is in the four checkout reminders instead (see the audience query).
 * Unsubscribed and bounced addresses are never written to.
 *
 * Nothing is queued: each run asks who is now due their next email, which
 * survives a missed run or a redeploy the same way the checkout reminders do.
 * One email per person per run, in order, and never two within MIN_GAP, so a
 * sequence that fell behind catches up a day at a time rather than in a burst.
 */

export const STEPS = LAUNCH.map((e, i) => ({ n: i + 1, kind: `fe-launch-${i + 1}`, day: e.day, subject: e.subject }));
const DAY = 864e5;
const MIN_GAP = 20 * 3600e3;

export async function launchSettings() {
  const s = await getSettings();
  const delay = Number.parseFloat(s.fe_launch_delay_days ?? '3');
  return {
    enabled: s.fe_launch_enabled === 'on',
    // When it was switched on: the start for everybody who was a member then.
    startedAt: s.fe_launch_started_at || null,
    delayDays: Number.isFinite(delay) ? Math.min(Math.max(delay, 0), 60) : 3
  };
}

/** Who is due which email right now. `at` and `settings` are for tests. */
export async function dueNow({ at = Date.now(), settings: given } = {}) {
  const settings = given || await launchSettings();
  if (!settings.startedAt) return { settings, due: [], audience: 0 };
  const launch = new Date(settings.startedAt).getTime();

  const [people, opted, bounced, ...logs] = await Promise.all([
    funnelEngineLaunchAudience(), optOuts(), bouncedEmails(),
    ...STEPS.map((s) => outreachLog(s.kind))
  ]);
  const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));

  const due = [];
  for (const p of people) {
    if (blocked.has(String(p.email).toLowerCase())) continue;
    const joined = new Date(p.created_at).getTime();
    const start = Math.max(launch, joined + settings.delayDays * DAY);
    // The first email in the sequence they have not had yet.
    const next = STEPS.find((s) => !logs[s.n - 1].has(p.email));
    if (!next) continue;
    if (at < start + next.day * DAY) continue;
    const prev = next.n > 1 ? new Date(logs[next.n - 2].get(p.email)).getTime() : 0;
    if (prev && at - prev < MIN_GAP) continue;
    due.push({ email: p.email, name: p.name, step: next.n, kind: next.kind });
  }
  return { settings, due, audience: people.length };
}

/** Send what is due. Recorded only after each send succeeds. */
export async function runLaunch() {
  const { settings, due, audience } = await dueNow();
  if (!settings.enabled) return { enabled: false, audience, wouldSend: due.length };
  const sent = [], failed = [];
  for (const p of due) {
    try {
      await sendFunnelEngineLaunch(p.email, p.step, { name: p.name });
      await recordOutreach(p.email, p.kind);
      sent.push(`${p.kind}:${p.email}`);
    } catch (err) {
      console.error('[fe-launch] send failed', p.kind, p.email, err?.message || err);
      failed.push(p.email);
    }
  }
  return { enabled: true, audience, due: due.length, sent: sent.length, failed };
}
