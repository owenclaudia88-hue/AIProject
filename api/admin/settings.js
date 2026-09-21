import { readSession } from '../../lib/session.js';
import { setSetting } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { reminderSettings, STEPS } from '../../lib/reminders.js';

/**
 * GET  /api/admin/settings  — the current knobs
 * POST /api/admin/settings  { enabled, delays: {<key>: hours}, regularPriceLabel }
 *
 * Kept in the database rather than the environment so staff can change the
 * waits without a redeploy, and so a change takes effect on the next scheduled
 * run rather than whenever the site next ships.
 */
export default async function handler(req, res) {
  const actor = readSession(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    if (req.method === 'GET') return res.status(200).json(await reminderSettings());

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

      if (typeof body.enabled === 'boolean') {
        await setSetting('reminderEnabled', body.enabled ? 'on' : 'off');
      }

      const delays = body.delays && typeof body.delays === 'object' ? body.delays : {};
      for (const step of STEPS) {
        if (delays[step.delayKey] === undefined) continue;
        const hours = Number.parseFloat(delays[step.delayKey]);
        if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) {
          return res.status(400).json({ error: `${step.label}: the wait must be between 15 minutes (0.25) and 7 days (168).` });
        }
        await setSetting(step.delayKey, String(hours));
      }

      if (body.regularPriceLabel !== undefined) {
        // Shown in the follow-up as the price the launch offer will rise to.
        // Blank removes the line rather than printing an empty price.
        await setSetting('regularPriceLabel', String(body.regularPriceLabel).trim().slice(0, 24));
      }

      const now = await reminderSettings();
      console.log(`[admin] ${actor} set reminders ${now.enabled ? 'on' : 'off'} — ` +
        now.steps.map((s) => `${s.kind}:${s.delayHours}h`).join(' '));
      return res.status(200).json(now);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('[admin/settings]', err);
    return res.status(500).json({ error: 'server' });
  }
}
