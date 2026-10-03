/**
 * GET  /api/notifications              — the bell: the latest, and the unread count
 * POST /api/notifications { id? }      — mark one read, or all of them
 * POST /api/notifications { email: bool } — turn reply emails on or off
 *
 * Behind the same gate as the community, because that is the only thing that
 * produces a notification: nobody who cannot reach the community can have one
 * waiting.
 */
import { communityMember } from '../lib/community-access.js';
import {
  listNotifications, markNotificationsRead, notifyEmailSetting, setNotifyEmail
} from '../lib/db.js';

export default async function handler(req, res) {
  const who = await communityMember(req);
  if (who.error) return res.status(who.status).json({ error: who.error, message: who.message });

  try {
    if (req.method === 'GET') {
      const { rows, unread } = await listNotifications(who.email);
      return res.status(200).json({
        unread,
        emailOn: await notifyEmailSetting(who.email),
        notifications: rows.map((n) => ({
          id: Number(n.id),
          kind: n.kind,
          threadId: n.thread_id == null ? null : Number(n.thread_id),
          actor: n.actor_name || 'Someone',
          title: n.title || null,
          read: !!n.read_at,
          createdAt: n.created_at
        }))
      });
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});

      if (typeof b.email === 'boolean') {
        return res.status(200).json({ ok: true, emailOn: await setNotifyEmail(who.email, b.email) });
      }

      // No id means "I have seen all of these", which is what opening the
      // panel says.
      const unread = await markNotificationsRead(who.email, b.id ? Number(b.id) : null);
      return res.status(200).json({ ok: true, unread });
    }

    return res.status(405).json({ error: 'GET or POST' });
  } catch (err) {
    console.error('[notifications]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
