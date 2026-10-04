/**
 * What a weekly report is, and what makes one fit to publish.
 *
 * Three things live here, in the order they matter.
 *
 * The shape, as a tool schema, so the model fills fields rather than inventing
 * a layout. The design never depends on how it decided to format things.
 *
 * Validation, which is the same rule the roadmap learned: everything is
 * checked against what was actually collected. An item may only carry a link
 * the collector fetched this week, and a recommendation may only name a
 * resource that exists in the library. A report that sends somebody to a page
 * that is not there is worse than one that recommends nothing, because it is
 * also more convincing.
 *
 * The gate, which is deterministic and has the last word. It is published
 * without a human, so the checks are the human: anything missing, anything too
 * short, any dead link, any of the words we do not use, and the report is held
 * and somebody is emailed instead.
 */

export const TOPICS = ['what-changed', 'tutorial', 'tools', 'deep-dive'];

/* ---------------- the shape ---------------- */

const str = (description) => ({ type: 'string', description });
const strs = (description) => ({ type: 'array', items: { type: 'string' }, description });

export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: str('The report\'s title, at most nine words. What changed and why it matters, in plain '
      + 'words. Not a headline that could be about anything.'),
    topic: { type: 'string', enum: TOPICS, description: 'The one this report mostly is.' },
    dek: str('Two sentences under the title: what is in this week and what to pay attention to. '
      + 'If it was a quiet week, say so here rather than inflating it.'),
    sixty: strs('Three lines that are the whole report for somebody who reads nothing else. '
      + 'Each one a finding, not a topic.'),
    stats: {
      type: 'array',
      description: 'OPTIONAL. Three or four numbers that frame the week, e.g. "3 / things changed", '
        + '"20 min / to act on it". Leave out rather than invent.',
      items: {
        type: 'object',
        properties: { value: str('Short: "3", "20 min", "$0".'), label: str('Two or three words.') },
        required: ['value', 'label']
      }
    },
    items: {
      type: 'array',
      description: 'Four to seven things that happened, best first. Only from the list you were '
        + 'given, and only what the supporting text actually says. Each one is shown under the '
        + 'publisher\'s own headline, picture and date, which are taken from their page and are '
        + 'not yours to write. Everything you write here is the commentary underneath that.',
      items: {
        type: 'object',
        properties: {
          url: str('The item\'s url, copied exactly from the list you were given.'),
          what: str('WHAT HAPPENED. Two or three sentences in your own words. Nothing the '
            + 'supporting text does not say, and never the article\'s own sentences or its order '
            + 'of points - a reader who has the original open should not recognise it as a '
            + 'rewrite.'),
          why: str('WHY IT MATTERS FOR ENTREPRENEURS. One or two sentences, about running a small '
            + 'business, not about the industry. If it does not matter to them, say that plainly.'),
          steps: {
            type: 'array',
            description: 'HOW TO USE IT. Two to four concrete steps somebody could do this week. '
              + 'Each one an action, not a consideration. If there is honestly nothing to do yet, '
              + 'give one step saying so and why - most weeks most items deserve that, and saying '
              + 'it is what makes the others believable.',
            items: { type: 'string' }
          },
          resources: {
            type: 'array',
            description: 'OPTIONAL. The AI Founder University specialist, routine, course or '
              + 'download that helps with these steps, where one genuinely fits. Only ids from the '
              + 'catalogue you were given. Leave empty rather than reach for something close.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['course', 'lesson', 'item', 'download'] },
                id: str('Exact id from the catalogue.'),
                note: str('What it does for them here, one line.')
              },
              required: ['type', 'id']
            }
          }
        },
        required: ['url', 'what', 'why', 'steps']
      }
    },
    tutorial: {
      type: 'object',
      description: 'One thing to actually do this week, finishable in one sitting.',
      properties: {
        title: str('"Try this: twenty minutes" style - name the outcome.'),
        intro: str('One or two sentences on what this gets them.'),
        steps: {
          type: 'array',
          description: 'Three to six steps. One action each.',
          items: {
            type: 'object',
            properties: {
              title: str('Short and imperative.'),
              detail: str('One or two sentences, specific enough to follow without guessing.')
            },
            required: ['title', 'detail']
          }
        },
        watchOut: str('The mistake that costs an afternoon. Every tutorial has one.')
      },
      required: ['title', 'steps']
    },
    yourMove: {
      type: 'object',
      description: 'What this week changes for somebody inside AI Founder University, and which of '
        + 'their own tools to use. Only ids from the catalogue you were given.',
      properties: {
        intro: str('One or two sentences.'),
        resources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['course', 'lesson', 'item', 'download'] },
              id: str('Exact id from the catalogue.'),
              note: str('What it does for them here, one line.')
            },
            required: ['type', 'id']
          }
        }
      }
    }
  },
  required: ['title', 'topic', 'dek', 'sixty', 'items', 'tutorial']
};

