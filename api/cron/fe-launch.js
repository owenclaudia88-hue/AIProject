import { runLaunch, dueNow, launchSettings, STEPS } from '../../lib/fe-launch.js';
import { setSetting } from '../../lib/db.js';
import { sendFunnelEngineLaunch, sendRoadmapDeal } from '../../lib/email.js';
import { DEAL_HOURS, dealCheckoutUrl } from '../../lib/roadmap-deal.js';
import { runRoadmapDeals } from '../../lib/roadmap-deal-run.js';

/**
 * The Funnel Engine introduction (lib/fe-launch.js), run every 30 minutes.
 *
 * With the cron secret, by hand:
 *   ?dry=1             who is due which email right now, and nothing sent
 *   ?to=me@x&step=3    one email to one address, recording nothing
 *   ?to=me@x&step=all  all seven to one address, recording nothing
 *   ?on=1 / ?off=1     switch the sequence on or off. Switching on the first
 *                      time stamps the start for every existing member.
 *
 * Off until switched on: it writes to every member, so starting it is a
 * decision, not a deploy.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  const q = new URL(req.url, 'http://localhost').searchParams;
  try {
    if (q.get('on') === '1' || q.get('off') === '1') {
      const on = q.get('on') === '1';
      await setSetting('fe_launch_enabled', on ? 'on' : 'off');
      const s = await launchSettings();
      if (on && !s.startedAt) await setSetting('fe_launch_started_at', new Date().toISOString());
      return res.status(200).json({ ...(await launchSettings()) });
    }

    const to = (q.get('to') || '').trim().toLowerCase();
    // ?to=me@x&deal=all - the roadmap price's three emails, with a working
    // 48-hour link for that address. Records nothing.
    if (to && q.get('deal')) {
      const which = q.get('deal') === 'all' ? ['open', 'h24', 'h1'] : [q.get('deal')];
      const endsAt = Math.floor((Date.now() + DEAL_HOURS * 3600e3) / 60000) * 60000;
      const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
      for (const w of which) {
        await sendRoadmapDeal(to, w, { name: q.get('name') || null, url: dealCheckoutUrl(site, to, endsAt), endsAt });
      }
      return res.status(200).json({ test: true, sentTo: to, deal: which, note: 'nothing was recorded' });
    }
    if (to) {
      const which = q.get('step') === 'all' ? STEPS.map((s) => s.n) : [Number(q.get('step') || 1)];
      if (which.some((n) => !STEPS[n - 1])) return res.status(400).json({ error: 'step is 1-7 or all' });
      for (const n of which) await sendFunnelEngineLaunch(to, n, { name: q.get('name') || null });
      return res.status(200).json({ test: true, sentTo: to, steps: which, note: 'nothing was recorded' });
    }

    if (q.get('dry') === '1') {
      const { settings, due, audience } = await dueNow();
      const byStep = due.reduce((a, p) => ({ ...a, [p.kind]: (a[p.kind] || 0) + 1 }), {});
      const deals = await runRoadmapDeals({ dry: true });
      return res.status(200).json({ dry: true, ...settings, audience, due: due.length, byStep, roadmapDeals: deals });
    }

    // The roadmap members' price first: somebody inside its 48 hours is then
    // skipped by the introduction below rather than sent both.
    const roadmapDeals = await runRoadmapDeals();
    if (roadmapDeals.opened || roadmapDeals.reminded24 || roadmapDeals.reminded1) {
      console.log('[cron/fe-launch] roadmap deals', JSON.stringify(roadmapDeals));
    }
    const out = await runLaunch();
    if (out.sent) console.log(`[cron/fe-launch] sent ${out.sent}, ${out.failed.length} failed`);
    return res.status(200).json({ ...out, roadmapDeals });
  } catch (err) {
    console.error('[cron/fe-launch]', err);
    return res.status(500).json({ error: 'server' });
  }
}
