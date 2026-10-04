/**
 * The admin's side of the weekly AI report.
 *
 *   GET  /api/admin/reports              — every report, held ones included
 *   GET  /api/admin/reports?n=11         — one, with what failed if it was held
 *   POST { n, publish: true }            — publish a held report by hand
 *   POST { n, hold: true }               — take a published one back down
 *   POST { run: true, dry?: true }       — run the pipeline now rather than waiting for Monday
 *   POST { testCover: true }             — one cover, to prove the image key works
 *
 * The run is the same handler the cron calls, invoked with the cron secret, so
 * there is one pipeline rather than two that drift.
 */
import { sessionEmail } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { listReports, reportByNumber, saveReport } from '../../lib/db.js';
import { makeCover } from '../../lib/report-cover.js';
import { SOURCES } from '../../lib/report-sources.js';

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'staff only' });

  try {
    if (req.method === 'GET') {
      const n = Number(new URL(req.url, 'http://localhost').searchParams.get('n'));
      if (n) {
        const row = await reportByNumber(n, { publishedOnly: false });
        if (!row) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ report: shape(row, true) });
      }
      const rows = await listReports({ all: true, limit: 100 });
      return res.status(200).json({
        reports: rows.map((r) => shape(r, false)),
        // So the screen can say why a button will not work before it is pressed.
        canRun: !!process.env.ANTHROPIC_API_KEY && !!process.env.CRON_SECRET,
        hasImageKey: !!(process.env.HIGGSFIELD_API_KEY || process.env.HIGGSFIELD_KEY_ID),
        sources: SOURCES.map((s) => ({ key: s.key, name: s.name }))
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});

    /* ---- one cover, to prove the key ---- */
    if (b.testCover) {
      const started = Date.now();
      const cover = await makeCover({
        number: 0, title: 'A test cover for AI Founder University', topic: 'what-changed'
      });
      return res.status(200).json({
        ok: true, ...cover, ms: Date.now() - started,
        // "drawn" when there is no usable key, or when generation did not
        // finish - either way the report would still have gone out.
        note: cover.kind === 'higgsfield'
          ? 'Higgsfield answered and the image is in your blob store.'
          : 'Fell back to the drawn cover. Check HIGGSFIELD_API_KEY holds "id:secret", and the logs for why.'
      });
    }

    /* ---- run the pipeline now ---- */
    if (b.run) {
      if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set' });
      const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/+$/, '');
      const r = await fetch(`${site}/api/cron/report${b.dry ? '?dry=1' : ''}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });
      const out = await r.json().catch(() => ({ error: 'the run returned nothing readable' }));
      return res.status(200).json({ ok: r.ok, ...out });
    }

    /* ---- publish or hold by hand ---- */
    const n = Number(b.n);
    if (!n) return res.status(400).json({ error: 'which report?' });
    const row = await reportByNumber(n, { publishedOnly: false });
    if (!row) return res.status(404).json({ error: 'not found' });

    if (b.publish || b.hold) {
      await saveReport({
        number: row.number, slug: row.slug, title: row.title, topic: row.topic,
        status: b.publish ? 'published' : 'held',
        data: row.data, coverUrl: row.cover_url, coverKind: row.cover_kind,
        model: row.model, stats: row.stats, fail: b.publish ? null : row.fail
      });
      return res.status(200).json({ ok: true, status: b.publish ? 'published' : 'held' });
    }

    return res.status(400).json({ error: 'nothing to do' });
  } catch (err) {
    console.error('[admin/reports]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}

function shape(r, full) {
  return {
    number: r.number, slug: r.slug, title: r.title, topic: r.topic, status: r.status,
    coverUrl: r.cover_url, coverKind: r.cover_kind, model: r.model,
    publishedAt: r.published_at, createdAt: r.created_at,
    stats: r.stats || {}, fail: r.fail || null,
    ...(full ? { data: r.data } : {})
  };
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
