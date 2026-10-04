/**
 * The member's side of the weekly AI report.
 *
 *   GET /api/reports            — the library, newest first
 *   GET /api/reports?n=11       — one report
 *
 * Read-only. Reports are written by the Monday job and by nobody else.
 */
import { reportReader } from '../lib/report-access.js';
import { listReports, reportByNumber } from '../lib/db.js';

export default async function handler(req, res) {
  const who = await reportReader(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const n = Number(url.searchParams.get('n'));

    if (n) {
      const row = await reportByNumber(n);
      if (!row) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({
        report: {
          ...row.data,
          number: row.number, slug: row.slug, title: row.title, topic: row.topic,
          coverUrl: row.cover_url, publishedAt: row.published_at
        }
      });
    }

    const rows = await listReports({ limit: 60 });
    return res.status(200).json({
      reports: rows.map((r) => ({
        number: r.number, slug: r.slug, title: r.title, topic: r.topic,
        coverUrl: r.cover_url, publishedAt: r.published_at,
        dek: typeof r.dek === 'string' ? r.dek : '',
        // The card shows how much is in it without sending the whole thing.
        items: Array.isArray(r.items) ? r.items.length : 0
      }))
    });
  } catch (err) {
    console.error('[reports]', err);
    return res.status(500).json({ error: 'server' });
  }
}
