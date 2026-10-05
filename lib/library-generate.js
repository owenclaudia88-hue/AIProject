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

/* The shapes, as the four pieces sampled from a competitor's library actually
   run. Each is a sequence of beats rather than headings to copy: the writer is
   asked for its own headings, because the headings are most of the voice. */
export const SHAPES = {
  manual: {
    when: 'a product, model or feature has just launched and a reader could start using it this week',
    words: [4000, 5500],
    beats: [
      'open on what it is in one scene a reader recognises, not a definition',
      'what was announced, in sixty seconds',
      'how the thing actually works, in the plain words someone would use out loud',
      'what a week of using it looks like, with concrete jobs',
      'setting it up, step by step',
      'two or three first jobs to give it, each one specific',
      'the guardrails: what it cannot do without asking, how to stop it',
      'what it costs, and the cheapest honest way in',
      'the honest downsides, and who should wait',
      'what to do on Monday'
    ]
  },
  investigation: {
    when: 'a claim, trick or technique is going round and nobody has checked whether it holds',
    words: [3800, 5000],
    beats: [
      'the claim, and why it is everywhere this week',
      'what would have to be true for it to work',
      'one section per claim, each ending in a verdict',
      'which of them are worth your afternoon',
      'the boring thing that beats all of them',
      'what to remember when the next one goes round'
    ]
  },
  explainer: {
    when: 'a model or tool is being argued about and the reader cannot tell hype from substance',
    words: [3800, 5200],
    beats: [
      'open in the middle of a moment the reader has had',
      'what the thing actually is, stripped of the launch language',
      'why the internet reacted the way it did',
      'what it costs in money and in time',
      'where it falls over',
      'what the numbers really say, and whose numbers they are',
      'a first week with it',
      'where these numbers came from'
    ]
  },
  concept: {
    when: 'the story is really about a method or a way of working rather than one product',
    words: [3500, 4800],
    beats: [
      'the problem the reader already has and has not named',
      'the idea, in one sentence they could repeat',
      'the pieces it breaks into, one section each',
      'what a worked example looks like end to end',
      'setting it up',
      'a first week',
      'what we would tell you before you start',
      'the part that outlives the tool'
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
const MARKUP = `Use only these elements and classes, which the member area styles:
  <h2>, <h3>, <h4>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <a href>
  <div class="section-label">SECTION 01</div>    eyebrow above each h2
  <hr class="divider">                            between sections
  <div class="callout"><span class="callout-icon">💡</span><div><p>…</p></div></div>
      and callout-accent (orange), callout-green (good), callout-yellow (careful)
  <div class="feature-grid">
    <div class="feature-card"><div class="feature-title">…</div><div class="feature-desc">…</div></div>
  </div>
  <div class="instruction-block"><div class="ib-label">WHAT TO TYPE</div><p>…</p></div>
  <ol class="steps-list"><li class="step"><span class="step-num">1</span>
      <div class="step-body">…</div></li></ol>
  <div class="table-wrap"><table><thead><tr><th>…</th></tr></thead><tbody>…</tbody></table></div>
  <span class="price">$20/mo</span>
No <style>, no <script>, no <html>/<head>/<body>, no images, no class outside this list.`;

const VOICE = `Write for somebody running a business on their own who has twenty minutes.
British English. Second person. Short sentences carrying one idea each.
Headings are plain English and say something - "Where it lies to you", "What it
actually costs to run" - never "Introduction", "Overview", "Conclusion" or a
bare noun. No marketing language, no "unlock", "leverage", "game-changing",
"in today's fast-paced world", no em-dash-heavy rhetorical flourishes, no
sentence that begins "But here's the thing".`;

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
            why: { type: 'string', description: 'one sentence: why a solo business owner should care this week' }
          },
          required: ['url', 'title', 'kind', 'shape', 'angle', 'why']
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
      bodyHtml: { type: 'string', description: 'the piece, in the allowed markup only' },
      sources: {
        type: 'array',
        description: 'every url this piece leans on, all of which must be from the material given',
        items: { type: 'string' }
      }
    },
    required: ['title', 'description', 'readMinutes', 'difficulty', 'heroText', 'category', 'tags', 'bodyHtml', 'sources']
  }
};

