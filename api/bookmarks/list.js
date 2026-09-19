import { readSession } from '../../lib/session.js';
import { isActive, listBookmarks } from '../../lib/db.js';

/** GET /api/bookmarks/list — this member's bookmarked lessons, newest first. */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const rows = await listBookmarks(email);
    return res.status(200).json({
      bookmarks: rows.map((r) => ({
        lessonId: r.lesson_id,
        course: r.course_slug,
        title: r.title,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('[bookmarks/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
