/**
 * The weekly writer: new tutorials and skills, from the week the sources had.
 *
 * Two passes, because choosing and writing are different jobs and doing both
 * at once produces four pieces about the same launch. First it reads the
 * week's stories and picks what is worth a piece, giving each one a shape.
 * Then it writes each piece on its own, with only that story in front of it.
 *
 * ---- on shape ----
 *
 * There is no single template here on purpose. A product launching wants a
 * manual; a claim going round wants an investigation; a model everyone is
 * shouting about wants an explainer that goes and checks. Forcing all three
 * into one outline is what makes a content library read as generated, and it
 * is the difference between a piece somebody finishes and a piece somebody
 * recognises as filler by the third heading.
 *
 * What is constant is the voice and the furniture: plain-English headings
 * rather than "Introduction", an honest section about what the thing cannot
 * do, a close that says what to do on Monday, and the sources at the bottom.
 * Those are the parts that make it worth paying for.
 *
 * ---- on honesty ----
 *
 * The writer is given the story's own summary and nothing else. It is told to
 * write only what that supports, to attribute a company's claim about its own
 * product as that company's claim, and to leave out a number it cannot source.
 * The gate then refuses a piece that has no sources section, no limits
 * section, or that is too short to be worth anybody's twenty minutes - the
 * same arrangement the weekly report uses, for the same reason: nobody reads
 * this before members would.
 */
import { callTool, newMeter, MODEL } from './claude.js';
import { imageFor, articleText } from './report-sources.js';

/* The shapes, as the four pieces sampled from a competitor's library actually
   run. Each is a sequence of beats rather than headings to copy: the writer is
   asked for its own headings, because the headings are most of the voice. */
export const SHAPES = {
  manual: {
    when: 'a product, model or feature has just launched and a reader could start using it this week',
    words: [4200, 5800],
    beats: [
      'what it actually is, and what it is not - the confusion worth clearing first',
      'what it can do for you, concretely',
      'why it is worth your time, or is not',
      'what you need before you start',
      'setting it up, step by step',
      'the first things to hand it, with the literal prompts',
      'how it compares with what you already use',
      'the permissions and the money, said plainly',
      'good to know before you go all in',
      'your next step'
    ]
  },
  investigation: {
    when: 'a claim, trick or technique is going round and nobody has checked whether it holds',
    words: [4000, 5400],
    beats: [
      'what changed, and what started going round because of it',
      'whether you can even run it - the prerequisite nobody mentions',
      'the claims, audited one at a time, each ending in a verdict',
      'what has actually been shown to work',
      'how to do the ones that survived, properly',
      'what it costs and what to watch',
      'how it compares with what you already pay for',
      'what to do this week'
    ]
  },
  explainer: {
    when: 'a model or tool is being argued about and the reader cannot tell hype from substance',
    words: [4000, 5600],
    beats: [
      'what the thing actually is, stripped of the launch language',
      'the confusion worth clearing up first',
      'what it is good at, with examples',
      'what it is bad at',
      'what it costs, in money and in time',
      'how it stacks up against the obvious alternatives',
      'how to try it without committing',
      'where to start'
    ]
  },
  concept: {
    when: 'the story is really about a method or a way of working rather than one product',
    words: [4000, 5400],
    beats: [
      'the problem the reader already has and has not named',
      'the idea, in one sentence they could repeat',
      'the pieces it breaks into, one section each',
      'what it looks like worked through end to end',
      'setting it up',
      'the mistakes that make it fail',
      'what to do this week',
      'the part worth remembering'
    ]
  }
};

/* The markup the member area already styles, taken from the .guide rules
   rather than guessed at. A class outside this list is not a style that is
   missing - it renders as an unstyled div on a dark page, which is how a
   migrated piece ends up with a paragraph that looks like a mistake.
   The existing 64 tutorials and 67 skills use exactly this vocabulary, so a
   written piece sits beside them without anybody being able to tell which is
   which from the layout. */
/* Copied from the 42 tutorials rather than remembered. Every shape below was
   read out of the library: the section wrapper, the "Section 01" label with
   that exact capitalisation and zero padding, the callout-icon as a div with
   the paragraph as its sibling, the lede that opens the piece before the
   first section. Getting these wrong is what made the first attempt read as
   something else wearing the same stylesheet. */
