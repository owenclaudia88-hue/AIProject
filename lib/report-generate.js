/**
 * Turning a week of links into one report.
 *
 * Three passes, and the middle one is the only one that writes.
 *
 *   Select. A hundred and forty candidates, scored on one question: would a
 *   solo founder do something differently because of this? Five to seven
 *   survive, plus one worth a tutorial.
 *
 *   Write. Only from the supporting text we were allowed to fetch, and only
 *   about the items selected. The library goes in too, so the report can point
 *   at the member's own courses and routines rather than at the internet.
 *
 *   Verify. Every claim is read back against the source it came from, by a
 *   pass that has not seen the writing instructions and is asked only whether
 *   the text supports the sentence. Anything unsupported is cut.
 *
 * Then the gate, which is not a model at all. This publishes without anybody
 * reading it, so the last word belongs to something that cannot be persuaded.
 */
import { callTool } from './claude.js';
import { buildCatalogue } from './roadmap-generate.js';
import { REPORT_SCHEMA, validateReport, gateReport } from './reports.js';
import { supportFor, linkWorks, cardFor } from './report-sources.js';

/* ---------------- pass one: what is worth a page ---------------- */

const PICK_TOOL = {
  name: 'shortlist',
  description: 'Choose what goes in this week\'s report.',
  input_schema: {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        description: 'Five to seven urls, best first, copied exactly from the list.',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Exactly as given.' },
            why: { type: 'string', description: 'One line: what a solo founder would do differently.' }
          },
          required: ['url', 'why']
        }
      },
      tutorial: {
        type: 'string',
        description: 'One thing from this week worth twenty minutes of somebody\'s Tuesday, named as '
          + 'an outcome. It does not have to be one of the picks.'
      },
      quiet: {
        type: 'boolean',
        description: 'True if this was a thin week and the report should say so rather than inflate it.'
      }
    },
    required: ['picks']
  }
};

function pickPrompt(items, recentTitles) {
  const list = items.map((i, n) =>
    `${n + 1}. [${i.sourceName}] ${i.title}\n   ${i.url}\n   ${(i.summary || '').slice(0, 220)}`).join('\n');

  return `You are choosing what goes into this week's AI report for AI Founder University.

The readers are solo founders and very small businesses who use AI to run their own marketing,
content, sales and admin. They are not engineers and they are not investors.

# The one test
Would one of these people do something differently this week because they read it? If not, leave it
out, however big the news is. A funding round changes nothing for them. A price change, a new
capability in a tool they already pay for, or a feature that removes an afternoon of work does.

# Choose
- Five to seven items, best first.
- Spread them. Four items from the same company is a press release, not a report.
- Prefer primary announcements over somebody writing about the announcement.
- One of them, or something adjacent, becomes a twenty-minute tutorial. Name it as an outcome
  somebody wants, not as a tool.
- If the week is genuinely thin, say so with "quiet" rather than padding it to seven.

# Already covered in recent reports - do not choose these again
${recentTitles.length ? recentTitles.map((t) => `- ${t}`).join('\n') : '- (nothing yet)'}

# This week
${list}

Call the shortlist tool.`;
}

/* ---------------- pass two: the writing ---------------- */

