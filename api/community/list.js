/**
 * GET /api/community/list[?space=help]
 *
 * The spaces with their thread counts, and one space's feed. Both in one
 * response because the member area needs both to draw a page and two requests
 * would only make the sidebar counts lag a view behind.
 *
 * Emails never appear in what goes out — a display name and whether the thread
 * is the caller's own is everything the page needs, and a member list
 * harvested from a forum is the usual way an address book leaks.
 */
import { communityMember } from '../../lib/community-access.js';
import {
  listThreads, countThreadsBySpace, communityStats, listAllThreads, searchCommunity
} from '../../lib/db.js';
import { spaceList, SPACE_KEYS, canPostIn, authorName } from '../../lib/community.js';

export default async function handler(req, res) {
  const who = await communityMember(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });

  try {
    const url = new URL(req.url, 'http://localhost');
    const asked = url.searchParams.get('space');
    const space = SPACE_KEYS.includes(asked) ? asked : null;

    const counts = {};
    for (const row of await countThreadsBySpace()) counts[row.space] = row.n;

    const spaces = spaceList().map((s) => ({
      ...s, threads: counts[s.key] || 0, canPost: canPostIn(s.key, who)
    }));

    // Triage numbers, for staff only — a member has nothing to do with how
    // many questions are waiting for an answer.
    const stats = who.isAdmin ? await communityStats() : null;

    const base = { spaces, isAdmin: !!who.isAdmin, ...(stats ? { stats } : {}) };

    // A search, which crosses every room: somebody looking for an answer does
    // not know which one it was given in.
    const q = (url.searchParams.get('q') || '').trim();
    if (q) {
      const found = await searchCommunity(q, { email: who.email });
      return res.status(200).json({ ...base, q, space: 'search', threads: found.map((r) => shape(r, who)) });
    }

    // Everything, newest activity first. The default view, because four rooms
    // to check is three too many when you only want to know what is new.
    if (asked === 'all') {
      const rows = await listAllThreads({ email: who.email });
      return res.status(200).json({ ...base, space: 'all', threads: rows.map((r) => shape(r, who)) });
    }

    if (!space) return res.status(200).json(base);

    const rows = await listThreads(space, {
      email: who.email,
      before: url.searchParams.get('before') || null
    });

    return res.status(200).json({ ...base, space, threads: rows.map((r) => shape(r, who)) });
  } catch (err) {
    console.error('[community/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}

export function shape(r, who) {
  return {
    id: Number(r.id),
    space: r.space,
    title: r.title || null,
    body: r.body,
    // Never derived from an email. The usual fallback is the local part of an
    // address, which is fine on a course discussion between people who bought
    // the same thing and not fine on a forum, where it would put a fragment of
    // everybody's email beside their posts.
    author: authorName(r.name, r.is_admin),
    isAdmin: !!r.is_admin,
    mine: !!r.mine,
    // So the admin's moderation and a member's own tidying both work off one
    // field rather than the page re-deriving the rule.
    canDelete: !!r.mine || !!who.isAdmin,
    replies: r.replies ?? 0,
    // Only staff act on this, and it tells them nothing about another member
    // they could not already see, so it is sent to everybody rather than
    // shaped differently per caller.
    staffReplies: r.staff_replies ?? 0,
    likes: r.likes ?? 0,
    liked: !!r.liked,
    pinned: !!r.pinned_at,
    resolved: !!r.resolved_at,
    // Present only on a question that came in through a lesson, so the feed
    // can say where it was asked.
    lesson: r.lesson_title || null,
    courseSlug: r.course_slug || null,
    lessonId: r.lesson_id || null,
    createdAt: r.created_at,
    lastAt: r.last_at || r.created_at
  };
}