const MARKUP = `THE SKELETON. The piece opens with a lede and then runs as numbered sections:

<p class="lede">One or two sentences that make somebody want to read on.</p>
<p>A paragraph of context: what happened, when, and the condition attached to it.</p>
<p>A sentence saying what this tutorial will do for them and what they will be able to do by the end.</p>

<section>
  <div class="section-label">Section 01</div>
  <h2>What Astra Actually Changed</h2>
  <p>…</p>
</section>
<hr class="divider">
<section>
  <div class="section-label">Section 02</div>
  <h2>…</h2>
</section>

Labels are exactly "Section 01", "Section 02" — that capitalisation, zero-padded,
one per section, in order. Every section is wrapped in <section>.

THE PARTS, used where the material calls for them:

<div class="callout callout-yellow"><div class="callout-icon">âš ï¸</div>
  <p><strong>A bold lead-in.</strong> Then the point.</p></div>
  — callout-yellow to warn, callout-green for something that works, callout-accent
    to emphasise, plain callout for an aside. Five to eight across the piece.

<div class="instruction-block"><div class="ib-label">Three prompts to start with</div>
  <p>The literal thing to type or paste.</p></div>
  — for anything the reader copies. In nearly every tutorial.

<div class="feature-grid">
  <div class="feature-card"><div class="feature-title">Name</div>
    <div class="feature-desc">What it is, in a sentence or two.</div></div>
</div>

<div class="table-wrap"><table><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table></div>

Also: <h3>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <span class="price">$20/mo</span>.
No <style>, no <script>, no <html>/<head>/<body>, no class outside this list.

NO LINKS. Not one <a href> anywhere in the piece. The library's 42 tutorials
carry 24 links between them and every one points at a tool somebody is meant to
go and use, never at a citation. You name the source in the sentence instead -
"OpenAI's help center says", "Meta reports" - and list the sources at the end.

Where a piece leans on several published documents, it may close with a plain
list of them inside the last section - one tutorial in fifty does this, so use
it only when the sourcing is genuinely worth setting out:

<h3>Sources for this tutorial</h3>
<ul class="sources">
  <li>OpenAI: "Introducing dots" and "How we build safety into dots" (September 29, 2026)</li>
  <li>Launch coverage from Axios, TechCrunch, VentureBeat and Engadget</li>
</ul>
<p class="small-note">Details are current as of October 6, 2026. This is moving
quickly, so check the help center before relying on any limit, price or date.</p>

Publications and document titles, in plain text with dates. Never a link.`;

/* Measured off the library, not imagined. "you" appears 4,120 times across the
   42 tutorials and "we" 134, so the reader is you and the publication is we -
   we is for what we went and checked. American spelling throughout: color 106
   to colour 22, percent 59 to "per cent" 0, center 73 to centre 6. */
const VOICE = `Write for somebody running a business on their own who has twenty minutes.

American English. Say color, percent, center, organize, favorite. Dates are
"September 3, 2026".

The reader is "you", and you talk to them constantly. The publication is "we",
used sparingly and only for what we actually did: "We went looking for anybody
who had run those prompts. We found nobody." Never "I".

Short sentences, one idea each. Fragments are fine for a list of things:
"Negotiate your bills. Watch Marketplace for underpriced listings. Spy on your
competitors." Open on something concrete rather than a definition.

Headings say something and are specific to this piece - "What Astra Actually
Changed", "First, Check If You Can Even Run It", "The Money and the Guardrails".
Never "Introduction", "Overview", "Conclusion", "Getting Started", or a bare
noun like "Pricing".

No marketing language. No "unlock", "leverage", "game-changing", "in today's
fast-paced world", "dive in", "it's a game changer". No sentence beginning
"But here's the thing". Do not hedge every claim into mush; say the thing, and
where it is not known, say that plainly in the sentence rather than in a
warning box at the top.`;

/* ---------------- pass one: what is worth writing ---------------- */

