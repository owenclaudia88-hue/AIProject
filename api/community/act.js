/**
 * POST /api/community/act — the small things done to a post.
 *
 *   { id, like: true }                     — like or unlike, toggling
 *   { id, resolved: bool, replyId? }       — mark a question answered
 *   { id, pinned: bool }                   — staff only
 *   { id, remove: true }                   — your own, or anything if staff
 *
 * One endpoint because these are four one-line actions on the same row, and
 * four files would be four copies of the same gate.
 */
import { communityMember } from '../../lib/community-access.js';
import { toggleLike, setResolved, setPinned, deleteComment } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const who = await communityMember(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });

  try {
    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
    const id = Number(b.id);
    if (!id) return res.status(400).json({ error: 'missing id' });

    if (b.like) {
      return res.status(200).json(await toggleLike(id, who.email));
    }

    if (typeof b.resolved === 'boolean') {
      // The scoping is in the query: a member's update only matches their own
      // row, so somebody else's question is not theirs to close.
      const done = await setResolved(id, {
        email: who.email, isAdmin: who.isAdmin,
        replyId: b.replyId, resolved: b.resolved
      });
      if (!done) return res.status(403).json({ error: 'not yours to mark' });
      return res.status(200).json({ ok: true, resolved: b.resolved });
    }

    if (typeof b.pinned === 'boolean') {
      if (!who.isAdmin) return res.status(403).json({ error: 'staff only' });
      const done = await setPinned(id, b.pinned);
      if (!done) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ ok: true, pinned: b.pinned });
    }

    if (b.remove) {
      const done = await deleteComment(id, { email: who.email, isAdmin: who.isAdmin });
      if (!done) return res.status(403).json({ error: 'not yours to remove' });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'nothing to do' });
  } catch (err) {
    console.error('[community/act]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
