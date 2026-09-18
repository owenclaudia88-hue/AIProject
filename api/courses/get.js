import { readSession } from '../../lib/session.js';
import { isActive, getCourse } from '../../lib/db.js';

/**
 * GET /api/courses/get?slug=…  — one course's full section/lesson tree, for the
 * player. Lesson bodies are fetched separately via /api/library/item.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const slug = new URL(req.url, 'http://localhost').searchParams.get('slug');
    if (!slug) return res.status(400).json({ error: 'missing slug' });

    const row = await getCourse(slug);
    if (!row) return res.status(404).json({ error: 'not found' });

    const data = row.data || {};
    return res.status(200).json({
      slug: row.slug, title: row.title,
      lessonCount: row.lesson_count,
      sections: data.sections || [],
      stats: data.stats || null
    });
  } catch (err) {
    console.error('[courses/get]', err);
    return res.status(500).json({ error: 'server' });
  }
}
