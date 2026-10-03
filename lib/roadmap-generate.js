/**
 * Turning somebody's answers into a roadmap.
 *
 * Three parts, and the first and last matter more than the middle.
 *
 * Retrieval: the library holds about 1,500 items, which is too many to put in
 * front of a model and too many to be useful anyway. So the answers are turned
 * into a search, and only what matches goes in — every course, because there
 * are thirteen, plus the best-matching prompts, skills, routines and
 * templates. A few dozen real things beats fifteen hundred.
 *
 * Generation: one call, asking for structured output rather than prose, so the
 * admin can edit a section without editing an essay and the member area can
 * render links rather than printing URLs.
 *
 * Validation: every resource the model names is checked against what it was
 * given, and anything else is dropped. This is the part that stops a roadmap
 * confidently sending somebody to a course that does not exist - which is the
 * single worst thing this feature could do, because it is also the most
 * convincing.
 */
import { listLibrary, listCourses, listContent } from './db.js';
import { KINDS } from './mcp-tools.js';
import { answersAsText } from './roadmap.js';

const MODEL = process.env.ROADMAP_MODEL || 'claude-sonnet-5-5';
const MAX_PER_KIND = 14;

/* ---------------- retrieval ---------------- */

/** The words worth searching on, from the answers that describe the business. */
function termsFrom(answers) {
  const weighted = [
    answers['business.what'], answers['business.industry'],
    answers['customer.who'], answers['customer.problem'],
    answers['goal.priority'], answers['goal.ninety'],
    answers['blockers.stuck'], answers['customer.find']
  ].filter(Boolean).join(' ');

  // A short stop list leaves words like "good", "time" and "better" in, and
  // those match almost everything - which is how a coaching business ends up
  // being recommended a Reddit scraper. Anything that could appear in any
  // answer carries no signal and is worse than nothing.
  const stop = new Set((
    'the a an and or of to for with my our i we you your their his her its in on at by as '
    + 'is are was were be been being have has had do does did can could will would should may might '
    + 'how what why when where who which that this these those there here then than if but so '
    + 'want need get got make made take taken give given keep kept find found use used using '
    + 'more most less least much many lot lots very really quite just only also even still '
    + 'good better best bad worse great fine nice easy hard simple quick fast slow '
    + 'time times day days week weeks month months year years hour hours '
    + 'thing things stuff work works working run running start starting stop '
    + 'people person someone somebody anyone everybody one ones two three '
    + 'about into over under through from out off down up back again '
    + 'cannot dont doesnt wont isnt arent havent not no yes maybe '
    + 'small big large little new old next last first second other another same different '
    + 'help helping helps right left around after before while during because since '
    + 'own self myself really actually basically currently already always never sometimes'
  ).split(/\s+/));

  return [...new Set(
    weighted.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w))
  )].slice(0, 24);
}

/** How well one library row answers those terms. Titles count for most. */
function score(row, terms) {
  const title = String(row.title || '').toLowerCase();
  const rest = `${row.category || ''} ${row.course || ''} ${row.description || ''} ${(row.tags || []).join(' ')}`.toLowerCase();
  let n = 0;
  for (const t of terms) {
    if (title.includes(t)) n += 8;
    else if (rest.includes(t)) n += 3;
  }
  // A nudge from what other members actually use, never enough to beat a match.
  return n + Math.min(Number(row.likes) || 0, 30) / 100;
}

/**
 * What the model is allowed to recommend.
 *
 * Only things this member can actually open: the entitlements are the same
 * ones the member area gates on, so a roadmap never points at a lock.
 */
export async function buildCatalogue(answers, entitled) {
  const terms = termsFrom(answers);

  const [courses, library, downloads] = await Promise.all([
    listCourses(entitled), listLibrary(undefined, entitled), listContent(entitled)
  ]);

  const byKind = {};
  for (const row of library) {
    if (row.locked || row.kind === 'lesson') continue;
    (byKind[row.kind] ||= []).push(row);
  }

  const picks = [];
  for (const kind of Object.keys(byKind)) {
    const ranked = byKind[kind]
      .map((r) => ({ r, s: score(r, terms) }))
      .sort((a, b) => b.s - a.s);
    // Anything that matched, then the most-liked to make up the numbers, so a
    // vague set of answers still gets the library's best rather than its first.
    const matched = ranked.filter((x) => x.s >= 8).slice(0, MAX_PER_KIND);
    const filler = ranked.filter((x) => x.s < 8)
      .sort((a, b) => (Number(b.r.likes) || 0) - (Number(a.r.likes) || 0))
      .slice(0, Math.max(0, 6 - matched.length));
    for (const x of [...matched, ...filler]) {
      picks.push({
        id: x.r.id, kind: x.r.kind, kindLabel: KINDS[x.r.kind] || x.r.kind,
        title: x.r.title, category: x.r.category || undefined,
        description: (x.r.description || '').slice(0, 220) || undefined
      });
    }
  }

  return {
    terms,
    courses: courses.filter((c) => !c.locked).map((c) => ({
      slug: c.slug, title: c.title, lessons: c.lesson_count ?? 0
    })),
    items: picks,
    downloads: downloads.filter((d) => !d.locked).map((d) => ({
      key: d.key, title: d.title, kind: d.kind
    }))
  };
}

/* ---------------- the prompt ---------------- */

