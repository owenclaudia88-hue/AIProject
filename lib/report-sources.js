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
export const SOURCES = [
  { key: 'anthropic', name: 'Anthropic', kind: 'html', weight: 3,
    url: 'https://www.anthropic.com/news', base: 'https://www.anthropic.com' },
  { key: 'openai', name: 'OpenAI', kind: 'feed', weight: 3, url: 'https://openai.com/news/rss.xml' },
  { key: 'google-ai', name: 'Google AI', kind: 'feed', weight: 2, url: 'https://blog.google/technology/ai/rss/' },
  { key: 'deepmind', name: 'Google DeepMind', kind: 'feed', weight: 2, url: 'https://deepmind.google/blog/rss.xml' },
  { key: 'microsoft', name: 'Microsoft AI', kind: 'feed', weight: 1, url: 'https://news.microsoft.com/source/topics/ai/feed/' },
  { key: 'meta', name: 'Meta', kind: 'feed', weight: 1, url: 'https://about.fb.com/news/feed/' },
  { key: 'huggingface', name: 'Hugging Face', kind: 'feed', weight: 1, url: 'https://huggingface.co/blog/feed.xml' },
  { key: 'techcrunch', name: 'TechCrunch', kind: 'feed', weight: 1, url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { key: 'verge', name: 'The Verge', kind: 'feed', weight: 1, url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { key: 'arstechnica', name: 'Ars Technica', kind: 'feed', weight: 1, url: 'https://arstechnica.com/ai/feed/' },
  { key: 'simonwillison', name: 'Simon Willison', kind: 'feed', weight: 2, url: 'https://simonwillison.net/atom/everything/' },
  { key: 'producthunt', name: 'Product Hunt', kind: 'feed', weight: 1, url: 'https://www.producthunt.com/feed' }
];

const UA = 'AIFounderUniversity-Reports/1.0 (+https://aifounderuniversity.com)';

async function grab(url, ms = 15000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ---------------- parsing ---------------- */

const decode = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;|&apos;|&#x27;/gi, "'").replace(/&nbsp;/gi, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

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

    out.push({
      source: source.key,
      sourceName: source.name,
      weight: source.weight,
      title: title.slice(0, 300),
      url,
      publishedAt: at && !isNaN(at) ? at.toISOString() : null,
      // Their words, kept short on purpose: this is here to tell the writing
      // step what the item is, not to be published.
      summary: toText(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')).slice(0, 400)
    });
  }
  return out;
}

/**
 * Anthropic publish no feed, and they are the single most relevant source for
 * these members, so their index page is read directly: the links are stable,
 * the titles sit next to them, and anything that changes shape shows up as a
 * source that returned nothing rather than as a wrong report.
 */
function parseAnthropic(html, source) {
  const seen = new Set();
  const out = [];
  const re = /href="(\/news\/[a-z0-9-]+)"[\s\S]{0,600}?>([^<>{}]{15,160})</g;
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const path = m[1];
    if (seen.has(path)) continue;
    const title = decode(m[2]);
    // Headings only: the same href appears again wrapped around "Read more".
    if (!title || title.length < 15 || /^(read|learn|more|news)\b/i.test(title)) continue;
    seen.add(path);
    out.push({
      source: source.key, sourceName: source.name, weight: source.weight,
      title: title.slice(0, 300), url: source.base + path, publishedAt: null, summary: ''
    });
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
      const body = await grab(s.url);
      const items = s.kind === 'html' ? parseAnthropic(body, s) : parseFeed(body, s);
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
  const byShape = new Map();
  for (const it of items.sort((a, b) => b.weight - a.weight)) {
    const shape = it.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter((w) => w.length > 3).slice(0, 6).sort().join(' ');
    if (!shape) continue;
    if (!byShape.has(shape)) byShape.set(shape, { ...it, alsoIn: [] });
    else byShape.get(shape).alsoIn.push(it.sourceName);
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
export async function articleText(url, max = 6000) {
  try {
    const html = await grab(url, 12000);
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    return toText(body).slice(0, max);
  } catch {
    return '';
  }
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
