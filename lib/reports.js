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

import { SOURCES } from './report-sources.js';

export const TOPICS = ['what-changed', 'tutorial', 'tools', 'deep-dive'];

/* An item is either this week's news or it is honest about not being. A
   spotlight on a two-month-old tool and a follow-up on an old story both earn
   their place in a thin week; what they must never do is sit unlabelled beside
   a Tuesday announcement and pass for one. */
export const ITEM_KINDS = ['news', 'spotlight', 'deeper'];

/* The sources that ship things rather than report on them. Used by the gate,
   which treats "every item is from one company" differently depending on
   whether that company is the one doing the announcing. */
const OWNER_SOURCES = new Set(SOURCES.filter((s) => s.owner).map((s) => s.key));

/* ---------------- the shape ---------------- */

const str = (description) => ({ type: 'string', description });
const strs = (description) => ({ type: 'array', items: { type: 'string' }, description });

export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: str('ONE benefit, under ten words, about the single most important thing in this report. '
      + 'Lead with what the reader gets: "Your grant applications just got ten times faster". '
      + 'Never a list of the week\'s topics separated by commas - that is a table of contents, not a '
      + 'headline, and it tells somebody nothing about whether to read on.'),
    topic: { type: 'string', enum: TOPICS, description: 'The one this report mostly is.' },
    dek: str('Two sentences. Open with the single most important change this week and what it means '
      + 'for the reader. Never describe the report itself - no "this week has six items", no "below '
      + 'you will find", and never that the week was quiet, slow or thin - that is a sentence about '
      + 'us rather than about the reader. This is the one place to note that figures announced by a '
      + 'company are its own claims; having said it here, do not repeat it on every item.'),
    sixty: strs('Three lines that are the whole report for somebody who reads nothing else. '
      + 'Each one a finding, not a topic.'),
    stats: {
      type: 'array',
      description: 'EXACTLY three numbers a reader would care about, or none at all. Each is a '
        + 'figure plus a short label under thirty characters that fits on a small card. Spread them '
        + 'across the report rather than taking two from one story. A number that means nothing '
        + 'alone - "one-fifth" - is not a stat; "1/5 the price of Astra" is.',
      items: {
        type: 'object',
        properties: {
          value: str('Short enough to read at a glance: "30%", "2 hrs", "$0".'),
          label: str('Under thirty characters, and complete - never a phrase that needs cutting.')
        },
        required: ['value', 'label']
      }
    },
    items: {
      type: 'array',
      description: 'Four to six things that happened, ordered by what they are worth to a solo '
        + 'founder using Claude and other AI tools - not by date, and not by how big the company is. '
        + 'Every one of them must have something concrete to do about it. Anything with nothing to '
        + 'do yet belongs in alsoAnnounced as a single line, not here with a heading and three '
        + 'empty sections. Only from the list you were given, and only what the supporting text '
        + 'actually says. Each is shown under the publisher\'s own headline, picture and date, '
        + 'taken from their page and not yours to write. Everything here is the commentary under it.',
      items: {
        type: 'object',
        properties: {
          url: str('The item\'s url, copied exactly from the list you were given.'),
          kind: {
            type: 'string', enum: ITEM_KINDS,
            description: 'What this is. "news" for something that happened in the week covered. '
              + '"spotlight" for a tool or feature from the last couple of months worth showing '
              + 'now, and "deeper" for a follow-up on an older story. Spotlight and deeper items '
              + 'are labelled on the page so they can never pose as this week\'s news.'
          },
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
    alsoAnnounced: {
      type: 'array',
      description: 'The week\'s other announcements, one line each, no commentary. This is where a '
        + 'launch with no price, no availability and nothing to do about it goes - it still happened '
        + 'and a reader may want to know, but it does not earn a section of its own.',
      items: {
        type: 'object',
        properties: {
          url: str('The item\'s url, copied exactly from the list you were given.'),
          line: str('One sentence. What it is, and that is all.')
        },
        required: ['url', 'line']
      }
    },
    tutorial: {
      type: 'object',
      description: 'One thing to actually do this week, finishable in one sitting. Use Claude '
        + 'unless the story is specifically about another tool - this is written for people whose '
        + 'whole library is built around Claude.',
      properties: {
        title: str('Name the outcome. If you put a time in it, the steps below must add up to that '
          + 'time: a title saying twenty minutes over a body describing three hours is the first '
          + 'thing a reader will notice and the last time they trust one.'),
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
      description: 'Two or three things to do, each one tied to a specific thing the member already '
        + 'owns. This is the section that makes the report worth a membership rather than worth a '
        + 'bookmark, so it gets real work: name the specialist, routine, course lesson or download '
        + 'by its exact id, and say what it does for them here. One generic course link is a wasted '
        + 'section. Only ids from the catalogue you were given.',
      properties: {
        intro: str('One or two sentences. Never count what follows - no "three things from your '
          + 'library" - because the count is the part that goes wrong, and a line promising three '
          + 'over a list of one is the first thing a reader notices.'),
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
 * Three stat cards, or none, with labels that fit the card they sit in.
 *
 * Exported because the repair pass writes stats too, and it used to do its own
 * shaping with looser rules - trimming a label to forty characters and keeping
 * it. So validation would correctly drop an over-long label, that would leave
 * fewer than three stats, which was itself the trigger for the repair, which
 * then put the same over-long labels back and truncated them on the page. The
 * second run published "AWS began releasing spend limits to a li".
 *
 * Measured before trimming, not after. Trimming to thirty and then asking
 * whether it is under thirty is how a label that does not fit becomes a label
 * that has been cut off.
 */
export function shapeStats(stats) {
  const ok = list(stats)
    .map((s) => ({
      value: String((s && s.value) || '').trim(),
      label: String((s && s.label) || '').trim()
    }))
    .filter((s) => s.value && s.label && s.label.length <= 30 && s.value.length <= 20);
  // Fewer than three and the row looks unfinished, so the row goes.
  return ok.length >= 3 ? ok.slice(0, 3) : [];
}

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
      kind: ITEM_KINDS.includes(raw && raw.kind) ? raw.kind : 'news',
      publishedAt: source.publishedAt || null,
      // How it was found, when it was not one of our own feeds. Shown to the
      // admin and never to a member: it is provenance, not a credit line.
      via: clean(source.via, 60) || undefined,
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
  }).filter(Boolean).filter((i) => i.what && i.why).slice(0, 6);

  /* The short list. Same rule as the items: a line may only carry a link we
     actually fetched, and anything already covered above is dropped rather
     than said twice. */
  const covered = new Set(parsedItems.map((i) => i.url));
  const alsoAnnounced = list(parsed.alsoAnnounced).map((raw) => {
    const url = clean(raw && raw.url, 500);
    const source = byUrl.get(url);
    if (!source || covered.has(url)) return null;
    const line = clean(raw.line, 240);
    return line ? { url, line, sourceName: source.sourceName, via: clean(source.via, 60) || undefined } : null;
  }).filter(Boolean).slice(0, 5);

  const tut = parsed.tutorial && typeof parsed.tutorial === 'object' ? parsed.tutorial : {};
  const move = parsed.yourMove && typeof parsed.yourMove === 'object' ? parsed.yourMove : {};

  return {
    report: {
      number: Number(number) || 0,
      title: clean(parsed.title, 160),
      topic: TOPICS.includes(parsed.topic) ? parsed.topic : 'what-changed',
      dek: clean(parsed.dek, 500),
      sixty: list(parsed.sixty).map((s) => clean(s, 300)).filter(Boolean).slice(0, 4),
      /* Three, or none. A label that does not fit the card is cut off on the
         page, and a stat reading "per O" is worse than no stat at all - the
         reader cannot tell whether the number is wrong or the page is. So the
         length is a condition of keeping it, not something trimmed to fit.
         Fewer than three and the row looks unfinished, so the row goes. */
      stats: shapeStats(parsed.stats),
      items: parsedItems,
      alsoAnnounced,
      tutorial: {
        title: clean(tut.title, 160),
        intro: clean(tut.intro, 500),
        steps: list(tut.steps).map((s) => ({
          title: clean(s && s.title, 160), detail: clean(s && s.detail, 600)
        })).filter((s) => s.title && s.detail).slice(0, 8),
        watchOut: clean(tut.watchOut, 400)
      },
      yourMove: { intro: clean(move.intro, 500), resources: resources(move.resources) },
      // Everything on the page that points outward, items and short list both.
      sources: [...parsedItems, ...alsoAnnounced].map((i) => ({ name: i.sourceName, url: i.url }))
    },
    dropped
  };
}

/* ---------------- what is wrong, as questions anything can ask ----------------

   The gate uses these to refuse. The repair step uses the same ones to decide
   what to fix, which is the point: a fault described in two places drifts, and
   then the pipeline repairs something the gate is not complaining about while
   the thing it is complaining about goes out. */

/** Writing that describes our own plumbing rather than the news. */
const PLUMBING = /\b(the (?:supporting )?(?:text|summary|snippet|feed)|the article (?:is|was) (?:cut off|truncated)|we (?:have|had|were given|could not (?:read|fetch|access))|our (?:source )?text|nothing else is in the (?:text|summary)|based on the (?:text|summary) (?:we|provided)|the (?:text|summary) (?:does not|doesn't) (?:say|mention|give))\b/i;

export const readsLikePlumbing = (s) => PLUMBING.test(String(s || ''));

/**
 * A headline that is a table of contents.
 *
 * Two commas is the obvious shape. One comma and an "and" is the same thing
 * written tidily - "Agents get skills, budget caps and tighter Mac access" is
 * three topics in a row, and it went out under a rule that counted commas.
 */
export function titleIsList(title) {
  const t = String(title || '');
  const commas = (t.match(/,/g) || []).length;
  return commas >= 2 || (commas >= 1 && /\s(?:and|&|plus)\s/i.test(t));
}

/** Prose that apologises to the reader for our quiet week. */
const THIN_TALK = /\b(?:a |this |another )?(?:quiet|slow|thin|light|sparse|uneventful)\s+(?:week|one)\b|\bnot much (?:happened|to report)\b|\bslow news\b/i;

export const saysWeekWasQuiet = (report) =>
  [report.title, report.dek, ...(report.sixty || [])].filter(Boolean).find((s) => THIN_TALK.test(s)) || null;

/** A tutorial promising twenty minutes over a body describing three hours. */
export function tutorialTimeMismatch(tutorial) {
  const t = tutorial || {};
  const promised = minutesIn(t.title);
  const inBody = [t.intro, ...(t.steps || []).map((s) => `${s.title} ${s.detail}`)]
    .filter(Boolean).map(minutesIn).filter(Boolean);
  if (!promised || !inBody.length) return null;
  const longest = Math.max(...inBody);
  return longest > promised * 2 ? { promised, longest } : null;
}

/** Items presented as this week's news that are not from this week. */
export function staleNewsItems(items, weekStart) {
  if (!weekStart) return [];
  const start = new Date(weekStart).getTime();
  return (items || []).filter((i) =>
    (i.kind || 'news') === 'news' && i.publishedAt && new Date(i.publishedAt).getTime() < start);
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
export function gateReport(report, { deadLinks = [], weekStart = null } = {}) {
  const fail = [];

  /* A thin week may be carried by a spotlight or a follow-up, and both say so
     on the page. What makes that honest rather than cosmetic is this: an item
     presented as this week's news must actually be from this week. Without the
     check the labels are a request, and the easiest way to fill a quiet week
     would be to call a month-old launch "news" and have nobody notice. */
  const stale = staleNewsItems(report.items, weekStart);
  if (stale.length) {
    fail.push(`${stale.length} item(s) labelled this week's news are older than the week: `
      + stale.map((i) => `${i.sourceName} ${String(i.publishedAt).slice(0, 10)}`).slice(0, 3).join(', '));
  }

  /* The report must not tell a member the week was quiet. It is a line about
     our week rather than theirs, and it is the quickest way to teach somebody
     to stop opening it. The labels are the honest disclosure instead. */
  const thin = saysWeekWasQuiet(report);
  if (thin) fail.push(`the report tells the reader the week was quiet: "${String(thin).slice(0, 80)}…"`);

  // The prose, not the JSON around it. Counting the serialised object counts
  // braces and field names, which is how a thin report passes a length check.
  const prose = [
    report.dek,
    ...report.sixty,
    // The publisher's headline is not counted: it is their writing, carried on
    // the card, and counting it would let a thin report borrow their length.
    ...report.items.flatMap((i) => [i.what, i.why, ...(i.steps || [])]),
    ...(report.alsoAnnounced || []).map((a) => a.line),
    report.tutorial.intro,
    ...report.tutorial.steps.flatMap((s) => [s.title, s.detail]),
    report.tutorial.watchOut,
    report.yourMove?.intro
  ].filter(Boolean).join(' ');
  const words = prose.split(/\s+/).filter(Boolean).length;

  if (!report.title || report.title.split(/\s+/).length > 11) fail.push('title missing or too long');

  /* A headline that lists the week's topics is a table of contents. It is the
     single easiest thing for a model to fall back on and the single least
     useful thing for somebody deciding whether to read, so it is refused
     rather than hoped against. */
  if (titleIsList(report.title)) fail.push('the title is a list of topics rather than one benefit');

  /* Writing that describes its own plumbing. "The text we have is a short
     summary" tells a member we read an RSS snippet; "the article is cut off"
     tells them our fetcher failed. Neither is their business, and both read as
     an excuse. If something is unpublished, the report says so about the
     company, not about us. */
  /* Prose about the page rather than the news. The sibling of the plumbing
     check, and found the same way: a report with everything cut out of it
     opened with "This report is written for solo founders. No individual items
     are listed in it." Both are the writing turning round to look at itself. */
  const ABOUT_ITSELF = new RegExp([
    // The subject is the page: "this report is written for…"
    '\\b(?:this|the) report (?:is|was|has|contains|lists|covers|includes|does not)\\b',
    '\\bthis (?:edition|issue) (?:has|contains|is)\\b',
    // Or the subject is hidden and only the complaint shows: "it lists no
    // items", "nothing to point to". Matched on the phrasing rather than the
    // pronoun, because the pronoun is the part that varies.
    '\\blists no (?:items|news|stories)\\b',
    '\\bno (?:individual )?items are listed\\b',
    '\\bno (?:companies|products|figures|items|cases|stories)[^.]{0,40}to (?:summarise|summarize|point to|report)\\b',
    '\\bnothing to act on from this\\b',
    '\\bno tutorial (?:is )?attached\\b'
  ].join('|'), 'i');
  const selfTalk = [report.title, report.dek, ...report.sixty].filter((s) => s && ABOUT_ITSELF.test(s));
  if (selfTalk.length) {
    fail.push(`the report describes itself rather than the news: "${String(selfTalk[0]).slice(0, 80)}…"`);
  }

  const metaHits = [
    report.dek, ...report.sixty,
    ...report.items.flatMap((i) => [i.what, i.why, ...(i.steps || [])]),
    ...(report.alsoAnnounced || []).map((a) => a.line)
  ].filter(readsLikePlumbing);
  if (metaHits.length) {
    fail.push(`${metaHits.length} passage(s) describe what the pipeline could read: `
      + `"${String(metaHits[0]).slice(0, 90)}…"`);
  }
  if (!report.dek || report.dek.length < 60) fail.push('no opening paragraph');
  if (report.sixty.length < 2) fail.push('fewer than two summary lines');
  if (report.items.length < 3) fail.push(`only ${report.items.length} item(s) survived validation`);
  if (report.items.some((i) => !i.why)) fail.push('an item has no "why it matters"');
  if (report.items.some((i) => !i.headline)) fail.push('an item has no source headline');
  if (report.items.some((i) => !(i.steps || []).length)) fail.push('an item has no "how to use it"');
  if (report.items.length > 6) fail.push(`${report.items.length} items — more than six is a digest, not a brief`);
  if (report.tutorial.steps.length < 3) fail.push('the tutorial has fewer than three steps');
  if (!report.tutorial.title) fail.push('the tutorial has no title');

  /* The section that is supposed to be worth the membership. One generic link,
     or none, means the week's report sent nobody back into the library. */
  /* Two is the floor, not one. The brief asks for two or three, and a run that
     produced a single link opened it with "Three things from your library map
     straight onto this week's changes" - the intro counted what it meant to
     write rather than what was there. */
  const moves = (report.yourMove?.resources || []).length;
  if (!moves) fail.push('"Your move" names nothing from the member\'s own library');
  else if (moves < 2) fail.push('"Your move" names only one thing from the library, and asks for two');

  /* And it must not announce a number, because the number is the part that
     goes wrong. */
  const counted = /\b(two|three|2|3)\s+things\b/i.exec(String(report.yourMove?.intro || ''));
  if (counted && moves !== ({ two: 2, three: 3, 2: 2, 3: 3 })[counted[1].toLowerCase()]) {
    fail.push(`"Your move" says "${counted[0]}" and lists ${moves}`);
  }

  /* A tutorial promising twenty minutes over a body describing three hours is
     the first thing a reader notices and the last time they believe one. Both
     numbers are read off the text and compared. */
  const clash = tutorialTimeMismatch(report.tutorial);
  if (clash) fail.push(`the tutorial promises ${clash.promised} minutes and then describes ${clash.longest}`);
  if (deadLinks.length) fail.push(`${deadLinks.length} link(s) did not answer: ${deadLinks.slice(0, 3).join(', ')}`);
  // Recalibrated when the brief went from four-to-seven items down to three-
  // to-five. The floor was set against the old shape, and a tight three-item
  // report written exactly as asked now lands just under it.
  if (words < 180) fail.push(`too thin at about ${words} words`);

  const flat = JSON.stringify(report).toLowerCase();
  const found = BANNED.filter((b) => flat.includes(b));
  if (found.length) fail.push(`house style: ${found.join(', ')}`);

  /* A report whose items all come from one publisher is a press release -
     unless that publisher is the company that shipped the things.

     The exemption is not a loophole, it is a week that really happens. OpenAI
     announced more than twenty things at DevDay on one day in September, and a
     report about that week is legitimately all OpenAI. Without this, the gate
     would hold the single most useful report of the quarter at seven on a
     Monday morning with nobody awake to overrule it, which is the exact
     failure the gate exists to avoid causing.

     What it still refuses is six rewrites of one outlet's coverage. */
  const sources = new Set(report.items.map((i) => i.source));
  if (report.items.length >= 4 && sources.size < 2) {
    const only = report.items[0].source;
    if (!OWNER_SOURCES.has(only)) fail.push('every item is from the same source');
  }

  return { ok: fail.length === 0, fail };
}

/**
 * The largest duration a piece of text claims, in minutes, or 0.
 *
 * Words as well as digits, because a title almost never uses a numeral: "Try
 * this: twenty minutes" is the house style, and a check that only reads digits
 * would have passed every tutorial we will ever write.
 */
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, half: 0.5
};

function minutesIn(text) {
  const s = String(text || '');
  let most = 0;

  const take = (n, unit) => {
    const u = unit.toLowerCase();
    // A working day, not a calendar one: "three days" of effort is what a
    // reader is being asked for, not seventy-two hours of it.
    const mins = u.startsWith('d') ? n * 60 * 8 : u.startsWith('h') ? n * 60 : n;
    if (mins > most) most = mins;
  };

  const words = Object.keys(WORD_NUMBERS).join('|');
  const re = new RegExp(
    `(?:(\\d+(?:\\.\\d+)?)|\\b(${words}))\\s*(?:(?:to|-|–|or)\\s*(?:\\d+|${words})\\s*)?(minute|min|hour|hr|day)s?\\b`,
    'gi'
  );
  let m;
  while ((m = re.exec(s))) take(m[1] ? Number(m[1]) : WORD_NUMBERS[m[2].toLowerCase()], m[3]);

  // "half an hour", "an hour", which the pattern above cannot reach.
  if (/\bhalf an hour\b/i.test(s)) take(30, 'minute');
  if (/\ban hour\b/i.test(s)) take(1, 'hour');

  return most;
}

/** reports/2026-10-05-longer-context-and-what-it-is-for */
export function reportSlug(number, title) {
  const words = String(title || 'report').toLowerCase().replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/).filter(Boolean).slice(0, 8).join('-');
  return `${number}-${words}`.slice(0, 80);
}
