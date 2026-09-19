import { readSession } from '../../lib/session.js';
import { isActive, listComments, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/comments/list?course=…  — the whole discussion for one course.
 *
 * Every member sees every comment, so the response carries display names only —
 * never another member's email address. `mine` tells the browser which ones it
 * is allowed to offer a delete button for.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const course = new URL(req.url, 'http://localhost').searchParams.get('course');
    if (!course) return res.status(400).json({ error: 'missing course' });

    const me = String(email).toLowerCase();
    const admin = isAdmin(email);
    const rows = await listComments(course);

    const comments = rows.map((r) => ({
      id: Number(r.id),
      parentId: r.parent_id == null ? null : Number(r.parent_id),
      lessonId: r.lesson_id,
      lessonTitle: r.lesson_title,
      author: r.deleted_at ? '' : displayNameFor(r.email, r.name),
      isAdmin: r.deleted_at ? false : r.is_admin,
      body: r.deleted_at ? '' : r.body,
      removed: !!r.deleted_at,
      mine: !r.deleted_at && String(r.email).toLowerCase() === me,
      canDelete: !r.deleted_at && (admin || String(r.email).toLowerCase() === me),
      createdAt: r.created_at
    }));

    return res.status(200).json({ course, comments, isAdmin: admin });
  } catch (err) {
    console.error('[comments/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