const PICK_TOOL = {
  name: 'picks',
  description: 'The stories worth a piece this week, and the shape each one wants.',
  input_schema: {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'the story url, copied exactly from the list' },
            title: { type: 'string', description: 'the working title of the piece, not the story headline' },
            /* Tutorials only, for now. A "skill" in this library is a plugin
               file plus the page explaining it - every one of the 67 carries a
               fileKey, fileName and fileSize - and a skill page with no
               installable file behind it is an article about something that
               does not exist. Writing the file is a different job from writing
               the page and is not attempted here. */
            kind: { type: 'string', enum: ['video'], description: 'a tutorial' },
            shape: { type: 'string', enum: Object.keys(SHAPES) },
            angle: { type: 'string', description: 'one sentence: what this piece is for and who needs it' },
            why: { type: 'string', description: 'one sentence: why a solo business owner should care this week' },
            /* The picker is already doing this in its head - it rejects
               duplicates with notes like "same story as the pick, I used the
               OpenAI source because it has the measurement detail" - so it may
               as well say which they were. The collector's own deduplication
               matches on title shape and merged 3 stories out of 299, because
               "OpenAI launches visual ads in ChatGPT image generation" and
               "OpenAI is sticking more ads in ChatGPT" share almost no words. */
            related: {
              type: 'array',
              description: 'urls from the list above covering this same announcement — other outlets, the company\'s own post, a review. Copy them exactly. Up to four.',
              items: { type: 'string' }
            }
          },
          required: ['url', 'title', 'kind', 'shape', 'angle', 'why', 'related']
        }
      },
      passed: {
        type: 'array',
        description: 'stories deliberately not chosen, and why, so a quiet week is visible',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, why: { type: 'string' } },
          required: ['title', 'why']
        }
      }
    },
    required: ['picks', 'passed']
  }
};

/**
 * Which of the week's stories deserve a piece.
 *
 * Deliberately allowed to return fewer than asked. A week with two real
 * stories should produce two pieces; padding it to four is how a library
 * fills with writing about nothing, and the admin can see what was passed
 * over and disagree.
 */
export async function choosePieces({ stories, recentTitles = [], want = 4, meter = null }) {
  const list = stories.slice(0, 60).map((s, i) =>
    `${i + 1}. ${s.title}\n   ${s.sourceName} · ${String(s.publishedAt || '').slice(0, 10)} · ${s.url}\n   ${(s.summary || '').slice(0, 220)}`
  ).join('\n\n');

  const shapes = Object.entries(SHAPES)
    .map(([k, v]) => `  ${k} — ${v.when}`).join('\n');

  const prompt = `Here are this week's AI stories from our own sources.

${list}

Pick at most ${want} that deserve a written piece in a membership library for solo
business owners and creators. Fewer is correct if fewer are worth it.

Pick a story only if somebody could do something differently because of it. A
funding round, an executive hire, a corporate case study or an enterprise
partnership is news and not a piece. A launch they can use, a price change, a
technique going round, or a claim worth checking is a piece.

Give each one a shape:
${shapes}

Vary the shapes. Four manuals in a week reads as a template; the library these
join runs a mix, and the shape should follow what the story actually is rather
than what is convenient.

${recentTitles.length ? `We have recently published, so do not repeat these:\n${recentTitles.map((t) => `- ${t}`).join('\n')}\n` : ''}
For each pick, list in "related" every other url above that covers the same
announcement — another outlet's write-up, the company's own post, a hands-on.
The piece is written from all of them together, so this is what decides whether
it can compare what two sources say or has to hedge. Copy the urls exactly.

Also list what you passed over and why.`;

  const out = await callTool(prompt, PICK_TOOL, { maxTokens: 8000, meter });
  const picks = (out.data?.picks || []).filter((p) => p.url && p.title && SHAPES[p.shape]);
  return { picks: picks.slice(0, want), passed: out.data?.passed || [] };
}

/* ---------------- pass two: write one ---------------- */

const WRITE_TOOL = {
  name: 'piece',
  description: 'One finished library piece.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'six words or fewer, says the benefit or the subject plainly' },
      description: { type: 'string', description: 'one or two sentences for the card, under 220 characters' },
      // These three become library.meta as readTime / level / heroText, which
      // is what the existing 64 tutorials carry and what the item page reads.
      readMinutes: { type: 'integer' },
      difficulty: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
      heroText: { type: 'string', description: 'the standfirst under the title on the item page, two sentences' },
      category: { type: 'string', description: 'one of: Productivity, Business Strategy, Marketing, Creative & Design, Prompt Engineering' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      bodyHtml: { type: 'string', description: 'the piece, in the allowed markup only, with [[FIGURE n]] where each picture goes' },
      figures: {
        type: 'array',
        description: 'three to five pictures. Put [[FIGURE 1]] … on its own line in bodyHtml where each belongs.',
        items: {
          type: 'object',
          properties: {
            n: { type: 'integer' },
            kind: { type: 'string', enum: ['illustration', 'fromSource'],
              description: 'illustration = we draw it. fromSource = the publisher\'s own picture, credited to them. Use fromSource at most once, for showing the real thing.' },
            title: { type: 'string', description: 'illustration only: the heading inside the picture' },
            eyebrow: { type: 'string', description: 'illustration only: the small blue line above it, e.g. "MUSE · PLANS"' },
            subtitle: { type: 'string', description: 'illustration only: the grey line under the heading' },
            content: { type: 'string', description: 'illustration only: everything it must show, in detail — the panels, the labels, the numbers, the badges' },
            basedOn: { type: 'string', description: 'illustration only: the real thing it redraws, named for the footnote' },
            caption: { type: 'string', description: 'the figcaption. First sentence is the point; it is set in bold.' },
            alt: { type: 'string', description: 'what the picture shows, for somebody who cannot see it' }
          },
          required: ['n', 'kind', 'caption', 'alt']
        }
      },
      sources: {
        type: 'array',
        description: 'every url this piece leans on, all of which must be from the material given',
        items: { type: 'string' }
      }
    },
    required: ['title', 'description', 'readMinutes', 'difficulty', 'heroText', 'category', 'tags', 'bodyHtml', 'figures', 'sources']
  }
};

