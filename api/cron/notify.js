/**
 * Sends the community's reply emails, called by Vercel Cron.
 *
 * Not sent on the request that creates the reply, for two reasons. The member
 * pressing Post should not wait on an email service, and a thread that
 * collects four replies in five minutes should produce one email rather than
 * four — which falls out naturally from batching whatever has accumulated.
 *
 * Vercel sends CRON_SECRET as a bearer token. Without that set the route is
 * refused outright rather than left open: an unauthenticated endpoint that
 * sends email is a gift to anyone who finds it.
 */
import {
  pendingNotifications, markNotificationsEmailed, optOuts, bouncedEmails
} from '../../lib/db.js';
import { sendReplyNotification } from '../../lib/email.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/notify] CRON_SECRET is not set — refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const pending = await pendingNotifications();
    if (!pending.length) return res.status(200).json({ sent: 0, skipped: 0 });

    // The same suppression the reminders respect. These go out on the domain
    // that also sends receipts and sign-in links, so anything that would hurt
    // its reputation is not worth one notification email.
    const [opted, bounced] = await Promise.all([optOuts(), bouncedEmails()]);
    const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));

    // One email per member, covering everything waiting for them.
    const byMember = new Map();
    for (const row of pending) {
      if (!byMember.has(row.email)) byMember.set(row.email, []);
      byMember.get(row.email).push(row);
    }

    let sent = 0, skipped = 0;
    const done = [];

    for (const [email, rows] of byMember) {
      const ids = rows.map((r) => Number(r.id));

      // Marked as handled either way. A notification nobody is going to be
      // emailed about should not be reconsidered on every run for ever; the
      // bell still shows it, which is the part they have not opted out of.
      if (blocked.has(String(email).toLowerCase()) || rows[0].wants_email === false) {
        skipped += ids.length;
        done.push(...ids);
        continue;
      }

      try {
        await sendReplyNotification(email, {
          name: rows[0].name,
          items: rows.map((r) => ({
            threadId: r.thread_id == null ? null : Number(r.thread_id),
            title: r.title,
            actor: r.actor_name || 'Someone'
          }))
        });
        sent += ids.length;
        done.push(...ids);
      } catch (err) {
        // Left unmarked on purpose, so the next run tries again. A send that
        // failed is not a notification that was delivered.
        console.error('[cron/notify] send failed for one member', err?.message || err);
      }
    }

    await markNotificationsEmailed(done);
    return res.status(200).json({ sent, skipped, members: byMember.size });
  } catch (err) {
    console.error('[cron/notify]', err);
    return res.status(500).json({ error: 'server' });
  }
}
