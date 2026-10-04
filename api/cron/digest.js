/**
 * The weekly community digest, called by Vercel Cron on Monday mornings.
 *
 * The important part is that it can decide not to send. A digest that arrives
 * every week saying nothing happened teaches people to ignore the sender - and
 * this sender also delivers receipts and sign-in links, so its reputation is
 * not something to spend on an empty email.
 *
 * `?dry=1` with the secret reports what it would do without sending anything,
 * which is how to look at it before trusting it with a Monday.
 */
import { weekInCommunity, digestAudience, optOuts, bouncedEmails, setSetting, getSettings } from '../../lib/db.js';
import { sendCommunityDigest } from '../../lib/email.js';

// Below this there is not enough of a week to be worth an email.
const MIN_THREADS = 2;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/digest] CRON_SECRET is not set â€” refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const dry = new URL(req.url, 'http://localhost').searchParams.get('dry') === '1';

  try {
    const week = await weekInCommunity(7);

    // Nothing worth saying. Recorded so a silent week is visible in the
    // settings rather than looking like a run that failed.
    if ((week.totals.threads || 0) < MIN_THREADS) {
      if (!dry) await setSetting('digest_last_skipped', new Date().toISOString());
      return res.status(200).json({
        sent: 0, skipped: 'too quiet',
        threads: week.totals.threads, needed: MIN_THREADS
      });
    }

    const [audience, opted, bounced] = await Promise.all([
      digestAudience(), optOuts(), bouncedEmails()
    ]);
    const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));

    // Everybody the community is open to, minus anybody who opted out of these
    // or whose address has bounced.
    const to = audience.filter((m) => !blocked.has(String(m.email).toLowerCase()));

    if (dry) {
      return res.status(200).json({
        would_send_to: to.map((m) => m.email),
        audience: audience.length,
        week: { ...week.totals, unanswered: week.unanswered },
        top: week.threads.map((t) => ({ title: t.title, space: t.space, replies: t.replies, likes: t.likes }))
      });
    }

    let sent = 0;
    for (const m of to) {
      try {
        await sendCommunityDigest(m.email, { name: m.name, week });
        sent++;
      } catch (err) {
        console.error('[cron/digest] send failed', m.email, err?.message || err);
      }
    }

    await setSetting('digest_last_sent', new Date().toISOString());
    return res.status(200).json({ sent, considered: to.length, audience: audience.length });
  } catch (err) {
    console.error('[cron/digest]', err);
    return res.status(500).json({ error: 'server' });
  }
}