export async function writePiece({ pick, story, meter = null }) {
  const shape = SHAPES[pick.shape];
  const [lo, hi] = shape.words;

  const prompt = `Write one piece for a membership library.

WHAT IT IS ABOUT
${story.title}
${story.sourceName} · ${String(story.publishedAt || '').slice(0, 10)}
${story.url}

What the source says:
${story.summary || '(the feed carried no summary; write only what the headline and the url support)'}

THE PIECE
Working title: ${pick.title}
Angle: ${pick.angle}
Why it matters: ${pick.why}
Shape: ${pick.shape}

Run it through these beats, in this order, one <h2> section each. The beats say
what the section does; you write the heading, and the heading is most of the
voice:
${shape.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}

LENGTH ${lo}–${hi} words. Long enough to be worth the read, short enough to be read.

${VOICE}

${MARKUP}

HONESTY. You have the source's own summary and nothing else, so write only what
it supports. A figure a company publishes about its own product is that
company's claim and must be attributed to them in the sentence. If you do not
know a price, a date or a number, say what is known instead of inventing one;
a piece that says "pricing was not announced" is right and one that guesses is
worthless. Do not invent quotes, benchmarks, user numbers or testing you have
not been given. Where a section asks for a test or an experiment and you have
not been given one, write about what would settle the question instead, and say
that it is not yet settled.

The last section is the sources, as a list of links to the material above.`;

  const out = await callTool(prompt, WRITE_TOOL, { maxTokens: 16000, meter });
  return out.data || null;
}

/* ---------------- the gate ---------------- */

const words = (html) => String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

/* The classes the member area styles, read off the .guide rules rather than
   remembered. Anything else arrives as an unstyled div. */
const ALLOWED = new Set(['section-label', 'divider', 'callout', 'callout-icon', 'callout-accent',
  'callout-green', 'callout-yellow', 'feature-grid', 'feature-card', 'feature-title', 'feature-desc',
  'price', 'instruction-block', 'ib-label', 'steps-list', 'step', 'step-num', 'step-body', 'step-act',
  'table-wrap', 'tutorial-img', 'card', 'tool']);

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

  /* Measured against the library it is joining, not against a guess. The
     shortest tutorial already in there is 4,391 words and the shortest skill
     3,188, so a 1,200-word piece would be visibly the thin one on the shelf -
     which is worse than not publishing it. */
  if (n < 2400) bad.push(`only ${n} words; the thinnest piece in the library is 3,188`);
  if (n > 8000) bad.push(`${n} words; longer than anything in the library`);

  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  if (h2 < 8) bad.push(`only ${h2} sections; the library runs 9 to 13`);

  /* The closing section has to cite something, tested by looking for the
     citation rather than for the heading above it.
     The first version matched the words "source", "where these numbers" or
     "where this came" in an h2, and held two perfectly good pieces whose
     closing sections were headed "Where this comes from" - present tense.
     Varied headings are the house style we are deliberately asking for, so a
     gate that reads them is a gate that fails on its own instructions. What
     actually matters is that the last section points at the material. */
  const lastH2 = html.toLowerCase().lastIndexOf('<h2');
  const closing = lastH2 >= 0 ? html.slice(lastH2) : '';
  if (!/<a\s[^>]*href="https?:/i.test(closing)) {
    bad.push('the closing section does not link to where any of this came from');
  }
  // The section that makes it trustworthy rather than promotional.
  if (!/(downside|won't do|will not do|where it (?:lies|falls)|who should wait|limits?|cannot)/i.test(html)) {
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
      const piece = await writePiece({ pick, story, meter });
      const fail = checkPiece(piece, { allowedUrls: [story.url] });
      pieces.push({ pick, story, piece, fail });
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
