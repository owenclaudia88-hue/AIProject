import { sessionEmail } from '../../lib/session.js';
import {
  listAllRequests, listAllComments, listPendingComments, displayNameFor
} from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/admin/overview — everything the staff view needs in one call:
 * the content requests members have sent, the comments they have left, and
 * whatever is waiting to be approved. Refused outright for anyone not in
 * ADMIN_EMAILS.
 */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    // Staff are staff whether or not they ever bought the product.
    if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

    const [requests, comments, pending] = await Promise.all([
      listAllRequests(), listAllComments(200), listPendingComments(200)
    ]);

    return res.status(200).json({
      requests: requests.map((r) => ({
        id: Number(r.id), title: r.title, body: r.body, status: r.status,
        from: displayNameFor(r.email, r.name), email: r.email, createdAt: r.created_at
      })),
      comments: comments.map((c) => ({
        id: Number(c.id), course: c.course_slug, lesson: c.lesson_title,
        isReply: c.parent_id != null, author: displayNameFor(c.email, c.name), email: c.email,
        isAdmin: c.is_admin, body: c.deleted_at ? '' : c.body,
        removed: !!c.deleted_at,
        // Where in the queue it got to, so the full list can say why something
        // is not on the site rather than showing it as though it were.
        pending: !c.deleted_at && !c.approved_at && !c.rejected_at,
        rejected: !!c.rejected_at,
        createdAt: c.created_at
      })),
      // The queue itself, oldest first — see listPendingComments.
      pending: pending.map((c) => ({
        id: Number(c.id),
        // A community post has a space and no course; a lesson comment is the
        // other way round. Both are sent, and the page shows whichever is set.
        course: c.course_slug, lesson: c.lesson_title, space: c.space,
        title: c.title || null,
        isReply: c.parent_id != null,
        // The post being answered, so a reply can be judged against its
        // question instead of on its own.
        parentTitle: c.parent_title || null,
        parentBody: c.parent_body || null,
        author: displayNameFor(c.email, c.name), email: c.email,
        isAdmin: c.is_admin, body: c.body, createdAt: c.created_at
      }))
    });
  } catch (err) {
    console.error('[admin/overview]', err);
    return res.status(500).json({ error: 'server' });
  }
}
