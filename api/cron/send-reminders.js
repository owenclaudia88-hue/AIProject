import { reminderSettings, dueFor, sendStepTo } from '../../lib/reminders.js';

/**
 * The scheduled run, called by Vercel Cron every 15 minutes.
 *
 * It does not "fire two hours later" in any literal sense — nothing is
 * queued. Each run asks who is now overdue for each step of the sequence,
 * which gets the same result and survives a missed run, a redeploy, or the
 * wait being changed after the fact.
 *
 * Steps run newest-first so that someone who becomes due for both in the same
 * run gets the follow-up on the next pass rather than two emails at once.
 *
 * Vercel sends CRON_SECRET as a bearer token. Without that set the route is
 * refused outright rather than left open — an unauthenticated endpoint that
 * sends email is a gift to anyone who finds it.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/send-reminders] CRON_SECRET is not set — refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const settings = await reminderSettings();
    if (!settings.enabled) return res.status(200).json({ ok: true, skipped: 'reminders are switched off' });

    const report = {};
    // Later steps first: a person who has just been sent step one is not
    // then immediately sent step two in the same pass.
    for (const step of [...settings.steps].reverse()) {
      const due = await dueFor(step.kind, step.delayHours);
      if (!due.length) { report[step.kind] = { due: 0, sent: 0 }; continue; }

      const { sent, skipped } = await sendStepTo(step.kind, due, {
        regularPriceLabel: settings.regularPriceLabel
      });
      report[step.kind] = { due: due.length, sent: sent.length, failed: skipped.length };
      console.log(`[cron] ${step.kind}: sent ${sent.length}, ${skipped.length} failed`);
    }

    return res.status(200).json({ ok: true, ...report });
  } catch (err) {
    console.error('[cron/send-reminders]', err);
    return res.status(500).json({ error: 'server' });
  }
}
