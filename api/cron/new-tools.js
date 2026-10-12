import { libraryAddedSince, reportAudience, optOuts, bouncedEmails,
         setSetting, getSettings } from '../../lib/db.js';
import { sendNewTools, newToolsSubject } from '../../lib/email.js';

/**
 * What went into the library this week, told to the members on a Friday.
 *
 * AI Black Magic publish theirs on a Friday afternoon — four of their last
 * eight drops, always between 13:00 and 16:10 UTC — so this goes out at 18:00,
 * after the week's additions have been pulled in and well clear of the Monday
 * report, which is the other thing members get.
 *
 * It only ever announces what is actually there: the items are read back out
 * of our own library, after the weekly check has published them, and anything
 * that check hid is a draft and so cannot appear here. An email promising a
 * tool that is not on the shelf is worse than no email.
 *
 * A quiet week sends nothing. There is no obligation to write every Friday,
 * and "nothing new this week" is the fastest way to teach somebody to stop
 * opening these.
 *
 * `?dry=1` with the secret shows what it would send, to whom, and stores
 * nothing.
 */

// Under this it is not a week's worth of news, it is a footnote.
const MIN_ITEMS = 2;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/new-tools] CRON_SECRET is not set — refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  /* One address, to look at it before four dozen people do.
     It sends the real email, built from the real week, and then changes
     nothing: the marker below is left alone, so Friday still goes out with
     this week's items rather than finding them already announced. */
  const only = (url.searchParams.get('to') || '').trim().toLowerCase();
  const started = Date.now();

  try {
    /* Since the last one that actually went out, so a week we stayed quiet is
       rolled into the next email rather than lost. Falls back to seven days,
       which is right the first time this ever runs. */
    const settings = await getSettings();
    const since = settings.new_tools_last_sent
      || new Date(Date.now() - 7 * 864e5).toISOString();

    const items = await libraryAddedSince(since);

    // A test send goes out whatever the week looked like — the point is to see
    // the thing, and an empty week would show nothing.
    if (only) {
      if (!items.length) {
        return res.status(200).json({ error: 'nothing new to show', since });
      }
      await sendNewTools(only, { name: null, items, total: items.length });
      console.log(`[cron/new-tools] test copy of ${items.length} item(s) sent to ${only}`);
      return res.status(200).json({
        test: true, sentTo: only, items: items.length,
        subject: newToolsSubject(items, items.length),
        note: 'nothing was recorded, so Friday still has these to announce',
        ms: Date.now() - started
      });
    }

    if (items.length < MIN_ITEMS) {
      if (!dry) await setSetting('new_tools_last_skipped', new Date().toISOString());
      return res.status(200).json({
        sent: 0, skipped: 'not enough new this week',
        found: items.length, needed: MIN_ITEMS, since
      });
    }

    const [audience, opted, bounced] = await Promise.all([
      reportAudience(), optOuts(), bouncedEmails()
    ]);
    const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));
    const to = audience.filter((m) => !blocked.has(String(m.email).toLowerCase()));

    if (dry) {
      return res.status(200).json({
        dry: true, since, items: items.length, audience: to.length,
        subject: newToolsSubject(items, items.length),
        byKind: items.reduce((a, i) => ({ ...a, [i.kind]: (a[i.kind] || 0) + 1 }), {}),
        titles: items.map((i) => `${i.kind}: ${i.title}`),
        ms: Date.now() - started
      });
    }

    let sent = 0;
    const failed = [];
    for (const m of to) {
      try {
        await sendNewTools(m.email, { name: m.name, items, total: items.length });
        sent++;
      } catch (err) {
        console.error('[cron/new-tools] send failed', m.email, err?.message || err);
        failed.push(m.email);
      }
    }

    /* Stamped only after sending, and stamped even when some sends failed: the
       alternative is that next Friday repeats this week's list to everybody
       who did get it, which is worse than a handful missing one email. */
    await setSetting('new_tools_last_sent', new Date().toISOString());

    console.log(`[cron/new-tools] ${items.length} item(s) announced to ${sent} member(s)`);
    return res.status(200).json({
      sent, considered: to.length, items: items.length, failed, since, ms: Date.now() - started
    });
  } catch (err) {
    console.error('[cron/new-tools]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}
