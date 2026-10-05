/**
 * Where the week's news comes from.
 *
 * Fixed sources, fetched directly, parsed without a dependency. No aggregator
 * sits in the middle deciding what we see, and nothing is scraped from behind
 * a paywall or a login.
 *
 * Two things matter more than the list itself.
 *
 * Nothing is republished. Each item keeps a title, a link and at most a couple
 * of hundred characters of the source's own summary - enough for the writing
 * step to know what happened, never enough to be a copy of their article. What
 * members read is written here and links out.
 *
 * A source that breaks goes quiet rather than loud. Feeds change format and
 * sites move; one that returns nothing is recorded as empty and the week
 * carries on with the rest, because a report that fails because The Verge
 * changed their XML is a report that stops arriving in March.
 */

/* Primary first: these are the people who actually shipped the thing. The
   secondaries are there because they notice releases the primaries announce
   quietly, and because a week with nothing from the labs still has news. */
/* `owner: true` marks the people who ship the thing rather than report on it.
   It decides two separate questions: whose version of a story survives
   deduplication, and whose picture we are willing to show. A company's own
   announcement image is theirs to publish and ours to point at; a newspaper's
   illustration of that announcement usually belongs to an agency. */
export const SOURCES = [
  { key: 'anthropic', name: 'Anthropic', kind: 'html', weight: 3, owner: true,
    url: 'https://www.anthropic.com/news', base: 'https://www.anthropic.com', path: '/news/',
    featured: true },
  { key: 'openai', name: 'OpenAI', kind: 'feed', weight: 3, owner: true, url: 'https://openai.com/news/rss.xml' },
  { key: 'google-ai', name: 'Google AI', kind: 'feed', weight: 2, owner: true, url: 'https://blog.google/technology/ai/rss/' },
  { key: 'deepmind', name: 'Google DeepMind', kind: 'feed', weight: 2, owner: true, url: 'https://deepmind.google/blog/rss.xml' },
  { key: 'microsoft', name: 'Microsoft AI', kind: 'feed', weight: 1, owner: true, url: 'https://news.microsoft.com/source/topics/ai/feed/' },
  { key: 'meta', name: 'Meta', kind: 'feed', weight: 1, owner: true, url: 'https://about.fb.com/news/feed/' },
  { key: 'huggingface', name: 'Hugging Face', kind: 'feed', weight: 1, owner: true, url: 'https://huggingface.co/blog/feed.xml' },
  { key: 'techcrunch', name: 'TechCrunch', kind: 'feed', weight: 1, url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { key: 'verge', name: 'The Verge', kind: 'feed', weight: 1, url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { key: 'arstechnica', name: 'Ars Technica', kind: 'feed', weight: 1, url: 'https://arstechnica.com/ai/feed/' },
  { key: 'simonwillison', name: 'Simon Willison', kind: 'feed', weight: 2, url: 'https://simonwillison.net/atom/everything/' },
  // Infrequent, and the only thing a competitor's weekly cited outside The
  // Verge and the labs' own posts. No feed, same index shape as Anthropic.
  { key: 'darioamodei', name: 'Dario Amodei', kind: 'html', weight: 2,
    url: 'https://darioamodei.com/', base: 'https://darioamodei.com', path: '/post/' },
  { key: 'producthunt', name: 'Product Hunt', kind: 'feed', weight: 1, url: 'https://www.producthunt.com/feed' },

  /* The labs and model shops. */
  { key: 'gemini', name: 'Google Gemini', kind: 'feed', weight: 2, owner: true,
    url: 'https://blog.google/products/gemini/rss/' },
  { key: 'apple', name: 'Apple', kind: 'feed', weight: 2, owner: true,
    url: 'https://www.apple.com/newsroom/rss-feed.rss' },
  { key: 'elevenlabs', name: 'ElevenLabs', kind: 'html', weight: 1, owner: true,
    url: 'https://elevenlabs.io/blog', base: 'https://elevenlabs.io', path: '/blog/' },
  { key: 'midjourney', name: 'Midjourney', kind: 'feed', weight: 1, owner: true,
    url: 'https://updates.midjourney.com/rss' },

  /* The tools members already pay for. A price change or a new feature in
     something already on the card matters more to somebody running a business
     alone than a frontier model they will never call directly. */
  { key: 'notion', name: 'Notion', kind: 'html', weight: 1, owner: true,
    url: 'https://www.notion.so/releases', base: 'https://www.notion.so', path: '/releases/' },
  { key: 'zapier', name: 'Zapier', kind: 'feed', weight: 1, owner: true,
    url: 'https://zapier.com/blog/feeds/latest/' },
  { key: 'hubspot', name: 'HubSpot', kind: 'feed', weight: 1, owner: true,
    url: 'https://product.hubspot.com/blog/rss.xml' },
  { key: 'shopify', name: 'Shopify', kind: 'feed', weight: 1, owner: true,
    url: 'https://www.shopify.com/news/feed' },
  { key: 'stripe', name: 'Stripe', kind: 'feed', weight: 1, owner: true,
    url: 'https://stripe.com/blog/feed.rss' },

  /* Not read for its own writing - read for where it points.
     One item in this feed is a whole newsletter issue bundling six unrelated
     stories, so taking it as a source would produce a report item whose
     headline covers one of them and whose text covers all of them, linking
     members at somebody else's signup page. What it is good for is the
     announcements underneath: AT&T, Amazon, Microsoft, a university lab, a
     state governor's office - primary sources our twelve would never see.
     So the issues are mined for outbound links and the link is what we keep. */
  { key: 'rundown', name: 'The Rundown', kind: 'scout', weight: 1,
    url: 'https://www.therundown.ai/feed', issues: 3, max: 14 }
];

const OWNERS = new Set(SOURCES.filter((s) => s.owner).map((s) => s.key));

const UA = 'AIFounderUniversity-Reports/1.0 (+https://aifounderuniversity.com)';

async function grab(url, ms = 15000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ---------------- parsing ---------------- */

/* The punctuation a newsroom actually types. Not a full entity table: these
   are the ones that turn up in headlines and standfirsts, and an unknown
   entity is left alone rather than guessed at. */
const NAMED = {
  lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', middot: '·', times: '×',
  deg: '°', copy: '©', reg: '®', trade: '™', eacute: 'é'
};

/* `&amp;` is resolved last, so one pass turns "AT&amp;T" into "AT&T" and
   leaves "&amp;mdash;" as the literal text "&mdash;" - which is correct for
   one level and wrong for what the reader sees, because some feeds escape
   their HTML twice. Simon Willison's is one: his summaries arrived on a news
   card reading "for a fifth of the price &mdash; Hacker News".
   So the pass runs again while it is still changing something, bounded at
   three. Text that merely contains the characters is untouched - there is
   nothing left to resolve after the first pass. */
const once = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&([a-z]+);/gi, (m, n) => (Object.prototype.hasOwnProperty.call(NAMED, n.toLowerCase())
    ? NAMED[n.toLowerCase()] : m))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&');

const decode = (s) => {
  let out = String(s || '');
  for (let i = 0; i < 3; i++) {
    const next = once(out);
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+/g, ' ').trim();
};

/** Tags out, entities decoded, collapsed. Used on summaries, never on a body. */
export const toText = (html) => decode(String(html || '').replace(/<[^>]*>/g, ' '));

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

/**
 * RSS and Atom, both, without caring which. Enough of each format is the same
 * that telling them apart is more code than handling both.
 */
function parseFeed(xml, source) {
  const blocks = xml.split(/<(?:item|entry)[\s>]/i).slice(1);
  const out = [];
  for (const raw of blocks) {
    const block = raw.split(/<\/(?:item|entry)>/i)[0];
    const title = tag(block, 'title');
    if (!title) continue;

    // RSS puts the URL in <link>text</link>; Atom puts it in an attribute.
    let url = tag(block, 'link');
    if (!url || /^\s*$/.test(url)) {
      const m = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
        || block.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = m ? decode(m[1]) : '';
    }
    if (!/^https?:\/\//i.test(url)) continue;

    const when = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    const at = when ? new Date(when) : null;

    /* The publisher's own categories, where they publish them. Most RSS feeds
       carry a handful of <category> elements per item and they are better
       than anything we could infer: they are what the newsroom filed the
       piece under. Free, too - no model is asked what a story is about. */
    const cats = [];
    const catRe = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let c;
    while ((c = catRe.exec(block)) !== null && cats.length < 12) {
      const label = decode(c[1]).replace(/\s+/g, ' ').trim();
      if (label && label.length <= 40 && !cats.some((x) => x.toLowerCase() === label.toLowerCase())) {
        cats.push(label);
      }
    }
    // Atom puts the label in an attribute instead of between the tags.
    if (!cats.length) {
      const attrRe = /<category[^>]*\bterm=["']([^"']+)["']/gi;
      let a;
      while ((a = attrRe.exec(block)) !== null && cats.length < 12) {
        const label = decode(a[1]).trim();
        if (label && label.length <= 40 && !cats.some((x) => x.toLowerCase() === label.toLowerCase())) {
          cats.push(label);
        }
      }
    }

    out.push({
      source: source.key,
      sourceName: source.name,
      weight: source.weight,
      title: title.slice(0, 300),
      tags: cats,
      url,
      // Carried through so the selection step can prefer the company's own
      // announcement over somebody's write-up of it.
      owner: !!source.owner,
      publishedAt: at && !isNaN(at) ? at.toISOString() : null,
      // Their words, kept short on purpose: this is here to tell the writing
      // step what the item is, not to be published.
      summary: toText(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')).slice(0, 400)
    });
  }
  return out;
}

/**
 * An index page, for the sources that publish no feed.
 *
 * Anthropic are the most relevant source these members have and publish no
 * feed at all; Dario Amodei's essays are the same, and a competitor's
 * newsletter cited one of them as the only thing it linked outside The Verge
 * and the labs themselves. Both index pages are the same shape - a list of
 * links under one path, with the heading text next to each - so this reads
 * whichever path the source declares rather than hardcoding Anthropic's.
 *
 * A page that changes shape shows up as a source that returned nothing, which
 * is the failure we want: a quiet gap in one week's candidates rather than a
 * wrong report.
 */
/**
 * Anthropic's featured grid, which is where the models actually are.
 *
 * Their /news/ links are the corporate and research posts. A model launch is
 * promoted into a featured grid and lives at the root - Sonnet 5.5 is at
 * /claude-sonnet-5-5, not /news/anything - so reading /news/ alone had made
 * every model release invisible to the one audience that cares most about
 * them. The first real report cited a commentator for Sonnet 5.5 because
 * Anthropic's own announcement was never a candidate.
 *
 * The grid is serialised into the page as escaped JSON, which is better than
 * the markup: it carries the date and the summary, and our /news/ items have
 * neither.
 */
function parseFeatured(html, source) {
  const out = [];

  /* The grid arrives with its quotes escaped, as part of the framework's own
     payload. Unescaping once turns it into ordinary JSON-shaped text; counting
     backslashes through four levels of quoting is how the first attempt at
     this matched nothing at all and said so silently. */
  const flat = String(html).replace(/\\"/g, '"');

  const blocks = /"_type":"featuredGridLink"([\s\S]{0,1200}?)"url":"([^"]+)"/g;
  const field = (chunk, name) => {
    const m = chunk.match(new RegExp(`"${name}":"([^"]{1,400})"`));
    return m ? decode(m[1]) : '';
  };

  let m;
  while ((m = blocks.exec(flat)) && out.length < 10) {
    const [, chunk, href] = m;
    const title = field(chunk, 'title');
    if (!title || title.length < 10) continue;
    const when = field(chunk, 'date');
    const at = when ? new Date(when) : null;
    out.push({
      source: source.key, sourceName: source.name, weight: source.weight, owner: !!source.owner,
      title: title.slice(0, 300),
      url: /^https?:/i.test(href) ? href : source.base + href,
      publishedAt: at && !isNaN(at) ? at.toISOString() : null,
      summary: field(chunk, 'summary').slice(0, 400)
    });
  }
  return out;
}

function parseIndex(html, source) {
  const seen = new Set();
  const out = [];
  const prefix = (source.path || '/news/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Prefetch tags carry the same href as the link beside them, which shifted
     every title onto the following post's URL: the duplicate href matched, was
     skipped as already seen, and took the next title with it on the way past.
     They are never content, so they go before anything is matched. */
  const body = String(html).replace(/<link\b[^>]*>/gi, ' ');

  const re = new RegExp(`href="(${prefix}[a-z0-9-]+)"[\\s\\S]{0,600}?>([^<>{}]{15,160})<`, 'g');
  let m;
  while ((m = re.exec(body)) && out.length < 20) {
    const path = m[1];
    if (seen.has(path)) continue;
    const title = decode(m[2]);
    // Headings only: the same href appears again wrapped around "Read more".
    if (!title || title.length < 15 || /^(read|learn|more|news)\b/i.test(title)) continue;
    seen.add(path);
    out.push({
      source: source.key, sourceName: source.name, weight: source.weight, owner: !!source.owner,
      title: title.slice(0, 300), url: source.base + path, publishedAt: null, summary: ''
    });
  }
  return out;
}

/* An index page, plus the featured grid on it where the source has one. The
   two overlap by url, and the featured copy wins because it carries a date. */
async function readIndex(source) {
  const html = await grab(source.url);
  const listed = parseIndex(html, source);
  if (!source.featured) return listed;

  const featured = parseFeatured(html, source);
  const have = new Set(featured.map((f) => f.url));
  return [...featured, ...listed.filter((l) => !have.has(l.url))];
}

/* ---------------- scouting ---------------- */

/* Never worth following out of an issue: the newsletter's own pages, the
   platform it is built on, and the social and tooling furniture every page
   carries. */
const SCOUT_SKIP = /(^|\.)(therundown\.ai|beehiiv\.com|beehiiv-images-production\.s3\.amazonaws\.com|typeform\.com|teamtailor\.com|googletagmanager\.com|google-analytics\.com|fontshare\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|instagram\.com|threads\.net|youtube\.com|youtu\.be|t\.co|tiktok\.com|whatsapp\.com|mailto)$/i;

const TRACKING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'mc_cid', 'mc_eid'];

/**
 * Is this link a piece of news, or is it an advertisement?
 *
 * It cannot be told from the markup. The paid link on the issue we measured
 * sat in exactly the same emoji-and-headline shape as the editorial ones, with
 * the same tracking parameters on it.
 *
 * It can be told from the page it points at. The sponsor's landing page
 * declares og:type "website" and no publication date; every editorial target
 * that would talk to us declared og:type "article" or "news" with a date on
 * it. So the page is asked what it is, and anything that does not say it is a
 * dated article is dropped.
 *
 * It fails closed. A page that refuses us - two of the nine did - is dropped
 * rather than guessed at, which is the right way round for a filter whose job
 * is keeping an advertiser from appearing as a news item.
 */
async function looksLikeNews(url) {
  const { html } = await pageFor(url);
  if (!html) return null;

  const type = (meta(html, ['og:type']) || '').toLowerCase();
  if (!/^(article|news)/.test(type)) return null;

  const when = meta(html, ['article:published_time', 'og:article:published_time', 'datePublished', 'date'])
    || (/"datePublished"\s*:\s*"([^"]+)"/i.exec(html) || [])[1] || '';
  const at = when ? new Date(when) : null;
  if (!at || isNaN(at)) return null;

  return {
    title: meta(html, ['og:title']),
    siteName: meta(html, ['og:site_name']),
    summary: meta(html, ['og:description', 'description']),
    publishedAt: at.toISOString()
  };
}

/**
 * Read somebody's roundup for the links in it, not the writing around them.
 *
 * What comes back is attributed to whoever actually published the thing, not
 * to the roundup: an item discovered here says Amazon or Microsoft on its card
 * and links to Amazon or Microsoft. The roundup is recorded as `via` for the
 * admin's source list, because knowing how something was found is worth having
 * when somebody asks.
 */
async function scoutIssues(source, cutoff) {
  const issues = parseFeed(await grab(source.url), source)
    .filter((i) => !i.publishedAt || new Date(i.publishedAt).getTime() >= cutoff)
    .slice(0, source.issues || 3);

  const candidates = new Map();
  for (const issue of issues) {
    const { html } = await pageFor(issue.url);
    if (!html) continue;

    const re = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && candidates.size < (source.max || 14)) {
      let u;
      try { u = new URL(decode(m[1])); } catch { continue; }
      const host = u.hostname.replace(/^www\./, '');
      if (SCOUT_SKIP.test(host)) continue;

      // The tracking the roundup added is theirs, not part of the address.
      TRACKING.forEach((p) => u.searchParams.delete(p));
      u.hash = '';
      if (candidates.has(u.href)) continue;
      candidates.set(u.href, { url: u.href, host, anchor: toText(m[2]).slice(0, 300) });
    }
  }

  const out = [];
  const list = [...candidates.values()];
  // In small batches: this is somebody else's servers, several at a time.
  for (let i = 0; i < list.length; i += 5) {
    const batch = await Promise.all(list.slice(i, i + 5).map(async (c) => {
      const page = await looksLikeNews(c.url).catch(() => null);
      if (!page) return null;
      const title = (page.title || c.anchor || '').trim();
      if (title.length < 15) return null;
      return {
        // Keyed by publisher, so the gate's "every item from one source" rule
        // sees these as the separate publishers they are.
        source: c.host, sourceName: page.siteName || c.host, weight: source.weight,
        title: title.slice(0, 300), url: c.url, publishedAt: page.publishedAt,
        summary: String(page.summary || '').slice(0, 400), via: source.name
      };
    }));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

/* ---------------- collecting ---------------- */

/**
 * Everything published since `since`, from every source, with the failures
 * reported rather than thrown.
 *
 * Items with no date are kept: Anthropic's index has none, and an item from
 * the most important source is not dropped for want of a timestamp. The
 * already-covered set is what stops them repeating week to week.
 */
export async function collectWeek({ since, covered = new Set(), sources = SOURCES } = {}) {
  const cutoff = since ? new Date(since).getTime() : Date.now() - 7 * 864e5;
  const health = [];

  const batches = await Promise.all(sources.map(async (s) => {
    const t = Date.now();
    try {
      const items = s.kind === 'scout'
        ? await scoutIssues(s, cutoff)
        : (s.kind === 'html' ? await readIndex(s) : parseFeed(await grab(s.url), s));
      const fresh = items.filter((it) => {
        if (covered.has(it.url)) return false;
        if (!it.publishedAt) return true;
        return new Date(it.publishedAt).getTime() >= cutoff;
      });
      health.push({ source: s.key, ok: true, found: items.length, fresh: fresh.length, ms: Date.now() - t });
      return fresh;
    } catch (err) {
      health.push({ source: s.key, ok: false, error: String(err.message || err).slice(0, 120), ms: Date.now() - t });
      return [];
    }
  }));

  const items = batches.flat();

  // The same story from four outlets is one story. Titles are compared with
  // the small words taken out, so "OpenAI launches X" and "OpenAI launches X
  // for everyone" collapse into the first one that arrived.
  /* The word a company puts in front of its own announcement. Anthropic title
     theirs "Introducing Claude Sonnet 5.5" while everybody writing about it
     says "Claude Sonnet 5.5", and that one word was enough to keep the two
     apart - so the report cited a commentator for a launch whose own
     announcement was sitting in the same list. */
  const ANNOUNCING = /^(introducing|announcing|meet|say hello to|now available|launching)\s+/i;

  const byShape = new Map();
  for (const it of items.sort((a, b) => b.weight - a.weight)) {
    const shape = it.title.toLowerCase().replace(ANNOUNCING, '').replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter((w) => w.length > 3).slice(0, 6).sort().join(' ');
    if (!shape) continue;
    if (!byShape.has(shape)) byShape.set(shape, { ...it, alsoIn: [], also: [] });
    else {
      const keep = byShape.get(shape);
      keep.alsoIn.push(it.sourceName);
      // The losers keep their URLs now, not just their names. When four
      // outlets cover one announcement, the company's own post is in here
      // somewhere, and that is the page whose picture we would rather use.
      keep.also.push({ source: it.source, sourceName: it.sourceName, url: it.url });
    }
  }

  return {
    items: [...byShape.values()].sort((a, b) =>
      (b.weight - a.weight) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))),
    health
  };
}

/**
 * The article itself, as text, for the step that checks what was written is
 * actually in the source. Never stored, never published - it is read once to
 * check a claim and thrown away.
 *
 * Some publishers refuse a self-identifying bot and serve a browser perfectly
 * well. OpenAI are one: 403 to this fetcher, 200 to Chrome. We do not pretend
 * to be Chrome. They have published a summary feed for exactly this purpose
 * and that is what we use for them; the alternative is walking around a "no"
 * the site went to the trouble of saying, which is not a thing to do quietly
 * on somebody else's behalf every Monday at seven.
 */
/* One fetch per article per run. The writing step wants the text and the
   source card wants the meta tags, and they are the same page; fetching it
   twice is rude to the publisher and slow for us. Cleared between runs because
   a serverless invocation does not outlive one. */
const pages = new Map();

export async function pageFor(url) {
  if (pages.has(url)) return pages.get(url);
  const p = grab(url, 12000).then((html) => ({ html, ok: true })).catch(() => ({ html: '', ok: false }));
  pages.set(url, p);
  return p;
}

export function clearPageCache() { pages.clear(); }

export async function articleText(url, max = 6000) {
  const { html } = await pageFor(url);
  if (!html) return '';
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  return toText(body).slice(0, max);
}

/**
 * Everything we are allowed to know about one item, and where it came from.
 *
 * The writing step is held to this text, so what it is allowed to say about an
 * item that gives us 160 characters is narrower than for one that gives us the
 * whole article. That asymmetry is the point: a short summary earns a short
 * line, not a confident paragraph.
 */
export async function supportFor(item) {
  const feed = String(item.summary || '').trim();
  const article = await articleText(item.url);
  if (article.length > Math.max(400, feed.length)) {
    return { text: article.slice(0, 6000), from: 'article', chars: article.length };
  }
  return { text: feed, from: feed ? 'feed summary' : 'title only', chars: feed.length };
}

/* ---------------- the source card ---------------- */

/**
 * One meta tag's content, whichever way the publisher spelled the attribute.
 *
 * Order is not guaranteed and neither is the attribute name: some write
 * property=, some name=, some itemprop=, and content= can come first. So the
 * tag is found whole and then read, rather than matched in one pattern that
 * assumes somebody's house style.
 */
function meta(html, names) {
  const want = new Set(names.map((n) => n.toLowerCase()));
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const key = (m[0].match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!key || !want.has(key.trim().toLowerCase())) continue;
    const val = (m[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (val && val.trim()) return decode(val.trim());
  }
  return '';
}

/* There was an agency filter here, refusing any image whose URL or alt text
   mentioned Getty, Reuters, AP and the rest. It was taken out deliberately
   rather than forgotten.

   TechCrunch name their files "GettyImages-2297764008.jpg", so the rule
   quietly dropped three of every four TechCrunch pictures - and the ones it
   dropped were the ones a reader most wants to see. That measurement was put
   in front of the owner and the call was theirs.

   What a card points at now is whatever the publisher put in their own
   og:image: the picture they are already serving to everyone who shares their
   link. We do not copy it, store it, crop it or alter it, and when they delete
   it, it leaves our page too. That is the right way round, and it is the whole
   reason this is a link and not a download. */

/* Checked before publishing, and more important now than when there was a
   placeholder to fall back on: with no placeholder, a hotlink that has died is
   a broken image in somebody's browser rather than a piece of our artwork.

   It asks under our own name. Asking as Chrome was tried and returned
   byte-identical results, so there is nothing to buy by pretending, and this
   file has already decided once that we do not walk around a publisher's no. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Will this picture actually appear on the page?
 *
 * A hotlinked image is the one part of a report we do not control. It can be
 * refused, moved or deleted by its owner at any moment, which is the correct
 * arrangement - but a refusal we can see on a Monday morning should not become
 * a broken box in somebody's browser on the Tuesday.
 */
export async function imageLoads(url) {
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      headers: { 'user-agent': UA, referer: 'https://aifounderuniversity.com/', accept: 'image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    if (!/^image\//i.test(r.headers.get('content-type') || '')) return { ok: false, why: 'not an image' };

    // Not every server declares a length. One that does and says ten megabytes
    // is telling us something worth listening to on a phone.
    const len = Number(r.headers.get('content-length') || 0);
    if (len && len > MAX_IMAGE_BYTES) {
      return { ok: false, why: `${(len / 1048576).toFixed(1)}MB, too heavy to put on a phone` };
    }
    return { ok: true, bytes: len || null };
  } catch (err) {
    return { ok: false, why: err.name === 'TimeoutError' ? 'timed out' : 'unreachable' };
  }
}

/** An absolute http(s) URL, or nothing. Relative og:image values are real. */
function absolute(value, base) {
  try {
    const u = new URL(String(value || '').trim(), base);
    return /^https?:$/.test(u.protocol) ? u.href : '';
  } catch { return ''; }
}

/**
 * The picture for one item, taken from whoever is most entitled to it.
 *
 * The company's own announcement is tried before anybody's write-up of it:
 * when four outlets cover one launch, the company's own post usually has the
 * better picture and is unambiguously theirs to publish.
 *
 * Nothing is downloaded. What comes back is a URL on the publisher's own
 * servers, which the page points at and the publisher can withdraw at any time
 * by deleting it.
 *
 * Returns null when there is nothing to point at, and null means no picture -
 * the card renders as text. Some sources simply have no og:image (Simon
 * Willison publishes none at all) and some will not talk to us (OpenAI answer
 * 403 to this fetcher, which we respect rather than work around).
 */
export async function imageFor(item) {
  const tries = [
    ...(item.also || []).filter((a) => OWNERS.has(a.source)),
    { source: item.source, sourceName: item.sourceName, url: item.url },
    ...(item.also || []).filter((a) => !OWNERS.has(a.source))
  ];

  const seen = new Set();
  for (const t of tries) {
    if (!t.url || seen.has(t.url)) continue;
    seen.add(t.url);

    const { html } = await pageFor(t.url);
    if (!html) continue;

    const raw = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    if (!raw) continue;
    const url = absolute(raw, t.url);
    if (!url) continue;

    const alt = meta(html, ['og:image:alt', 'twitter:image:alt']);
    const live = await imageLoads(url);
    if (!live.ok) continue;

    return {
      url,
      alt: alt.slice(0, 300),
      pageUrl: t.url,
      sourceName: t.sourceName,
      fromOwner: OWNERS.has(t.source),
      bytes: live.bytes
    };
  }
  return null;
}

/**
 * "Apple tightens Full Disk Access | TechCrunch" → "Apple tightens Full Disk Access".
 *
 * Publishers put their own name in og:title because it is used as a link
 * preview, where nothing else says where the link goes. On our card the source
 * name is already on the line above it, so the suffix is said twice - which is
 * the first real report's own example, verbatim.
 */
function trimSite(title, sourceName) {
  let t = String(title || '').trim();
  const name = String(sourceName || '').trim();
  if (name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\s*[|\\u2013\\u2014\\u00b7-]\\s*${esc}\\s*$`, 'i'), '').trim();
  }
  return t || String(title || '').trim();
}

/**
 * Everything the source card shows, for one item: their headline, their name,
 * their date, and their picture if there is one we may point at.
 *
 * The date is worth the trouble. Feeds carry one and Anthropic's index does
 * not, so the page's own meta tag is the fallback, and an item with no date at
 * all shows none rather than today's.
 */
export async function cardFor(item) {
  const image = await imageFor(item).catch(() => null);
  const { html } = await pageFor(item.url);

  const metaDate = html
    ? meta(html, ['article:published_time', 'og:article:published_time', 'datePublished', 'publish-date', 'date'])
    : '';
  const when = item.publishedAt || metaDate;
  const at = when ? new Date(when) : null;

  return {
    headline: trimSite((html && meta(html, ['og:title'])) || item.title, item.sourceName),
    sourceName: item.sourceName,
    url: item.url,
    publishedAt: at && !isNaN(at) ? at.toISOString() : null,
    image
  };
}

/**
 * Is the link we are about to publish actually there?
 *
 * A refusal is not a broken link. A site that answers 403 to this fetcher is
 * answering - it exists, and it will serve the member who clicks it, because
 * their browser is not what was refused. Only an answer that says the page is
 * not there, or no answer at all, counts as broken.
 */
export async function linkWorks(url) {
  const alive = (status) => status < 400 || status === 401 || status === 403 || status === 405 || status === 429;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    if (alive(res.status)) return true;
    // Some sites refuse HEAD specifically; one GET before calling it broken.
    const get = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    return alive(get.status);
  } catch {
    return false;
  }
}
