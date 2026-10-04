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
      thin: {
        type: 'boolean',
        description: 'True if there were fewer than four items worth a page from this week, so you '
          + 'reached back for a spotlight or a follow-up. This is a note to the admin screen, not '
          + 'to the reader: the report never says the week was quiet.'
      }
    },
    required: ['picks']
  }
};

function pickPrompt(items, recentTitles, fresh) {
  const list = items.map((i, n) =>
    `${n + 1}. [${i.sourceName}${i.owner ? ', who shipped it' : ''}${i.thisWeek === false ? ', OLDER than this week' : ''}] `
    + `${i.title}\n   ${i.url}\n   ${(i.summary || '').slice(0, 220)}`).join('\n');

  return `You are choosing what goes into this week's AI report for AI Founder University.

The readers are solo founders and very small businesses who use AI to run their own marketing,
content, sales and admin. They are not engineers and they are not investors.

# The one test
Would one of these people do something differently this week because they read it? If not, leave it
out, however big the news is. A funding round changes nothing for them. A price change, a new
capability in a tool they already pay for, or a feature that removes an afternoon of work does.

# Choose
- Four to six items, best first, ordered by what they are worth to these readers rather than by
  date or by the size of the company. A new or updated Claude model is always one of them, and it
  outranks a customer success story. A new model at the same price is actionable: test it on one task.
- After Claude, in order: releases and price changes in tools these readers already use or could use
  this month; case studies with results they could copy; and risks worth acting on - billing,
  security, policy.
- Everything you pick must have something concrete a reader could do. If the only honest advice is
  "wait and see", leave it out: it will be listed in one line elsewhere, and it does not need a page.
- Spread them. Four items from the same company is a press release, not a report.
- Prefer the announcing company's own page over anybody writing about it. If both the company and a
  commentator are in the list below for the same news, pick the company's and leave the commentary;
  a write-up is worth choosing only when nobody has announced the thing directly.
- One of them, or something adjacent, becomes a twenty-minute tutorial. Name it as an outcome
  somebody wants, not as a tool.

# A thin week is filled, never announced
The report goes out either way, and it never tells the reader the week was quiet, slow or thin -
that is a line about our week, not theirs, and it is the fastest way to teach somebody to stop
opening it. If there are fewer than four items worth a page from this week, fill it in this order,
and mark what you take:

1. The list below reaches back a fortnight. Items marked OLDER than this week are fair game.
2. A tool spotlight: something from the last couple of months that suits a solo founder, with a
   practical use. Set kind "spotlight".
3. A deeper look: a follow-up on an older story — what has changed since, and how to use it now.
   Set kind "deeper".

Anything not from this week must carry "spotlight" or "deeper". It is labelled on the page, and a
report that dates an old item as this week's news is caught and held, so there is nothing to gain by
quietly promoting one.

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

# Never describe your own plumbing
The reader does not know there is a pipeline and must not learn it from the prose. Never write "the
text we have is only a short summary", "the article is cut off", "the summary gives no dollar
figures", "nothing else is in the text". That is a note about our fetcher wearing the clothes of a
fact, and it reads as an excuse.

When something is not known, say it about the company, not about us:
  no:  "The summary gives no pricing."
  yes: "OpenAI has not published pricing."
And when an item has so little behind it that there is nothing to say and nothing to do, it does not
belong in the main list at all - put it in alsoAnnounced as one line.

# Say the caveat once
Figures a company publishes about its own product are that company's claims. Say so once, in the
opening, and then write plainly. Repeating "vendor's own figures", "a claim to check" and "treat
this as something to test" under every item makes the whole report sound unsure of itself.

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
${quiet ? '- This week was thin, so a spotlight or a follow-up is carrying part of it. Never say so in\n'
  + '  the prose: the labels on those items are the honest disclosure, and a line about our quiet\n'
  + '  week is a line about us rather than about the reader.\n' : ''}
# What goes where
- Four to six items, ordered by what they are worth to a solo founder using Claude, not by date
  and not by how big the company is. A new Claude model matters more here than a customer story.
- Every item must have something concrete to do. If there is nothing to do, it is not an item.
- Everything else from the week goes in "alsoAnnounced": up to five, one line each, no commentary.
- Each item's "kind": "news" for this week, "spotlight" for a tool from the last couple of months
  worth showing now, "deeper" for a follow-up on an older story. The last two are labelled on the
  page, so they are honest ways to fill a quiet week - but never label something "news" that is not.
- The title is one benefit under ten words, about the biggest thing in the report. Not a list of
  topics separated by commas.
- The opening starts with that same thing and what it means. Never "this week has six items".
- Exactly three stats, or none. Each a figure plus a label under thirty characters, drawn from
  across the report rather than two from one story. "One-fifth" alone is not a stat.

# The tutorial
One thing to do${tutorialIdea ? `, built around: ${tutorialIdea}` : ''}. Steps somebody can follow
without guessing, and the one mistake that costs an afternoon. Use Claude unless the story is
specifically about another tool - these readers' whole library is built around Claude. If you put a
time in the title, the steps must add up to it: twenty minutes in the title over three hours in the
body is the first thing a reader notices.

# What they already own
This is the member's own library, and "Your move this week" is the section that makes this report
worth a membership rather than worth a bookmark. Two or three actions, each one tied to a specific
thing in the list below by its exact id, with a line on what it does for them here. One generic
course link is a wasted section.

Every id you use - in an item's "resources" and in "Your move" - must come from this list exactly.
An item's steps should point at the specialist, routine or lesson that helps carry them out where
one genuinely does; where none does, leave that item's resources empty rather than reaching for
something close, because a recommendation that does not fit teaches them the recommendations are
decoration.

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
export async function makeReport({ number, collected, entitled, recentTitles = [], weekStart = null, fresh = null }) {
  const stats = { candidates: collected.length, fresh };

  /* ---- pass one ---- */
  const picked = await callTool(pickPrompt(collected, recentTitles, fresh), PICK_TOOL, { maxTokens: 4000 });
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
    quiet: !!picked.data?.thin, tutorialIdea: picked.data?.tutorial
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

  /* ---- the summary, after the cutting ----
     The opening, the sixty-second list, the numbers and the tutorial are all
     written in the same pass as the items, which means they are written before
     anything is cut and describe a report that no longer exists.

     The first real report showed exactly this: the fact check removed a case
     study, and the opening still announced it, the sixty-second summary still
     quoted its figures, two of the four numbers came from it and the whole
     tutorial was built on it - with no item and no link anywhere on the page.
     The footer promising that every claim links to its source was, at that
     point, simply false.

     So when something is cut, the parts that summarise are rewritten against
     what survived. */
  if (cut.length || deadLinks.length) {
    try {
      await resummarise(report);
      stats.resummarised = true;
    } catch (err) {
      // Better a held report than one whose opening describes a different one.
      return {
        report,
        gate: { ok: false, fail: [`${cut.length + deadLinks.length} item(s) were removed and the `
          + `summary could not be rewritten to match: ${err.message}`] },
        dropped, cut, deadLinks, stats
      };
    }
  }

  /* ---- the publishers' own cards ----
     Last, and only for the items that survived everything else: there is no
     sense fetching a picture for an item the verifier is about to cut. The
     page itself is already cached from the evidence step, so this is mostly
     the image's own HEAD request. */
  await attachCards(report);
  stats.withImage = report.items.filter((i) => i.image).length;

  const gate = gateReport(report, { deadLinks: [], weekStart });
  stats.published = report.items.length;
  stats.filled = report.items.filter((i) => (i.kind || 'news') !== 'news').length;
  return { report, gate, dropped, cut, deadLinks, stats };
}

/* ---------------- the repair, when something is cut ---------------- */

const RESUMMARY_TOOL = {
  name: 'resummary',
  description: 'Rewrite the parts of a report that summarise it, after items were removed.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'At most nine words. Keep the old one if it still fits.' },
      dek: { type: 'string', description: 'Two sentences: what is in this week and what to notice.' },
      sixty: { type: 'array', items: { type: 'string' },
        description: 'Three lines that are the whole report for somebody who reads nothing else.' },
      stats: {
        type: 'array',
        description: 'OPTIONAL. Numbers that frame the week. Leave out rather than invent.',
        items: {
          type: 'object',
          properties: { value: { type: 'string' }, label: { type: 'string' } },
          required: ['value', 'label']
        }
      },
      tutorialOk: { type: 'boolean',
        description: 'False if the tutorial depends on something no longer in the report.' },
      tutorialNote: { type: 'string', description: 'If false: one line on what it depended on.' }
    },
    required: ['title', 'dek', 'sixty', 'tutorialOk']
  }
};

/**
 * Rewrite the opening, the summary lines and the numbers against what is left.
 *
 * The model is given only the surviving items and is told nothing about what
 * was removed or why, deliberately: knowing a thing was cut is an invitation
 * to allude to it, and an allusion to an item that is not on the page is the
 * problem rather than the fix.
 */
async function resummarise(report) {
  const items = report.items.map((it, n) =>
    `## Item ${n + 1} — ${it.sourceName}\n${it.headline}\n${it.what}\n${it.why}`).join('\n\n');

  const out = await callTool(`Below is every item in a weekly AI report for AI Founder University,
whose readers are solo founders and very small businesses.

Rewrite the parts that summarise it so they describe these items and nothing else.

- The opening and the summary lines may only mention things that appear below. No company, product,
  figure or case study that is not here.
- Numbers must come from the text below. If there are none worth pulling out, return no stats at
  all rather than inventing some.
- Plain sentences. Never: game-changer, revolutionary, groundbreaking, supercharge, seamless,
  effortless, cutting-edge, "the future of", "dive deep", "buckle up". No exclamation marks.
- Never tell the reader the week was quiet, slow or thin, and never mention that anything was
  removed. Describe what is here as though it is what there was.

The tutorial currently in this report is:
"${report.tutorial?.title || '(none)'}" — ${report.tutorial?.intro || ''}
Say whether it still stands on the items below, or whether it was built on something not here.

# The items
${items}

Call the resummary tool.`, RESUMMARY_TOOL, { maxTokens: 4000 });

  const d = out.data;
  if (!d || !d.dek || !Array.isArray(d.sixty) || !d.sixty.length) {
    throw new Error('the rewrite came back empty');
  }

  if (d.title) report.title = String(d.title).slice(0, 160);
  report.dek = String(d.dek).slice(0, 500);
  report.sixty = d.sixty.map((s) => String(s).slice(0, 300)).filter(Boolean).slice(0, 4);
  report.stats = (Array.isArray(d.stats) ? d.stats : [])
    .map((s) => ({ value: String(s?.value || '').slice(0, 24), label: String(s?.label || '').slice(0, 40) }))
    .filter((s) => s.value && s.label).slice(0, 4);

  /* A tutorial built on an item that was cut is the same bug one level down,
     and it cannot be rewritten from the remaining items without inventing the
     steps. It is removed, and the gate's "fewer than three steps" rule then
     holds the report for a human - which is the right outcome, because what is
     left is a report whose centrepiece has gone. */
  if (d.tutorialOk === false) {
    report.tutorial = { title: '', intro: '', steps: [], watchOut: '' };
    report.tutorialDropped = String(d.tutorialNote || 'it depended on an item that was removed').slice(0, 300);
  }

  return report;
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
