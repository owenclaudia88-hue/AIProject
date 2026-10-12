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
import { listReports, reportByNumber, saveReport, deleteReport } from '../../lib/db.js';
import { makeCover } from '../../lib/report-cover.js';
import { announceReport } from '../../lib/report-announce.js';
import { SOURCES } from '../../lib/report-sources.js';
import { del } from '@vercel/blob';

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
        sources: SOURCES.map((s) => ({ key: s.key, name: s.name }))
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});

    /* The test-cover button lived here. It existed to prove an image key
       worked; there is no image service any more, so there is no key to
       prove. The shelf cover is drawn in-process and cannot fail in a way a
       button would discover. */

    /* ---- run the pipeline now ---- */
    if (b.run) {
      if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set' });
      const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/+$/, '');
      /* force=1, because this one was pressed. The schedule stands down when a
         report has already gone out this week; a person asking for another has
         a reason the clock does not have. */
      const r = await fetch(`${site}/api/cron/report?force=1${b.dry ? '&dry=1' : ''}`, {
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

      /* Publishing by hand used to do only this — flip a column — so the
         report went live on the site and not one member was told about it.
         It rings the bell and sends the email now, exactly as Monday does.

         `announce: false` is for the second press: a report already sent out,
         taken down to fix a line and put back up, should not land in
         everybody's inbox twice. The bell is safe either way, since it
         refuses to ring twice for the same report number. */
      let told = null;
      if (b.publish && b.announce !== false) {
        try {
          const data = row.data || {};
          told = await announceReport({
            number: row.number, slug: row.slug, title: row.title,
            dek: data.dek, sixty: data.sixty || [], coverUrl: row.cover_url
          });
        } catch (err) {
          // The report is published either way; failing to announce it must
          // not read as a failure to publish, but it must be said.
          console.error('[admin/reports] could not announce', row.number, err.message);
          told = { error: err.message };
        }
      }

      return res.status(200).json({
        ok: true, status: b.publish ? 'published' : 'held', told
      });
    }

    /* ---- tell the members about one already published ----

       For the report that went live before any of this existed, and for the
       rare case where the send half failed while the publish half did not.
       It changes nothing about the report; it only announces it. The bell
       will not ring twice for the same report, so the cost of pressing it
       twice is a second email, not a second notification. */
    if (b.announce) {
      if (row.status !== 'published') {
        return res.status(400).json({ error: 'That report is not published yet.' });
      }
      const data = row.data || {};
      const told = await announceReport({
        number: row.number, slug: row.slug, title: row.title,
        dek: data.dek, sixty: data.sixty || [], coverUrl: row.cover_url
      });
      console.log(`[admin] ${email} announced report ${row.number}: `
        + `rang ${told.notified}, emailed ${told.emailed}`);
      return res.status(200).json({ ok: true, told });
    }

    /* ---- throw a test run away ----

       A run made for testing claims the week's news: every item it publishes
       is recorded as covered so next week does not repeat it. Delete the
       report and leave those behind and the real Monday run starves on the
       leftovers - which is exactly what happened, and why a scheduled report
       was held with two items hours after a test one went out.

       So removing a report releases what it claimed, in the same breath. The
       cover blob goes too; nothing points at it once the row is gone. */
    if (b.remove) {
      const removed = await deleteReport(n);
      if (!removed) return res.status(404).json({ error: 'not found' });

      if (row.cover_url) {
        try {
          const key = new URL(row.cover_url).searchParams.get('key');
          if (key) await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
        } catch (err) {
          // An orphaned blob is litter, not a failure; the report is gone.
          console.error('[admin/reports] cover blob not removed:', err?.message);
        }
      }

      return res.status(200).json({
        ok: true,
        removed: n,
        released: removed.released,
        wasPublished: row.status === 'published'
      });
    }

    /* ---- take something down ----

       This is the whole reason the source list exists. A publisher who asks us
       to stop showing their picture, or to drop an item altogether, is owed an
       answer in hours rather than on the next deploy - so it is two buttons on
       a screen rather than a code change and a release.

       Removing the picture leaves the item, its headline and the link back to
       them, which is usually what is actually being asked for. Removing the
       item takes the lot. */
    if (b.dropImage || b.dropItem) {
      const data = row.data && typeof row.data === 'object' ? row.data : {};
      const items = Array.isArray(data.items) ? data.items : [];
      const url = String(b.url || '');
      const target = items.find((i) => i && i.url === url);
      if (!target) return res.status(404).json({ error: 'no item with that link in this report' });

      const next = b.dropItem
        ? items.filter((i) => i.url !== url)
        : items.map((i) => (i.url === url ? { ...i, image: null } : i));

      await saveReport({
        number: row.number, slug: row.slug, title: row.title, topic: row.topic,
        status: row.status,
        data: {
          ...data,
          items: next,
          // The source list follows the items, or it stops being a record of
          // what is on the page.
          sources: next.map((i) => ({ name: i.sourceName, url: i.url })),
          // Kept so a second request about the same report can be answered
          // with what was done and when, rather than from memory.
          removals: [
            ...(Array.isArray(data.removals) ? data.removals : []),
            { url, what: b.dropItem ? 'item' : 'image', at: new Date().toISOString(), by: email }
          ]
        },
        coverUrl: row.cover_url, coverKind: row.cover_kind,
        model: row.model, stats: row.stats, fail: row.fail
      });

      return res.status(200).json({
        ok: true,
        removed: b.dropItem ? 'item' : 'image',
        itemsLeft: next.length
      });
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