const SHAPE = `{
  "headline": "one line naming the outcome, in their words not ours",
  "readback": "2-3 sentences proving you read their answers - their business, their goal, their constraint",
  "theBet": "one paragraph: the single highest-leverage thing for THIS person, and why it beats the obvious alternative",
  "phases": [
    {
      "window": "Next 7 days" | "Days 8-30" | "Days 31-90",
      "goal": "what is true at the end of this window",
      "steps": [
        {
          "title": "imperative, specific",
          "why": "one or two sentences - what this buys them",
          "how": ["concrete action", "concrete action"],
          "time": "e.g. 2 hours",
          "resources": [{ "type": "course"|"item"|"download", "id": "exact id from the catalogue" }]
        }
      ]
    }
  ],
  "order": ["why this sequence and not another - 2-3 sentences"],
  "watchOuts": ["a specific trap for this person, given what they told you"],
  "metrics": [{ "name": "what to measure", "target": "by when" }]
}`;

export function buildPrompt(answers, catalogue, name) {
  const cat = [
    '### Courses (use "course" with the slug)',
    ...catalogue.courses.map((c) => `- ${c.slug} — ${c.title} (${c.lessons} lessons)`),
    '',
    '### Library items (use "item" with the id)',
    ...catalogue.items.map((i) =>
      `- ${i.id} — [${i.kindLabel}] ${i.title}${i.description ? ` — ${i.description}` : ''}`),
    '',
    '### Downloads (use "download" with the key)',
    ...catalogue.downloads.map((d) => `- ${d.key} — ${d.title}`)
  ].join('\n');

  return `You are writing a Personalised AI Roadmap for a member of AI Founder University.

This is a done-for-you deliverable they are paying for. It has to read like a consultant
who actually read their answers, not a template with their industry pasted in.

# The member
${name ? `Name: ${name}\n` : ''}${answersAsText(answers)}

# What they already have access to
Everything below is in their membership right now. Recommend ONLY from this list.

${cat}

# How to write it
- Be specific to THIS person. If your advice would suit anybody in their industry, it is not finished.
- Respect their constraints. They told you their hours, budget, team and what they will not do.
  A plan that ignores those is worthless, however good it would otherwise be.
- Earn each step. Say what it buys them, not that it is "important".
- Sequence deliberately. Each window should make the next one easier.
- 7 days: one visible result. Not setup, a result.
- 8-30 days: the system that repeats it.
- 31-90 days: what compounds.
- 3-5 steps per window. More is a to-do list, not a roadmap.
- Attach resources from the catalogue to the steps where they genuinely help, using the exact
  ids above. Do not invent ids, titles or courses. A step with no good match gets no resources —
  that is fine and better than a bad one.
- No hype, no "game-changer", no em-dash-laden filler. Plain, direct, specific.
- Never promise revenue. Say what to do and what to measure.

# Output
Return ONLY valid JSON in exactly this shape, no markdown fence, no commentary:

${SHAPE}`;
}

/* ---------------- the call ---------------- */

export async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err = new Error('ANTHROPIC_API_KEY is not set');
    err.code = 'no_key';
    throw err;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  return { text, model: data.model || MODEL };
}

/* ---------------- validation ---------------- */

/**
 * Keeps only what was actually offered.
 *
 * A model asked for ids will occasionally produce a plausible one that does
 * not exist, and a roadmap that sends somebody to a course they cannot find is
 * worse than one that recommends nothing — it reads as a broken promise rather
 * than a missing feature. Everything is checked against the catalogue it was
 * given, and anything else is dropped rather than guessed at.
 */
export function validate(parsed, catalogue) {
  const courses = new Map(catalogue.courses.map((c) => [c.slug, c]));
  const items = new Map(catalogue.items.map((i) => [i.id, i]));
  const downloads = new Map(catalogue.downloads.map((d) => [d.key, d]));
  const dropped = [];

  const str = (v, n = 1200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const list = (v) => (Array.isArray(v) ? v : []);

  const resources = (rs) => list(rs).map((r) => {
    const id = str(r && r.id, 200);
    const type = str(r && r.type, 20);
    if (type === 'course' && courses.has(id)) {
      return { type, id, title: courses.get(id).title };
    }
    if (type === 'item' && items.has(id)) {
      const it = items.get(id);
      return { type, id, title: it.title, kind: it.kind, kindLabel: it.kindLabel };
    }
    if (type === 'download' && downloads.has(id)) {
      return { type, id, title: downloads.get(id).title };
    }
    if (id) dropped.push(`${type || '?'}:${id}`);
    return null;
  }).filter(Boolean);

  return {
    roadmap: {
      headline: str(parsed.headline, 240),
      readback: str(parsed.readback),
      theBet: str(parsed.theBet, 2000),
      phases: list(parsed.phases).slice(0, 4).map((p) => ({
        window: str(p.window, 60),
        goal: str(p.goal, 400),
        steps: list(p.steps).slice(0, 8).map((st) => ({
          title: str(st.title, 200),
          why: str(st.why, 800),
          how: list(st.how).map((h) => str(h, 400)).filter(Boolean).slice(0, 8),
          time: str(st.time, 60),
          resources: resources(st.resources)
        })).filter((st) => st.title)
      })).filter((p) => p.window && p.steps.length),
      order: list(parsed.order).map((o) => str(o, 800)).filter(Boolean).slice(0, 4),
      watchOuts: list(parsed.watchOuts).map((w) => str(w, 500)).filter(Boolean).slice(0, 6),
      metrics: list(parsed.metrics).map((m) => ({
        name: str(m && m.name, 160), target: str(m && m.target, 160)
      })).filter((m) => m.name).slice(0, 6)
    },
    dropped
  };
}

/** Models occasionally fence their JSON however firmly they were asked not to. */
export function parseJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

export { MODEL };
