/**
 * POST /api/community/post
 *   { space, title, body }   — start a thread
 *   { parentId, body }       — reply to one
 *
 * The body arrives as markup, because members write it in a formatting editor.
 * It is cut down to a short list of tags before it is stored, so what sits in
 * the database is already safe and a mistake somewhere else cannot turn it into
 * a page that runs something.
 */
import { communityMember } from '../../lib/community-access.js';
import {
  createThread, createReply, setCustomerName, getCustomer,
  threadsPostedSince, notifyReply, notifyStaffQuestion
} from '../../lib/db.js';
import { adminEmails } from '../../lib/admin.js';
import { sanitizeHtml, htmlIsEmpty } from '../../lib/sanitize-html.js';
import { canPostIn, SPACE_KEYS, authorName } from '../../lib/community.js';

const MAX_BODY = 8000;
const MAX_TITLE = 140;
// Enough for a busy day, not enough to fill the place overnight. Staff are not
// capped: announcements go out in bursts.
const THREADS_PER_HOUR = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const who = await communityMember(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });

  try {
    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
    const raw = typeof b.body === 'string' ? b.body.trim() : '';
    if (raw.length > MAX_BODY * 4) return res.status(400).json({ error: 'that is too long' });

    const body = sanitizeHtml(raw, { maxLength: MAX_BODY });
    if (htmlIsEmpty(body)) return res.status(400).json({ error: 'write something first' });

    // A member may name themselves on their first post, as on course comments.
    if (b.displayName) await setCustomerName(who.email, b.displayName);

    /* ---- a reply ---- */
    if (b.parentId != null && b.parentId !== '') {
      const row = await createReply({
        parentId: Number(b.parentId), body, email: who.email, isAdmin: who.isAdmin
      });
      // Null means the thread was deleted between opening it and pressing send.
      if (!row) return res.status(404).json({ error: 'that thread is no longer there' });

      const customer = await getCustomer(who.email);
      const author = authorName(customer?.name, who.isAdmin);

      // The person who asked, and the person being answered if that is
      // somebody else. notifyReply drops duplicates and never tells the writer
      // about their own reply, so both can be handed over without checking.
      //
      // Only once it is live, though. Telling somebody they have an answer and
      // then showing them a thread with nothing new in it is worse than
      // telling them a few minutes later: the notification is sent on approval
      // instead, which is the moment it becomes true.
      const told = row.approved_at ? await notifyReply({
        to: [row.threadAuthor, row.repliedTo],
        actorEmail: who.email,
        actorName: author,
        threadId: row.threadId,
        commentId: row.id,
        title: row.threadTitle
      }).catch(function (err) { console.error('[community/post] notify', err); return 0; }) : 0;

      return res.status(200).json({
        reply: {
          id: Number(row.id),
          body: row.body ?? body,
          author,
          isAdmin: !!who.isAdmin,
          mine: true, canDelete: true, removed: false,
          pending: !row.approved_at,
          likes: 0, liked: false,
          createdAt: row.created_at
        },
        notified: told
      });
    }

    /* ---- a new thread ---- */
    const space = typeof b.space === 'string' ? b.space : '';
    if (!SPACE_KEYS.includes(space)) return res.status(400).json({ error: 'unknown space' });
    if (!canPostIn(space, who)) {
      return res.status(403).json({ error: 'Only staff can start a thread in that space.' });
    }

    const title = typeof b.title === 'string' ? b.title.trim().slice(0, MAX_TITLE) : '';
    if (!title) return res.status(400).json({ error: 'give it a title' });

    if (!who.isAdmin && (await threadsPostedSince(who.email, 60)) >= THREADS_PER_HOUR) {
      return res.status(429).json({ error: 'You have posted a lot in the last hour. Try again shortly.' });
    }

    const row = await createThread({ space, title, body, email: who.email, isAdmin: who.isAdmin });
    const customer = await getCustomer(who.email);
    const name = authorName(customer?.name, who.isAdmin);

    // A question nobody has seen is the one thing staff need telling about:
    // there is no reply yet, so notifyReply would never fire, and an unanswered
    // question is the only thing in here with a clock on it.
    //
    // Sent whether or not it has been approved, unlike the reply above. This
    // one goes to staff, and a question waiting for approval is precisely what
    // staff need to hear about - holding it back until approval would mean
    // waiting to be told about the thing being waited on.
    if (space === 'help' && !who.isAdmin) {
      await notifyStaffQuestion({
        staff: adminEmails(),
        actorEmail: who.email,
        actorName: name,
        threadId: row.id,
        title: row.title
      }).catch(function (err) { console.error('[community/post] notify staff', err); });
    }

    return res.status(200).json({
      thread: {
        id: Number(row.id),
        space: row.space,
        title: row.title,
        body: row.body,
        author: name,
        isAdmin: !!who.isAdmin,
        mine: true, canDelete: true,
        pending: !row.approved_at,
        replies: 0, likes: 0, liked: false,
        pinned: false, resolved: false,
        lesson: null,
        createdAt: row.created_at,
        lastAt: row.created_at
      }
    });
  } catch (err) {
    console.error('[community/post]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
