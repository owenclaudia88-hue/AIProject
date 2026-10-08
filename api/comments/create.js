import { sessionEmail } from '../../lib/session.js';
import { isActive, createComment, setCustomerName, getCustomer, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { sanitizeHtml, htmlIsEmpty } from '../../lib/sanitize-html.js';

const MAX_BODY = 4000;

/**
 * POST /api/comments/create
 * { course, lessonId?, lessonTitle?, parentId?, body, displayName? }
 *
 * `displayName` is only honoured the first time — it is how a member names
 * themselves before their first post.
 *
 * The body arrives as markup, because members write it in a formatting editor.
 * It is cut down here to a short list of tags before it is stored, so what sits
 * in the database is already safe and a second mistake somewhere else cannot
 * turn it into a page that runs something.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    // Staff have never bought anything, so a membership cannot be the test for
    // them. Same rule the delete endpoint already uses.
    const staff = isAdmin(email);
    if (!staff && !(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const course = typeof b.course === 'string' ? b.course.trim() : '';
    const raw = typeof b.body === 'string' ? b.body.trim() : '';
    if (!course) return res.status(400).json({ error: 'missing course' });
    if (raw.length > MAX_BODY * 4) return res.status(400).json({ error: 'comment too long' });

    // Whatever arrives, only this survives.
    const body = sanitizeHtml(raw, { maxLength: MAX_BODY });
    if (htmlIsEmpty(body)) return res.status(400).json({ error: 'empty comment' });

    if (b.displayName) await setCustomerName(email, b.displayName);
    const customer = await getCustomer(email);

    const row = await createComment({
      courseSlug: course,
      lessonId: typeof b.lessonId === 'string' ? b.lessonId.slice(0, 200) : null,
      lessonTitle: typeof b.lessonTitle === 'string' ? b.lessonTitle.slice(0, 300) : null,
      parentId: Number.isFinite(Number(b.parentId)) && b.parentId != null ? Number(b.parentId) : null,
      email,
      isAdmin: staff,
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
        // Told plainly, so the page can say it is waiting rather than show it
        // as live and leave the writer wondering why nobody answered.
        pending: !row.approved_at,
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