export async function writePiece({ pick, story, sources = [], vendorImage = null, meter = null }) {
  const shape = SHAPES[pick.shape];
  const [lo, hi] = shape.words;

  /* Everything published about this announcement, not one outlet's blurb.
     A tutorial written from a 200-word RSS summary has nothing to build a
     comparison table out of and spends its length saying what it cannot tell
     you. The real pieces in this library cite the announcement, the company's
     own documentation, the hands-on reviews and four or five outlets'
     coverage, which is why they can be 6,000 words and still dense. */
  const readings = (sources || []).map((s, i) => `--- SOURCE ${i + 1}: ${s.sourceName}`
    + `${s.publishedAt ? `, ${String(s.publishedAt).slice(0, 10)}` : ''} ---\n`
    + `${s.title}\n${s.url}\n\n${s.text || s.summary || '(no text could be read from this one)'}`).join('\n\n');

  const prompt = `Write one piece for a membership library.

WHAT IT IS ABOUT
${story.title}
${story.sourceName} · ${String(story.publishedAt || '').slice(0, 10)}

THE MATERIAL — ${(sources || []).length} source${(sources || []).length === 1 ? '' : 's'} on this story.
Use all of it. Where two disagree, say who says what.

${readings}

THE PIECE
Working title: ${pick.title}
Angle: ${pick.angle}
Why it matters: ${pick.why}
Shape: ${pick.shape}

Run it through these beats, in this order, one <h2> section each. The beats say
what the section does; you write the heading, and the heading is most of the
voice:
${shape.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}

LENGTH ${lo}–${hi} words. These run a median of 5,170 with a quarter of them
over 6,000 words, so this is a real piece of work rather than a sketch. Go
deep: worked examples, the exact words to type, tables that compare things,
and the objection a reader will raise answered before they raise it.

${VOICE}

${MARKUP}

PICTURES. Every tutorial in this library has them, a median of five, and one
without any is the odd one on the shelf. Ask for four or five and put
[[FIGURE 1]], [[FIGURE 2]] … on their own lines where they belong - after the
paragraph that sets each one up, not clustered at the top.

Most are "illustration": we draw them, as a light card explaining something -
two settings side by side, three plans compared, the steps of a loop. Describe
exactly what it must show, down to the labels, the numbers and which option is
recommended, because somebody draws only what you describe. Name what it is
based on so the picture can say so in its own footnote.

${vendorImage
  ? `The publisher has a picture of their own and we may point at it, so make
FIGURE 1 "fromSource": the real thing, at the top, credited to them. Its
caption says what the reader is looking at. The rest are illustrations.`
  : `The publisher offers no picture we may use, so every figure is an
illustration we draw.`}

Captions open with the point, in a sentence that stands alone, because that
first sentence is set in bold.

HOW IT ENDS. The last section looks forward - "Your next step", "What to do
this week", "Your Next Move" - and tells them the one thing to do first, often
as a short day-by-day table. The sources list and the currency note come after
its paragraphs, inside that same section.

HONESTY. Write only what the material above supports. A figure a company
publishes about its own product is that company's claim and says so in the
sentence: "Meta reports", "OpenAI says". Where an outlet's write-up and the
company's own post disagree, name both.
If you do not know a price, a date or a number, write what is known instead of
inventing one - "pricing has not been announced" is right and a guess is
worthless. Do not invent quotes, benchmarks, user numbers, or testing nobody
did. Where a beat asks for something you have not been given, say what would
settle it and that it is not settled yet - in the sentence, as part of the
argument. Do not open the piece with a warning box about your own limitations;
that is not a thing this library does, and it tells the reader about us when
they came to read about the subject.`;

  /* Room for the whole thing. A 5,800-word piece is about 8,000 tokens of
     prose and nearly as much again in section wrappers, labels, callouts and
     tables, so a 16,000 budget ran out mid-piece - and callTool treats a
     truncated answer as a failure, which it should, so the run reported one
     piece picked and none written with no reason given. */
  const out = await callTool(prompt, WRITE_TOOL, { maxTokens: 32000, meter });
  return out.data || null;
}

