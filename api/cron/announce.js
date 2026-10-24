import { reportAudience, optOuts, bouncedEmails, listEntitled, outreachLog, recordOutreach } from '../../lib/db.js';
import { sendPromiseBuilder } from '../../lib/email.js';
import { ALL_ACCESS } from '../../lib/products.js';

/**
 * One-off announcements to every member, sent by hand with the cron secret.
 *
 *   ?a=promise-builder&dry=1           how many get each version, nothing sent
 *   ?a=promise-builder&to=me@x         both versions to one address, nothing recorded
 *   ?a=promise-builder&send=1          everybody, each once
 *
 * Everybody is every active member who takes our emails, less unsubscribes
 * and dead addresses. Each send is recorded, so running it twice reaches only
 * the ones the first run missed. Not on a schedule: an announcement is a
 * decision, not a deploy.
 */
const ANNOUNCEMENTS = {
  'promise-builder': { kind: 'announce-promise-builder', send: sendPromiseBuilder }
};

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  const q = new URL(req.url, 'http://localhost').searchParams;
  const a = ANNOUNCEMENTS[q.get('a')];
  if (!a) return res.status(400).json({ error: `which announcement? one of: ${Object.keys(ANNOUNCEMENTS).join(', ')}` });

  try {
    const to = (q.get('to') || '').trim().toLowerCase();
    if (to) {
      await a.send(to, true, { name: q.get('name') || null });
      await a.send(to, false, { name: q.get('name') || null });
      return res.status(200).json({ test: true, sentTo: to, versions: ['member', 'not a member'], note: 'nothing was recorded' });
    }

    const [audience, opted, bounced, members, done] = await Promise.all([
      reportAudience(), optOuts(), bouncedEmails(), listEntitled(ALL_ACCESS), outreachLog(a.kind)
    ]);
    const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));
    // Holding all-access is being on a trial or the paid membership: the
    // webhook grants it for both and takes it away when either ends.
    const isMember = new Set(members.map((m) => m.email));
    const due = audience.filter((m) => !blocked.has(String(m.email).toLowerCase()) && !done.has(m.email));
    const split = { member: due.filter((m) => isMember.has(m.email)).length };
    split.notMember = due.length - split.member;

    if (q.get('send') !== '1') {
      return res.status(200).json({ dry: true, due: due.length, ...split, alreadySent: done.size });
    }

    let sent = 0;
    const failed = [];
    for (const m of due) {
      try {
        await a.send(m.email, isMember.has(m.email), { name: m.name });
        await recordOutreach(m.email, a.kind);
        sent++;
      } catch (err) {
        console.error('[cron/announce] failed', m.email, err?.message || err);
        failed.push(m.email);
      }
    }
    return res.status(200).json({ sent, failed, ...split });
  } catch (err) {
    console.error('[cron/announce]', err);
    return res.status(500).json({ error: 'server' });
  }
}
