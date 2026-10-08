/**
 * GET /api/community/thread?id=…  — one thread and everything under it.
 */
import { communityMember } from '../../lib/community-access.js';
import { getThread, listReplies } from '../../lib/db.js';
import { spaceFor, authorName } from '../../lib/community.js';

export default async function handler(req, res) {
  const who = await communityMember(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });

  try {
    const id = Number(new URL(req.url, 'http://localhost').searchParams.get('id'));
    if (!id) return res.status(400).json({ error: 'missing id' });

    const t = await getThread(id, { email: who.email, isAdmin: who.isAdmin });
    if (!t) return res.status(404).json({ error: 'not found' });

    const replies = await listReplies(id, { email: who.email, isAdmin: who.isAdmin });
    const space = spaceFor(t.space);

    return res.status(200).json({
      isAdmin: !!who.isAdmin,
      thread: {
        id: Number(t.id),
        space: t.space,
        spaceLabel: space?.label || t.space,
        resolvable: !!space?.resolvable,
        title: t.title || null,
        body: t.body,
        author: authorName(t.name, t.is_admin),
        isAdmin: !!t.is_admin,
        mine: !!t.mine,
        canDelete: !!t.mine || !!who.isAdmin,
        // Only the person who asked, or staff, may say it is answered.
        canResolve: !!space?.resolvable && (!!t.mine || !!who.isAdmin),
        likes: t.likes ?? 0,
        liked: !!t.liked,
        pinned: !!t.pinned_at,
        resolved: !!t.resolved_at,
        pending: !t.approved_at,
        resolvedReplyId: t.resolved_reply_id == null ? null : Number(t.resolved_reply_id),
        lesson: t.lesson_title || null,
        courseSlug: t.course_slug || null,
        lessonId: t.lesson_id || null,
        createdAt: t.created_at
      },
      replies: replies.map((r) => ({
        id: Number(r.id),
        // A removed reply that still has answers under it stays as a stub, so
        // the thread does not lose its shape.
        removed: !!r.deleted_at,
        body: r.deleted_at ? '' : r.body,
        author: r.deleted_at ? null : authorName(r.name, r.is_admin),
        isAdmin: !!r.is_admin,
        mine: !!r.mine,
        pending: !r.deleted_at && !r.approved_at,
        canDelete: !r.deleted_at && (!!r.mine || !!who.isAdmin),
        likes: r.likes ?? 0,
        liked: !!r.liked,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('[community/thread]', err);
    return res.status(500).json({ error: 'server' });
  }
}
