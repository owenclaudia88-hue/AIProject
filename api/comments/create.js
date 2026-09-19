import { readSession } from '../../lib/session.js';
import { isActive, createComment, setCustomerName, getCustomer, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

const MAX_BODY = 4000;

/**
 * POST /api/comments/create
 * { course, lessonId?, lessonTitle?, parentId?, body, displayName? }
 *
 * `displayName` is only honoured the first time — it is how a member names
 * themselves before their first post. The body is stored as plain text and is
 * escaped by the browser on render; no HTML is ever interpreted.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const course = typeof b.course === 'string' ? b.course.trim() : '';
    const body = typeof b.body === 'string' ? b.body.trim() : '';
    if (!course) return res.status(400).json({ error: 'missing course' });
    if (!body) return res.status(400).json({ error: 'empty comment' });
    if (body.length > MAX_BODY) return res.status(400).json({ error: 'comment too long' });

    if (b.displayName) await setCustomerName(email, b.displayName);
    const customer = await getCustomer(email);

    const row = await createComment({
      courseSlug: course,
      lessonId: typeof b.lessonId === 'string' ? b.lessonId.slice(0, 200) : null,
      lessonTitle: typeof b.lessonTitle === 'string' ? b.lessonTitle.slice(0, 300) : null,
      parentId: Number.isFinite(Number(b.parentId)) && b.parentId != null ? Number(b.parentId) : null,
      email,
      isAdmin: isAdmin(email),
      body
    });

    return res.status(200).json({
      comment: {
        id: Number(row.id),
        parentId: row.parent_id == null ? null : Number(row.parent_id),
        lessonId: row.lesson_id,
        lessonTitle: row.lesson_title,
        author: displayNameFor(email, customer?.name),
        isAdmin: row.is_admin,
        body: row.body,
        removed: false,
        mine: true,
        canDelete: true,
        createdAt: row.created_at
      }
    });
  } catch (err) {
    console.error('[comments/create]', err);
    return res.status(500).json({ error: 'server' });
  }
}
