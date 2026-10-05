/**
 * The admin's side of the weekly writer.
 *
 *   GET  /api/admin/drafts            — everything waiting to be read
 *   GET  /api/admin/drafts?id=…       — one, in full, to actually read
 *   POST { id, publish: true }        — let it into the library
 *   POST { id, discard: true }        — throw it away
 *   POST { run: true, dry?: true }    — write this week's now
 *
 * The run calls the same handler the Tuesday cron calls, with the cron secret,
 * so there is one writer rather than two that drift - the arrangement the
 * weekly report already uses.
 *
 * Publishing is the only thing here that reaches a member, and it is the one
 * thing no schedule does. That is the point of the whole arrangement: the
 * machine writes, a person decides.
 */
import { sessionEmail } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { draftItems, draftItem, publishDraft, discardDraft, publishedSince } from '../../lib/db.js';

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'staff only' });

  try {
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (id) {
        const row = await draftItem(id);
        if (!row) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ draft: row });
      }
      const [waiting, recent] = await Promise.all([draftItems(), publishedSince(14)]);
      return res.status(200).json({
        drafts: waiting,
        // What the writer has already got past this screen, so the admin can
        // see the cadence rather than only the queue.
        recent,
        canRun: !!process.env.ANTHROPIC_API_KEY && !!process.env.CRON_SECRET
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'GET or POST' });
    }

    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});

    if (b.run) {
      if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set' });
      const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/+$/, '');
      const want = Math.max(1, Math.min(5, Number(b.want) || 4));
      const r = await fetch(`${site}/api/cron/library?want=${want}${b.dry ? '&dry=1' : ''}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });
      const out = await r.json().catch(() => ({ error: 'the run returned nothing readable' }));
      return res.status(200).json({ ok: r.ok, ...out });
    }

    const id = String(b.id || '');
    if (!id) return res.status(400).json({ error: 'which draft?' });

    if (b.publish) {
      const row = await publishDraft(id);
      if (!row) return res.status(404).json({ error: 'not found, or already published' });
      console.log(`[drafts] ${email} published "${row.title}"`);
      return res.status(200).json({ ok: true, published: row });
    }

    if (b.discard) {
      const gone = await discardDraft(id);
      if (!gone) return res.status(404).json({ error: 'not found' });
      console.log(`[drafts] ${email} discarded ${id}`);
      return res.status(200).json({ ok: true, discarded: id });
    }

    return res.status(400).json({ error: 'publish, discard or run?' });
  } catch (err) {
    console.error('[admin/drafts]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 200) });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
