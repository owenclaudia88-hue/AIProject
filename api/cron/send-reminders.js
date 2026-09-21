import { reminderSettings, eligibleForReminder, sendRemindersTo } from '../../lib/reminders.js';

/**
 * The scheduled run, called by Vercel Cron every 15 minutes.
 *
 * It does not "fire two hours later" in any literal sense — nothing is
 * queued. Each run asks who abandoned a checkout more than the configured
 * wait ago and has not been written to, which gets the same result and
 * survives a missed run, a redeploy, or the wait being changed after the
 * fact.
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
    const { enabled, delayHours } = await reminderSettings();
    if (!enabled) return res.status(200).json({ ok: true, skipped: 'reminders are switched off' });

    const cutoff = Date.now() - delayHours * 3600 * 1000;
    const due = (await eligibleForReminder())
      .filter((p) => new Date(p.createdAt).getTime() <= cutoff);

    if (!due.length) return res.status(200).json({ ok: true, sent: 0, due: 0 });

    const { sent, skipped } = await sendRemindersTo(due);
    console.log(`[cron] sent ${sent.length} checkout reminder(s), ${skipped.length} failed`);
    return res.status(200).json({ ok: true, sent: sent.length, failed: skipped.length, delayHours });
  } catch (err) {
    console.error('[cron/send-reminders]', err);
    return res.status(500).json({ error: 'server' });
  }
}
