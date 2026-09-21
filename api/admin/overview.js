import { readSession } from '../../lib/session.js';
import { listAllRequests, listAllComments, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/admin/overview — everything the staff view needs in one call:
 * the content requests members have sent, and the comments they have left.
 * Refused outright for anyone not in ADMIN_EMAILS.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    // Staff are staff whether or not they ever bought the product.
    if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

    const [requests, comments] = await Promise.all([listAllRequests(), listAllComments(200)]);

    return res.status(200).json({
      requests: requests.map((r) => ({
        id: Number(r.id), title: r.title, body: r.body, status: r.status,
        from: displayNameFor(r.email, r.name), email: r.email, createdAt: r.created_at
      })),
      comments: comments.map((c) => ({
        id: Number(c.id), course: c.course_slug, lesson: c.lesson_title,
        isReply: c.parent_id != null, author: displayNameFor(c.email, c.name), email: c.email,
        isAdmin: c.is_admin, body: c.deleted_at ? '' : c.body,
        removed: !!c.deleted_at, createdAt: c.created_at
      }))
    });
  } catch (err) {
    console.error('[admin/overview]', err);
    return res.status(500).json({ error: 'server' });
  }
}
