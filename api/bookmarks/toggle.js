import { readSession } from '../../lib/session.js';
import { isActive, toggleBookmark } from '../../lib/db.js';

/**
 * POST /api/bookmarks/toggle  { lessonId, course, title? }
 * Returns { bookmarked } — the state the lesson ended up in.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const lessonId = typeof b.lessonId === 'string' ? b.lessonId.trim() : '';
    const course = typeof b.course === 'string' ? b.course.trim() : '';
    if (!lessonId || !course) return res.status(400).json({ error: 'missing lessonId or course' });

    const bookmarked = await toggleBookmark(email, {
      lessonId,
      courseSlug: course,
      title: typeof b.title === 'string' ? b.title.slice(0, 300) : null
    });
    return res.status(200).json({ bookmarked });
  } catch (err) {
    console.error('[bookmarks/toggle]', err);
    return res.status(500).json({ error: 'server' });
  }
}