function writePrompt({ number, chosen, supports, cat, quiet, tutorialIdea }) {
  const evidence = chosen.map((it, n) => {
    const s = supports[it.url];
    return `## Item ${n + 1}
Headline as published: ${it.title}
Source: ${it.sourceName}
URL: ${it.url}
Supporting text we are permitted to use (${s.from}, ${s.chars} chars):
"""
${s.text.slice(0, 5000)}
"""`;
  }).join('\n\n');

  const library = [
    '### Courses (type "course", use the slug)',
    ...cat.courses.slice(0, 20).map((c) => `- ${c.slug} — ${c.title}`),
    '',
    '### Library items (type "item", use the id)',
    ...cat.items.slice(0, 40).map((i) => `- ${i.id} — [${i.kindLabel}] ${i.title}`),
    '',
    '### Downloads (type "download", use the key)',
    ...cat.downloads.slice(0, 20).map((d) => `- ${d.key} — ${d.title}`)
  ].join('\n');

  return `You are writing report number ${number} for AI Founder University: a weekly brief on what
changed in AI and what a solo founder should do about it.

# How an item is laid out, and what is yours to write
Each item appears as the publisher's own card - their headline, their picture, their name and their
date, taken from their page - and underneath it, three things you write:

  What happened — two or three sentences, your words.
  Why it matters for entrepreneurs — one or two sentences.
  How to use it — two to four steps somebody could do this week.

Do not write a headline. Theirs is already on the card, directly above your words, so a line that
restates it wastes the only place the reader is looking.

# The hard rule
You may only say what the supporting text below actually says. If it does not state something, you
do not know it. No filling gaps from memory, no "this likely means", no numbers that are not there.
An item whose supporting text is two sentences long gets two sentences of coverage, and that is
correct rather than a failure.

# Who gets it, and what it costs
Where the supporting text states a price, a plan name, a model id, a limit or who it is available
to, put those exact figures in. "$2.00 per million input tokens", "Pro 200, ten times Plus usage",
"rolling out to eligible accounts" - not "competitively priced" or "now available to more users".
A reader deciding whether to switch tools needs the number, and the number is the one thing a
summary usually drops. If the text does not give it, do not invent one and do not gesture at it.

# Your own words, structurally
Do not reproduce the article's sentences, and do not follow its order of points either. A reader
with the original open in the next tab should not be able to line your paragraph up against theirs.
Say what it means for somebody running a small business - which is the thing the original is not
about and the only reason this page exists.

# Voice
A brief, not a newsletter and not a pitch.
- Plain sentences. No adjective stacks.
- Never: game-changer, revolutionary, groundbreaking, supercharge, seamless, effortless,
  cutting-edge, "the future of", "dive deep", "buckle up". No exclamation marks.
- "Nothing yet" is a valid and valuable action. Most items in most weeks deserve it, and saying so
  is what makes the others believable.
- Never tell the reader what they are feeling or what everyone is talking about.
${quiet ? '- This week was thin. Say so in the opening rather than inflating four items into seven.\n' : ''}
# The tutorial
One thing to do in about twenty minutes${tutorialIdea ? `, built around: ${tutorialIdea}` : ''}. Steps
somebody can follow without guessing, and the one mistake that costs an afternoon.

# What they already own
This is the member's own library. Every id you use - in an item's "resources" and in "Your move" -
must come from this list exactly. An item's steps should point at the specialist, routine or course
that helps carry them out, where one genuinely does. Where none does, leave it empty: a resource
reached for because the slot exists is worse than an empty slot, because it teaches them the
recommendations are decoration.

${library}

# This week's items
${evidence}

Call the report tool. The url on each item must be copied exactly from above.`;
}

const WRITE_TOOL = {
  name: 'report',
  description: 'Deliver the finished weekly report.',
  input_schema: REPORT_SCHEMA
};

/* ---------------- pass three: is it true ---------------- */

const VERIFY_TOOL = {
  name: 'verdicts',
  description: 'Say, per item, whether the source text supports what was written.',
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            supported: { type: 'boolean', description: 'True only if every factual claim appears in the source text.' },
            problem: { type: 'string', description: 'If not supported: the sentence that is not in the source.' }
          },
          required: ['url', 'supported']
        }
      }
    },
    required: ['verdicts']
  }
};

function verifyPrompt(report, supports) {
  const blocks = report.items.map((it) => `## ${it.url}
The publisher's own headline, for context only - it is not ours and is not being checked:
"${it.headline}"

What we wrote:
"${it.what}"
"${it.why}"
${(it.steps || []).map((s) => `"${s}"`).join('\n')}

The source text:
"""
${(supports[it.url]?.text || '').slice(0, 5000)}
"""`).join('\n\n');

  return `Check some writing against its sources. You are not editing it and you have not seen the
instructions it was written under.

For each item: does the source text support every factual claim in what we wrote?

- A claim is a statement about what exists, what changed, what something costs or what it does.
- Opinion and advice are not claims. "This is worth twenty minutes" needs no support. "The context
  window is now one million tokens" does.
- If the source text does not state it, it is not supported, however likely it sounds and however
  well you know it to be true from elsewhere. Your own knowledge is not evidence here.

${blocks}

Call the verdicts tool.`;
}

/* ---------------- the pipeline ---------------- */

/**
 * One report, start to finish.
 *
 * Returns { report, cover: null, gate, dropped, cut, stats }. The caller does
 * the cover and the storing: this is the part that can be tested without
 * writing anything down.
 */