/* ---------------- validation ---------------- */

const clean = (v, n = 1200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * Keeps only what can be traced back to something real.
 *
 * `collected` is the week's items, keyed by url: an item whose url is not in
 * there was not fetched by us and does not go out, however plausible it looks.
 * `catalogue` is the member's own library, same as the roadmap uses.
 */
export function validateReport(parsed, { collected, catalogue, number }) {
  const byUrl = new Map(collected.map((c) => [c.url, c]));
  const courses = new Map((catalogue?.courses || []).map((c) => [c.slug, c]));
  const items = new Map((catalogue?.items || []).map((i) => [i.id, i]));
  const downloads = new Map((catalogue?.downloads || []).map((d) => [d.key, d]));
  const lessons = new Map((catalogue?.lessons || []).map((l) => [l.id, l]));
  const dropped = [];

  const resources = (rs) => list(rs).map((r) => {
    const id = clean(r && r.id, 200);
    const type = clean(r && r.type, 20);
    const note = clean(r && r.note, 240) || undefined;
    if (type === 'course' && courses.has(id)) return { type, id, title: courses.get(id).title, note };
    if (type === 'lesson' && lessons.has(id)) {
      const l = lessons.get(id);
      return { type, id, course: l.course, title: l.title, duration: l.duration, note };
    }
    if (type === 'item' && items.has(id)) {
      const it = items.get(id);
      return { type, id, title: it.title, kind: it.kind, kindLabel: it.kindLabel, note };
    }
    if (type === 'download' && downloads.has(id)) return { type, id, title: downloads.get(id).title, note };
    if (id) dropped.push(`${type || '?'}:${id}`);
    return null;
  }).filter(Boolean);

  const parsedItems = list(parsed.items).map((raw) => {
    const url = clean(raw && raw.url, 500);
    const source = byUrl.get(url);
    // The whole integrity of the thing: no source, no item.
    if (!source) { if (url) dropped.push(`link:${url.slice(0, 60)}`); return null; }
    return {
      url,
      source: source.source,
      sourceName: source.sourceName,
      // The publisher's own headline and date, carried straight through. The
      // card shows these, and they are theirs rather than ours to word.
      // `image` and any better date are attached later, by the step that has
      // the network; see attachCards in report-generate.
      headline: clean(source.title, 300),
      publishedAt: source.publishedAt || null,
      image: null,
      // The other outlets that ran this story, kept only long enough for the
      // card step to look for the company's own picture among them. Removed
      // again before the report is stored.
      also: list(source.also).map((a) => ({
        source: clean(a && a.source, 40), sourceName: clean(a && a.sourceName, 80), url: clean(a && a.url, 500)
      })).filter((a) => a.url),
      what: clean(raw.what, 900),
      why: clean(raw.why, 600),
      steps: list(raw.steps).map((s) => clean(s, 320)).filter(Boolean).slice(0, 4),
      resources: resources(raw.resources)
    };
  }).filter(Boolean).filter((i) => i.what && i.why).slice(0, 8);

  const tut = parsed.tutorial && typeof parsed.tutorial === 'object' ? parsed.tutorial : {};
  const move = parsed.yourMove && typeof parsed.yourMove === 'object' ? parsed.yourMove : {};

  return {
    report: {
      number: Number(number) || 0,
      title: clean(parsed.title, 160),
      topic: TOPICS.includes(parsed.topic) ? parsed.topic : 'what-changed',
      dek: clean(parsed.dek, 500),
      sixty: list(parsed.sixty).map((s) => clean(s, 300)).filter(Boolean).slice(0, 4),
      stats: list(parsed.stats).map((s) => ({
        value: clean(s && s.value, 24), label: clean(s && s.label, 40)
      })).filter((s) => s.value && s.label).slice(0, 4),
      items: parsedItems,
      tutorial: {
        title: clean(tut.title, 160),
        intro: clean(tut.intro, 500),
        steps: list(tut.steps).map((s) => ({
          title: clean(s && s.title, 160), detail: clean(s && s.detail, 600)
        })).filter((s) => s.title && s.detail).slice(0, 8),
        watchOut: clean(tut.watchOut, 400)
      },
      yourMove: { intro: clean(move.intro, 500), resources: resources(move.resources) },
      sources: parsedItems.map((i) => ({ name: i.sourceName, url: i.url }))
    },
    dropped
  };
}

/* ---------------- the gate ---------------- */

/* Writing nobody should have to read in something they pay for. The model is
   told to avoid these; this is what checks. */
const BANNED = [
  'game-changer', 'game changer', 'revolutionary', 'groundbreaking', 'unlock the power',
  'supercharge', 'skyrocket', 'seamless', 'effortless', 'cutting-edge', 'in today\'s fast-paced',
  'the future of', 'dive deep', 'look no further', 'it\'s no secret', 'buckle up'
];

/**
 * Is this fit to go out without anybody reading it first?
 *
 * Deterministic on purpose. This runs instead of a person, so it refuses on
 * anything it cannot confirm rather than on anything it can disprove. Link
 * checking is done by the caller, which has the network, and handed in.
 */
export function gateReport(report, { deadLinks = [] } = {}) {
  const fail = [];

  // The prose, not the JSON around it. Counting the serialised object counts
  // braces and field names, which is how a thin report passes a length check.
  const prose = [
    report.dek,
    ...report.sixty,
    // The publisher's headline is not counted: it is their writing, carried on
    // the card, and counting it would let a thin report borrow their length.
    ...report.items.flatMap((i) => [i.what, i.why, ...(i.steps || [])]),
    report.tutorial.intro,
    ...report.tutorial.steps.flatMap((s) => [s.title, s.detail]),
    report.tutorial.watchOut,
    report.yourMove?.intro
  ].filter(Boolean).join(' ');
  const words = prose.split(/\s+/).filter(Boolean).length;

  if (!report.title || report.title.split(/\s+/).length > 12) fail.push('title missing or too long');
  if (!report.dek || report.dek.length < 60) fail.push('no opening paragraph');
  if (report.sixty.length < 2) fail.push('fewer than two summary lines');
  if (report.items.length < 3) fail.push(`only ${report.items.length} item(s) survived validation`);
  if (report.items.some((i) => !i.why)) fail.push('an item has no "why it matters"');
  if (report.items.some((i) => !i.headline)) fail.push('an item has no source headline');
  if (report.items.some((i) => !(i.steps || []).length)) fail.push('an item has no "how to use it"');
  if (report.tutorial.steps.length < 3) fail.push('the tutorial has fewer than three steps');
  if (!report.tutorial.title) fail.push('the tutorial has no title');
  if (deadLinks.length) fail.push(`${deadLinks.length} link(s) did not answer: ${deadLinks.slice(0, 3).join(', ')}`);
  if (words < 220) fail.push(`too thin at about ${words} words`);

  const flat = JSON.stringify(report).toLowerCase();
  const found = BANNED.filter((b) => flat.includes(b));
  if (found.length) fail.push(`house style: ${found.join(', ')}`);

  // A report whose items all come from one publisher is a press release.
  const sources = new Set(report.items.map((i) => i.source));
  if (report.items.length >= 4 && sources.size < 2) fail.push('every item is from the same source');

  return { ok: fail.length === 0, fail };
}

/** reports/2026-10-05-longer-context-and-what-it-is-for */
export function reportSlug(number, title) {
  const words = String(title || 'report').toLowerCase().replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/).filter(Boolean).slice(0, 8).join('-');
  return `${number}-${words}`.slice(0, 80);
}