/* ---------------- the gate ---------------- */

const words = (html) => String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

/* The classes the member area styles, read off the .guide rules rather than
   remembered. Anything else arrives as an unstyled div. */
const ALLOWED = new Set(['section-label', 'divider', 'callout', 'callout-icon', 'callout-accent',
  'callout-green', 'callout-yellow', 'feature-grid', 'feature-card', 'feature-title', 'feature-desc',
  'price', 'instruction-block', 'ib-label', 'steps-list', 'step', 'step-num', 'step-body', 'step-act',
  'table-wrap', 'tutorial-img', 'card', 'tool',
  // The opening paragraph, which 20 of the 42 tutorials carry, and the class
  // their images wear.
  'lede', 'lead', 'figimg', 'sources', 'small-note']);

/**
 * What would stop this going in front of a member.
 *
 * Returns the reasons, so the admin reads why rather than "rejected". A piece
 * that fails is kept as a draft either way - a near miss is worth editing and
 * a thrown-away one cannot be.
 */
export function checkPiece(piece, { allowedUrls = [] } = {}) {
  const bad = [];
  if (!piece) return ['the model returned nothing'];
  const html = String(piece.bodyHtml || '');
  const n = words(html);

  /* Measured across all 89 tutorials - the 42 already here and the 47 the
     library is modelled on. Those 47 run a median of 5,170 with a quarter of
     them over 6,011, so the earlier target of 3,400 to 4,900 was aiming at the
     bottom of the range rather than the middle of it. */
  if (n < 3000) bad.push(`only ${n} words; these run a median of 5,170`);
  if (n > 8600) bad.push(`${n} words; longer than anything in either library`);

  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2 < 7) bad.push(`only ${h2} sections; the library runs 6 to 23, median 10`);

  /* The things that make it look like one of ours. All 42 wrap their sections
     and label them in this exact form; 41 of 42 use <section>. */
  const labels = [...html.matchAll(/class="section-label"[^>]*>\s*([^<]*)</g)].map((m) => m[1].trim());
  if (labels.length < 6) bad.push(`${labels.length} section labels; every tutorial numbers its sections`);
  const wrong = labels.filter((l) => !/^Section \d\d$/.test(l));
  if (wrong.length) bad.push(`section labels not in the house form: ${wrong.slice(0, 3).join(', ')}`);
  if (!/<section[\s>]/i.test(html)) bad.push('sections are not wrapped in <section>');

  // Sixty per cent open with a lede before the first section; none of them
  // open with a box explaining what the writer could not find out.
  if (/^\s*<section/i.test(html.trim())) {
    bad.push('starts straight at Section 01 with no lede');
  }
  const firstSection = html.search(/<section[\s>]/i);
  const opening = firstSection > 0 ? html.slice(0, firstSection) : '';
  if (/class="callout/.test(opening)) {
    bad.push('opens with a callout; the library opens with a lede paragraph');
  }

  /* No links, and a plain-text source list at the end.
     An earlier version of this check demanded the opposite - that the piece
     link to the thing it was about - and it was wrong on the evidence: across
     the 42 tutorials there are 24 links in total, all of them pointing at a
     tool somebody is meant to go and use, and the newest pieces cite their
     sources as named publications with no link at all. A tutorial that sends
     the reader to Product Hunt mid-sentence is not what this library does. */
  const links = (html.match(/<a\s[^>]*href="https?:/gi) || []).length;
  if (links) bad.push(`${links} link${links === 1 ? '' : 's'} in the body; this library cites by name instead`);
  /* A closing source list is allowed but not required, and it took measuring
     all 47 to know that: exactly one of them has one. It was briefly a hard
     requirement here on the evidence of a single tutorial somebody pointed at,
     which is the same mistake as building the whole spec from four samples. */
  // The section that makes it trustworthy rather than promotional.
  if (!/(downside|won't do|will not do|where it (?:lies|falls)|who should wait|limits?|cannot|before you go all in)/i.test(html)) {
    bad.push('nothing about what the thing cannot do');
  }

  if (/<(script|style|html|body|head)[\s>]/i.test(html)) bad.push('carries its own document shell or scripts');

  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c && !ALLOWED.has(c)) { bad.push(`unknown class "${c}" would render unstyled`); break; }
    }
  }

  // Every link has to be somewhere we actually sent it.
  if (allowedUrls.length) {
    const ok = new Set(allowedUrls);
    for (const m of html.matchAll(/href="(https?:[^"]+)"/g)) {
      if (!ok.has(m[1])) { bad.push(`links somewhere it was not given: ${m[1].slice(0, 70)}`); break; }
    }
  }

  if (!String(piece.title || '').trim()) bad.push('no title');
  if (String(piece.description || '').length > 260) bad.push('card description too long');

  return bad;
}