export async function makeReport({ number, collected, entitled, recentTitles = [] }) {
  const stats = { candidates: collected.length };

  /* ---- pass one ---- */
  const picked = await callTool(pickPrompt(collected, recentTitles), PICK_TOOL, { maxTokens: 4000 });
  const picks = (picked.data?.picks || []).slice(0, 7);
  const byUrl = new Map(collected.map((c) => [c.url, c]));
  const chosen = picks.map((p) => byUrl.get(p.url)).filter(Boolean);
  stats.picked = chosen.length;
  if (chosen.length < 3) {
    return { report: null, gate: { ok: false, fail: [`only ${chosen.length} item(s) could be selected`] }, stats };
  }

  /* ---- the evidence ---- */
  const supports = {};
  for (const it of chosen) supports[it.url] = await supportFor(it);
  stats.supportChars = Object.values(supports).reduce((n, s) => n + s.chars, 0);

  /* ---- the library, scored against what the week is about ----
     buildCatalogue turns answers into search terms; the week's own headlines
     are the search here, which is why they are handed to it in that shape. */
  const cat = await buildCatalogue({
    'business.what': chosen.map((c) => c.title).join('. '),
    'goal.priority': picked.data?.tutorial || ''
  }, entitled);

  /* ---- pass two ---- */
  const written = await callTool(writePrompt({
    number, chosen, supports, cat,
    quiet: !!picked.data?.quiet, tutorialIdea: picked.data?.tutorial
  }), WRITE_TOOL, { maxTokens: 32000 });

  if (!written.data) {
    return { report: null, gate: { ok: false, fail: ['the model never produced a report'] }, stats };
  }

  const { report, dropped } = validateReport(written.data, { collected, catalogue: cat, number });
  stats.model = written.model;

  /* ---- pass three ---- */
  let cut = [];
  if (report.items.length) {
    try {
      const checked = await callTool(verifyPrompt(report, supports), VERIFY_TOOL, { maxTokens: 4000 });
      const bad = new Map((checked.data?.verdicts || [])
        .filter((v) => v && v.supported === false)
        .map((v) => [v.url, v.problem || 'not supported by the source']));
      if (bad.size) {
        cut = report.items.filter((i) => bad.has(i.url))
          .map((i) => ({ url: i.url, headline: i.headline, problem: bad.get(i.url) }));
        report.items = report.items.filter((i) => !bad.has(i.url));
        report.sources = report.items.map((i) => ({ name: i.sourceName, url: i.url }));
      }
    } catch (err) {
      // A verification that cannot run is not a verification that passed.
      return { report, gate: { ok: false, fail: [`verification failed to run: ${err.message}`] }, dropped, cut, stats };
    }
  }

  /* ---- the links, actually tried ---- */
  const deadLinks = [];
  for (const it of report.items) {
    if (!(await linkWorks(it.url))) deadLinks.push(it.url);
  }
  if (deadLinks.length) {
    report.items = report.items.filter((i) => !deadLinks.includes(i.url));
    report.sources = report.items.map((i) => ({ name: i.sourceName, url: i.url }));
  }

  /* ---- the publishers' own cards ----
     Last, and only for the items that survived everything else: there is no
     sense fetching a picture for an item the verifier is about to cut. The
     page itself is already cached from the evidence step, so this is mostly
     the image's own HEAD request. */
  await attachCards(report);
  stats.withImage = report.items.filter((i) => i.image).length;

  const gate = gateReport(report, { deadLinks: [] });
  stats.published = report.items.length;
  return { report, gate, dropped, cut, deadLinks, stats };
}

/**
 * The publisher's headline, date and picture, onto each item.
 *
 * Never throws and never blocks the report. An item whose card cannot be built
 * keeps the headline and date the feed gave us and goes out without a picture,
 * which is a card we already have to render anyway - two of our sources never
 * offer an image at all.
 */
export async function attachCards(report) {
  for (const item of report.items) {
    try {
      const card = await cardFor({
        url: item.url, title: item.headline, source: item.source,
        sourceName: item.sourceName, publishedAt: item.publishedAt, also: item.also || []
      });
      if (card.headline) item.headline = card.headline;
      if (card.publishedAt) item.publishedAt = card.publishedAt;
      item.image = card.image || null;
    } catch {
      item.image = null;
    }
    // Working data, not part of the report. It exists so the picture can be
    // looked for on the company's own post rather than on a write-up of it.
    delete item.also;
  }
  return report;
}
