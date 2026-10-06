/**
 * The news feed's collector, a few times a day.
 *
 *   read the sources → drop what we already have → fetch each new page once
 *   for its picture and its real headline → store → prune what fell out of
 *   the window.
 *
 * It calls no model. Every word on a news card is the publisher's own - their
 * headline, their summary, their categories - and the picture is a link to
 * their server. That is deliberate and not only about cost: a feed of other
 * people's news is the one place where writing our own words over theirs would
 * be putting our name on their work.
 *
 * `?dry=1` with the secret collects and stores nothing, for looking at what a
 * run would do.
 */
import { collectWeek, cardFor, clearPageCache } from '../../lib/report-sources.js';
import { saveNewsItems, knownNewsUrls, pruneNews, countNews, NEWS_WINDOW_DAYS } from '../../lib/db.js';

/* Each new item costs a page fetch and a HEAD on its picture. Capped per run
   so a quiet morning finishes in seconds and a backlog is worked through over
   several runs rather than timing one out and storing nothing. */
const MAX_NEW_PER_RUN = 45;
const LOOKBACK_DAYS = 8;
const CONCURRENCY = 6;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/news] CRON_SECRET is not set — refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  const started = Date.now();

  try {
    clearPageCache();
    const { items, health } = await collectWeek({ since: Date.now() - LOOKBACK_DAYS * 864e5 });
    const known = await knownNewsUrls();

    /* Three different numbers, and conflating two of them made the first run
       report 176 stories as already stored against an empty table. What we
       already have is one thing; what this run is leaving for the next one
       because of the cap is another, and that one is the number worth
       watching - if it never reaches zero the cap is too low for the sources. */
    const unseen = items.filter((it) => !known.has(it.url));
    const fresh = unseen.slice(0, MAX_NEW_PER_RUN);
    const deferred = unseen.length - fresh.length;

    /* A small pool rather than Promise.all over everything: forty pages at
       once is a burst at a handful of publishers from one address, which is
       both rude and the quickest way to be rate-limited off a source. */
    const cards = [];
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      const batch = await Promise.all(fresh.slice(i, i + CONCURRENCY).map(async (it) => {
        try {
          const card = await cardFor(it);
          return {
            url: it.url,
            title: card.headline || it.title,
            summary: it.summary || null,
            source: it.source,
            sourceName: it.sourceName,
            imageUrl: card.image?.url || null,
            imageAlt: card.image?.alt || null,
            tags: it.tags || [],
            // Who else ran the same announcement, kept so a tutorial can be
            // written from all of it rather than from one outlet's blurb.
            also: (it.also || []).map((a) => ({ url: a.url, sourceName: a.sourceName, source: a.source })),
            publishedAt: card.publishedAt || it.publishedAt || null
          };
        } catch (err) {
          console.error('[cron/news] could not read', it.url, err?.message);
          return null;
        }
      }));
      cards.push(...batch.filter(Boolean));
    }

    if (dry) {
      return res.status(200).json({
        ok: true, dry: true, seen: items.length, alreadyHad: items.length - unseen.length, deferred,
        wouldStore: cards.length, withPictures: cards.filter((c) => c.imageUrl).length,
        sample: cards.slice(0, 5), health, ms: Date.now() - started
      });
    }

    const stored = await saveNewsItems(cards);
    const pruned = await pruneNews(NEWS_WINDOW_DAYS);
    const total = await countNews();

    return res.status(200).json({
      ok: true,
      seen: items.length,
      alreadyHad: items.length - unseen.length,
      deferred,
      stored,
      withPictures: cards.filter((c) => c.imageUrl).length,
      pruned,
      total,
      sourcesUp: health.filter((h) => h.ok).length,
      sourcesDown: health.filter((h) => !h.ok).map((h) => h.source),
      ms: Date.now() - started
    });
  } catch (err) {
    console.error('[cron/news]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}
