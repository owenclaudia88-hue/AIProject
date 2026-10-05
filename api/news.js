import { listNews, countNews, NEWS_WINDOW_DAYS } from '../lib/db.js';
import { newsReader } from '../lib/news-access.js';

/**
 * GET /api/news?q=&page=
 *
 * The feed the member area draws. Everything here was written by somebody
 * else: the headline, the summary and the picture are the publisher's, the
 * picture is pointed at rather than copied, and the only thing we add is the
 * order they are in and a box to search them with.
 *
 * Paged rather than all at once. Three months of twenty-odd sources is a few
 * thousand rows, and a member on a phone should not be sent all of them to
 * read the first six.
 */
const PAGE = 24;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const who = await newsReader(req);
  if (who.error) {
    return res.status(who.status).json({ error: who.error, message: who.message });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const q = String(url.searchParams.get('q') || '').slice(0, 120);
    const page = Math.max(1, Math.min(200, Number(url.searchParams.get('page')) || 1));
    const offset = (page - 1) * PAGE;

    const [items, total] = await Promise.all([
      listNews({ q, limit: PAGE, offset }),
      countNews(q)
    ]);

    return res.status(200).json({
      ok: true,
      windowDays: NEWS_WINDOW_DAYS,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      items: items.map((r) => ({
        url: r.url,
        title: r.title,
        summary: r.summary,
        source: r.source,
        sourceName: r.source_name,
        image: r.image_url ? { url: r.image_url, alt: r.image_alt || '' } : null,
        tags: r.tags || [],
        publishedAt: r.published_at
      }))
    });
  } catch (err) {
    console.error('[news]', err);
    return res.status(500).json({ error: 'server', message: 'Could not load the news feed.' });
  }
}