/* ---------------- reading around a story ---------------- */

/**
 * Everything published about one announcement, read in full.
 *
 * The collector already works out that four outlets covered the same launch -
 * collapsing them into one item is most of what it does - and the news feed
 * now keeps that list. This reads the announcement and the coverage, so the
 * writer has the company's own words, somebody's hands-on, and the detail an
 * RSS blurb leaves out.
 *
 * A page that will not talk to us is simply missing from the list. OpenAI
 * answer 403 to this fetcher and we do not pretend to be a browser, so their
 * own announcements come through as whatever their feed carried - which is
 * exactly why reading the outlets who did write it up matters.
 */
export async function gatherSources(story, { related = [], byUrl = new Map(), max = 5, chars = 7000 } = {}) {
  const seen = new Set([story.url]);
  const want = [{ url: story.url, sourceName: story.sourceName, title: story.title,
    summary: story.summary, publishedAt: story.publishedAt }];

  // What the collector merged, and what the picker recognised. The second is
  // doing most of the work; the first is free and occasionally catches one the
  // picker missed.
  const more = [...(story.also || []).map((a) => a?.url).filter(Boolean), ...related];
  for (const url of more) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const known = byUrl.get(url);
    want.push({ url, sourceName: known?.sourceName || 'coverage',
      title: known?.title || '', summary: known?.summary || '',
      publishedAt: known?.publishedAt });
  }

  const read = await Promise.all(want.slice(0, max).map(async (s) => {
    const text = await articleText(s.url, chars).catch(() => '');
    return { ...s, text: text || '' };
  }));

  // One that gave us nothing and has no summary either is not a source.
  return read.filter((s, i) => i === 0 || s.text || s.summary);
}

/* ---------------- the week ---------------- */

/**
 * Choose, write, check. Stores nothing — the caller decides what to do with
 * what comes back, which is what lets the admin dry-run a week.
 */
export async function writeTheWeek({ stories, recentTitles = [], want = 4 } = {}) {
  const meter = newMeter();
  const started = Date.now();

  const { picks, passed } = await choosePieces({ stories, recentTitles, want, meter });
  const byUrl = new Map(stories.map((s) => [s.url, s]));

  const pieces = [];
  for (const pick of picks) {
    const story = byUrl.get(pick.url);
    if (!story) continue;
    try {
      /* Asked before writing rather than hoped for afterwards. An early run
         produced a piece with three drawn figures and no photograph of the
         actual thing, because the writer was told it *could* use the
         publisher's picture and simply did not. Now it is told whether one
         exists, and the answer changes the instruction.
         The picture is looked for across the whole cluster, so an announcement
         whose own page refuses us - OpenAI answer 403 - can still show the
         real thing from an outlet that covered it. */
      const [vendorImage, sources] = await Promise.all([
        imageFor(story).catch(() => null),
        gatherSources(story, { related: pick.related || [], byUrl })
      ]);
      const piece = await writePiece({ pick, story, sources, vendorImage, meter });
      const fail = checkPiece(piece, { allowedUrls: [story.url] });
      pieces.push({ pick, story, piece, fail, sources: sources.map((s) => s.sourceName) });
    } catch (err) {
      pieces.push({ pick, story, piece: null, fail: [String(err.message || err).slice(0, 160)] });
    }
  }

  return {
    pieces, passed,
    stats: { model: MODEL, considered: stories.length, picked: picks.length,
      written: pieces.filter((p) => p.piece).length,
      clean: pieces.filter((p) => p.piece && !p.fail.length).length,
      cost: meter.total, ms: Date.now() - started }
  };
}

