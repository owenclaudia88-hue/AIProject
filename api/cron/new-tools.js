import { libraryAddedSince, coursesAddedSince, reportAudience, optOuts, bouncedEmails,
         setSetting, getSettings, offersOnSale } from '../../lib/db.js';
import { sendNewTools, newToolsSubject } from '../../lib/email.js';
import { MEMBERSHIP_UNLOCKS, funnelEngineLock, FUNNEL_ENGINE } from '../../lib/products.js';

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

// Under this it is not a week's worth of news, it is a footnote. A course is
// the exception: it is the biggest thing we ship, and one of them on its own
// is worth an email in a week when nothing else arrived.
const MIN_ITEMS = 2;

const hours = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/**
 * A course row in the shape the email writes: the same fields as a library
 * item, so nothing downstream has to know there were two sources.
 *
 * It has no description of its own, so the line under the title is what the
 * course card says on the site — sections, lessons and running time.
 *
 * An open course opens itself. A gated one points at the course list instead,
 * because the same email goes to every member and this cannot know which of
 * them holds the entitlement: opening a course they do not have lands on
 * "Could not load this course", while the list shows it as a locked card with
 * the way to unlock it. One more click for the members who do have it, and no
 * dead end for the ones who do not.
 */
export function asItem(c) {
  const st = c.stats || {};
  const lessons = c.lesson_count || st.lessons || 0;
  const parts = [];
  if (c.section_count > 1) parts.push(`${c.section_count} sections`);
  if (lessons) parts.push(`${lessons} lessons`);
  if (st.minutes) parts.push(hours(st.minutes));
  // A description somebody wrote leads, with the size after it. The ones the
  // ingest generated ("25 lessons, about 5h. Covers: ...") only repeat the
  // size and list lesson titles, so those are left out.
  const written = String(c.description || '').trim();
  const lead = written && !/^\d+ lessons?\b/i.test(written) ? written : '';
  const size = parts.join(' · ');
  return {
    kind: 'course', title: c.title,
    hash: c.requires ? 'courses' : `course-${c.slug}`,
    description: lead ? `${lead} (${size})` : size, tags: [], category: null
  };
}

/* What a member can open with the membership. A course sold on its own - the
   Funnel Engine and its two bumps - is not "new in your library" for anybody
   who has not bought it, which is nearly everybody this goes to. */
const inLibrary = (c) => !c.requires || MEMBERSHIP_UNLOCKS.includes(c.requires);

/* A course sold on its own, in the email's "New to add" section: its written
   description and size, linking to the page that sells it. Announced once -
   the slugs go into a setting when the real email goes out - so a product is
   introduced properly and then left alone, rather than repeated every week. */
const OFFER_ICON = { [FUNNEL_ENGINE]: '🚀', edward: '📣', 'dfy-operators': '🤖' };
export function asOffer(c, site) {
  const item = asItem(c);
  const lock = funnelEngineLock(c.requires);
  return { ...item, kind: 'offer', icon: OFFER_ICON[c.requires] || null,
           href: lock ? `${site}${lock.buy}` : `${site}/members/#courses` };
}

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

    /* Two sources, one email. The library comes from the weekly pull; the
       courses are ours, published in the course area whenever one is ready. A
       member does not care which pipeline a thing arrived through. */
    const [lib, courses, onSale] = await Promise.all([
      libraryAddedSince(since), coursesAddedSince(since), offersOnSale()
    ]);
    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    let announced = [];
    try { announced = JSON.parse(settings.new_tools_offers_announced || '[]'); } catch { announced = []; }
    const offers = onSale.filter((c) => !inLibrary(c) && !announced.includes(c.slug));
    const items = [...courses.filter(inLibrary).map(asItem), ...lib, ...offers.map((c) => asOffer(c, site))];

    /* Dry wins over a recipient, always. The other way round — which is how
       this was first written — means ?dry=1&to=me sends an email, and the one
       flag whose whole promise is "this sends nothing" cannot be the one you
       have to think about. */
    if (only && dry) {
      return res.status(200).json({
        dry: true, wouldSendTo: only, items: items.length, since,
        subject: items.length ? newToolsSubject(items, items.length) : null,
        titles: items.map((i) => `${i.kind}: ${i.title}`)
      });
    }

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

    if (items.length < MIN_ITEMS && !courses.length) {
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
    if (offers.length) {
      await setSetting('new_tools_offers_announced', JSON.stringify([...announced, ...offers.map((c) => c.slug)]));
    }

    console.log(`[cron/new-tools] ${items.length} item(s) announced to ${sent} member(s)`);
    return res.status(200).json({
      sent, considered: to.length, items: items.length, failed, since, ms: Date.now() - started
    });
  } catch (err) {
    console.error('[cron/new-tools]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}
