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
import { listLibrary, listCourses, listContent, getCourse } from './db.js';
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

  const open = courses.filter((c) => !c.locked);

  // Lessons as well as courses, because "watch section 3 of this course" is a
  // step somebody can do this afternoon and "watch this course" is a weekend
  // they will not spend. Thirteen courses is thirteen extra queries on a
  // button somebody presses a few times a week, which is a fair price for the
  // difference between a reading list and a plan.
  const trees = await Promise.all(open.map((c) => getCourse(c.slug, entitled).catch(() => null)));
  const lessons = [];
  trees.forEach((row, n) => {
    const course = open[n];
    for (const sec of ((row && row.data && row.data.sections) || [])) {
      for (const l of (sec.lessons || [])) {
        if (!l.libId) continue;
        lessons.push({
          id: l.libId, course: course.slug, courseTitle: course.title,
          section: sec.name || sec.label || undefined,
          title: l.title, duration: l.duration || undefined
        });
      }
    }
  });

  return {
    terms,
    courses: open.map((c) => ({ slug: c.slug, title: c.title, lessons: c.lesson_count ?? 0 })),
    lessons,
    items: picks,
    downloads: downloads.filter((d) => !d.locked).map((d) => ({
      key: d.key, title: d.title, kind: d.kind
    }))
  };
}

/* ---------------- the prompt ---------------- */

/**
 * The shape, as a tool the model calls rather than as JSON it types.
 *
 * Asking for "only valid JSON" works until it does not: one unescaped quote
 * inside seventeen thousand characters and the whole roadmap is lost to a
 * parse error. A tool call is produced as structured data, so the failure mode
 * stops being a syntax error in prose.
 *
 * The descriptions here are also where the content guidance lives, because
 * they sit next to the field they govern rather than in a wall of rules the
 * model has to map back onto a shape.
 */
const str = (description) => ({ type: 'string', description });
const strs = (description) => ({ type: 'array', items: { type: 'string' }, description });

const RESOURCES = {
  type: 'array',
  description: 'Things from the catalogue that help with THIS step. Exact ids only. '
    + 'None is better than a bad one.',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['course', 'lesson', 'item', 'download'] },
      id: str('The exact id, slug or key from the catalogue.'),
      note: str('What it does for them at this step. One short line, no selling.')
    },
    required: ['type', 'id']
  }
};

const SCHEMA = {
  type: 'object',
  properties: {
    headline: str('The rule this plan runs on, at most twelve words. A principle, not a promise. '
      + 'Good: "Ad spend grows only after each gate is passed." '
      + 'Bad: "Turn inconsistent sales into a repeatable, profitable funnel."'),
    target: str('The target in one line, with its realistic floor where the stretch is unlikely. '
      + 'e.g. "10k a month by day 90 - realistic floor 4-6k". Leave out if they gave no number.'),
    readback: str('2-3 sentences proving you read their answers: their business, their goal, '
      + 'their constraint. Plain statement of fact, no flattery.'),
    theBet: str('One paragraph: the single highest-leverage thing for THIS person, and why it '
      + 'beats the obvious alternative.'),
    situation: {
      type: 'object',
      description: 'Where they are and what to fix first. The place to be blunt about arithmetic: '
        + 'if their goal needs numbers their budget cannot produce, say so and give the floor.',
      properties: {
        heading: str('Default "Where you are and what to fix first".'),
        paragraphs: strs('Three or four short paragraphs.')
      }
    },
    startHere: {
      type: 'object',
      description: 'The setup done once that makes every later step faster. Name exact lessons '
        + 'and their real runtimes, so it reads as an afternoon rather than a course.',
      properties: {
        blurb: str('One line.'),
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: str('Short and imperative.'),
              detail: str('One or two sentences naming the exact section and roughly how long.'),
              resources: RESOURCES
            },
            required: ['title']
          }
        }
      }
    },
    schedule: {
      type: 'array',
      description: 'The phases as rows somebody works through: one per week, plus a Day 1 row if '
        + 'setup needs it. A summary of the plan below, never new work.',
      items: {
        type: 'object',
        properties: {
          label: str('"Day 1", "Week 1", "Weeks 5-6".'),
          do: strs('Short lines, named the same way as the steps below.'),
          moveOn: str('The condition to meet before the next row.')
        },
        required: ['label', 'do']
      }
    },
    ladder: {
      type: 'object',
      description: 'OPTIONAL. A diagram, for when something in this business stacks in steps - an '
        + 'offer ladder, a pricing ladder, stages of a pipeline. Three to five steps, ascending. '
        + 'Leave it out entirely if nothing here genuinely stacks.',
      properties: {
        title: str('What the diagram shows, e.g. "Each step up raises what one buyer is worth".'),
        caption: str('One line under the title.'),
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: str('e.g. "Order bump".'),
              value: str('e.g. "9-19" or "47/month".'),
              share: str('e.g. "20-40% of buyers".'),
              job: str('What this step does, four to eight words.')
            },
            required: ['name']
          }
        }
      }
    },
    phases: {
      type: 'array',
      description: 'Three phases: the next 7 days, days 8-30, days 31-90. 3-6 steps each.',
      items: {
        type: 'object',
        properties: {
          window: str('"Next 7 days", "Days 8-30", "Days 31-90".'),
          goal: str('The state at the end, in three to seven words. "Fix the leak". '
            + '"Prove the funnel". Not a sentence, not a claim.'),
          exit: str('The gate: what must be true before spending more time or money on the next '
            + 'phase. Measurable, not "feel ready".'),
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: str('Imperative and specific.'),
                why: str('One or two sentences: what this buys them.'),
                how: strs('The concrete actions.'),
                time: str('e.g. "2 hours".'),
                resources: RESOURCES
              },
              required: ['title']
            }
          }
        },
        required: ['window', 'steps']
      }
    },
    order: strs('Why this sequence and not another. One or two short paragraphs.'),
    watchOuts: strs('Specific traps for this person, given what they told you. Plain imperatives.'),
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: str('What to measure.'),
          target: str('By when.'),
          benchmark: str('What healthy looks like.'),
          ifLow: str('What to do when it is below.')
        },
        required: ['name']
      }
    },
    rhythm: {
      type: 'array',
      description: 'Where the weekly hours go, inside the hours they said they have.',
      items: {
        type: 'object',
        properties: { block: str('What the hours go on.'), hours: str('e.g. "4-6".') },
        required: ['block']
      }
    }
  },
  required: ['headline', 'readback', 'phases']
};

export function buildPrompt(answers, catalogue, name) {
  // Lessons under their course rather than in a list of their own, so a model
  // choosing one can see which course it belongs to and what sits either side
  // of it.
  const byCourse = {};
  for (const l of (catalogue.lessons || [])) (byCourse[l.course] ||= []).push(l);

  const cat = [
    '### Courses (use "course" with the slug) and their lessons (use "lesson" with the lesson id)',
    ...catalogue.courses.flatMap((c) => [
      `- ${c.slug} — ${c.title} (${c.lessons} lessons)`,
      ...(byCourse[c.slug] || []).map((l) =>
        `    ${l.id} · ${l.title}${l.duration ? ` (${l.duration})` : ''}${l.section ? ` — ${l.section}` : ''}`)
    ]),
    '',
    '### Library items (use "item" with the id)',
    ...catalogue.items.map((i) =>
      `- ${i.id} — [${i.kindLabel}] ${i.title}${i.description ? ` — ${i.description}` : ''}`),
    '',
    '### Downloads (use "download" with the key)',
    ...catalogue.downloads.map((d) => `- ${d.key} — ${d.title}`)
  ].join('\n');

  return `You are writing a Personalised AI Roadmap for a member of AI Founder University.

This is a plan, not a pitch. They have already bought; nothing here has to sell them anything.
Write the way an operator writes a plan for one person: instructions, conditions, numbers.

# The member
${name ? `Name: ${name}\n` : ''}${answersAsText(answers)}

# What they already have access to
Everything below is in their membership right now. Recommend ONLY from this list.

${cat}

# Voice
The single most common failure here is writing a landing page with their answers pasted in.
A plan names things flatly and tells somebody what to do. A pitch names benefits and promises
outcomes. Everything below is the difference.

- Name things flatly. "Fix the leak", not "Unlock predictable, scalable growth".
- Headline: the rule the plan runs on, at most twelve words.
    Write: "Ad spend grows only after each gate is passed."
    Not:   "Turn inconsistent Meta sales into a repeatable, profitable funnel."
- A phase goal is a state in three to seven words, not a sentence claiming a result.
    Write: "Fix the leak" / "Prove the funnel" / "Scale profitably".
    Not:   "You can see exactly where your funnel loses people and tracking is trustworthy."
- Instructions beat benefits. "Export your last 60 days of ad data" beats "Gain clarity on
  your performance".
- Never these words: unlock, transform, supercharge, game-changer, seamless, effortless,
  skyrocket, "predictable revenue machine", "10x". No exclamation marks.
- No adjective stacks. "repeatable, profitable, scalable" is three words doing one word's work.
- Short sentences. If a sentence would work in an advert, cut it.
- Say the number or say nothing. "Cost per purchase at or below average order value by day 30"
  is useful; "dramatically improve your returns" is not.

# How to write it
- Be specific to THIS person. If your advice would suit anybody in their industry, it is not finished.
- Respect their constraints. They told you their hours, budget, team and what they will not do.
  A plan that ignores those is worthless, however good it would otherwise be.
- Earn each step. Say what it buys them, not that it is "important".
- Sequence deliberately. Each window should make the next one easier.
- 7 days: one visible result. Not setup, a result.
- 8-30 days: the system that repeats it.
- 31-90 days: what compounds.
- 3-6 steps per window. More is a to-do list, not a roadmap.
- Every phase gets an "exit": the condition to meet before moving on. These are what stop
  somebody scaling a thing that does not work yet, so make them measurable, not "feel ready".
- "startHere" is the setup done once that makes every later step faster — point at the exact
  lessons, with their real runtimes, so it reads as an afternoon rather than a course.
- "schedule" turns the phases into rows somebody works through: one row per week (plus a Day 1
  row if setup needs it), the same actions named the same way as in the phases below. It is a
  summary of the plan, never new work that appears nowhere else.
- "situation" is where you are allowed to be blunt about arithmetic. If their goal needs numbers
  their budget cannot produce, say so plainly, give the realistic floor as well as the target,
  and show what would have to be true for the stretch case. Do not quietly agree with a goal
  that does not add up, and do not talk them out of it either.
- Attach resources from the catalogue to the steps where they genuinely help, using the exact
  ids above, and give each one a "note": what it does for them at that step, in one line. Prefer
  a specific lesson over a whole course when the step needs one idea rather than the subject.
  Do not invent ids, titles, courses or lessons. A step with no good match gets no resources —
  that is fine and better than a bad one.
- Never promise revenue. Say what to do and what to measure.
- "ladder" is a diagram, and only earns its place if something in this business genuinely stacks
  in steps. If nothing does, leave it out. A diagram of nothing is worse than no diagram.
- Leave out any optional block you cannot fill honestly for this person. An empty section is
  better than a padded one.

# Output
Call the roadmap tool with the finished plan. Do not write anything else.`;
}

/* ---------------- the call ---------------- */

/**
 * One exchange with the model.
 *
 * Returns the tool call where there is one, and whatever prose came back
 * either way, so the caller can decide what to do about an answer that was
 * written out instead of delivered.
 */
async function ask(messages) {
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
      // Room for the whole document. A truncated answer is not a short roadmap,
      // it is no roadmap, so this is deliberately generous.
      max_tokens: 16000,
      tools: [{
        name: 'roadmap',
        description: 'Deliver the finished roadmap. Always answer by calling this.',
        input_schema: SCHEMA
      }],
      // No tool_choice: some models refuse "tool" and "any" outright ("not
      // supported for this model"), and a 400 here loses the roadmap just as
      // surely as a syntax error did. The prompt asks for the tool, the tool
      // is the only one offered, and parseJson still catches the case where a
      // model writes the JSON out instead.
      messages
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  const call = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'roadmap');

  // Running out of room mid-answer leaves a half-built object, and the error
  // that follows reads like a bug rather than a budget.
  if (data.stop_reason === 'max_tokens') {
    throw new Error('the model ran out of room before finishing the roadmap');
  }

  return { data: call ? call.input : null, text, model: data.model || MODEL };
}

/**
 * The roadmap, delivered as data.
 *
 * The tool cannot be forced on every model, so a model that writes the plan
 * out as text instead is asked once more to hand the same plan over through
 * the tool. That second ask costs a few pence and saves the roadmap, which is
 * the trade this whole path exists to make. If it still comes back as prose,
 * the caller parses the text and takes its chances.
 */
export async function callClaude(prompt) {
  const first = await ask([{ role: 'user', content: prompt }]);
  if (first.data || !first.text) return first;

  const again = await ask([
    { role: 'user', content: prompt },
    { role: 'assistant', content: first.text },
    { role: 'user', content: 'Deliver that same plan by calling the roadmap tool. Change nothing about it.' }
  ]);
  // The retry's prose is worth less than the original's: the first answer is
  // the whole plan, the second is usually an apology.
  return again.data ? again : first;
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
  const lessons = new Map((catalogue.lessons || []).map((l) => [l.id, l]));
  const dropped = [];

  const str = (v, n = 1200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const list = (v) => (Array.isArray(v) ? v : []);

  const resources = (rs) => list(rs).map((r) => {
    const id = str(r && r.id, 200);
    const type = str(r && r.type, 20);
    const note = str(r && r.note, 240) || undefined;
    if (type === 'course' && courses.has(id)) {
      return { type, id, title: courses.get(id).title, note };
    }
    if (type === 'lesson' && lessons.has(id)) {
      const l = lessons.get(id);
      // The course slug travels with the lesson so the member area can open
      // the player at it. Without it a lesson link has nowhere to go.
      return { type, id, course: l.course, title: l.title, duration: l.duration, note };
    }
    if (type === 'item' && items.has(id)) {
      const it = items.get(id);
      return { type, id, title: it.title, kind: it.kind, kindLabel: it.kindLabel, note };
    }
    if (type === 'download' && downloads.has(id)) {
      return { type, id, title: downloads.get(id).title, note };
    }
    if (id) dropped.push(`${type || '?'}:${id}`);
    return null;
  }).filter(Boolean);

  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const situation = obj(parsed.situation);
  const startHere = obj(parsed.startHere);
  const ladder = obj(parsed.ladder);

  return {
    roadmap: {
      headline: str(parsed.headline, 240),
      target: str(parsed.target, 240),
      readback: str(parsed.readback),
      theBet: str(parsed.theBet, 2000),
      situation: {
        heading: str(situation.heading, 120),
        paragraphs: list(situation.paragraphs).map((p) => str(p, 1400)).filter(Boolean).slice(0, 6)
      },
      startHere: {
        heading: str(startHere.heading, 120),
        blurb: str(startHere.blurb, 400),
        steps: list(startHere.steps).slice(0, 8).map((s) => ({
          title: str(s && s.title, 200),
          detail: str(s && s.detail, 700),
          resources: resources(s && s.resources)
        })).filter((s) => s.title)
      },
      // Optional, and often absent: most businesses have nothing that stacks.
      // The document draws it only when there are at least three steps.
      ladder: {
        title: str(ladder.title, 160),
        caption: str(ladder.caption, 240),
        steps: list(ladder.steps).slice(0, 6).map((s) => ({
          name: str(s && s.name, 60),
          value: str(s && s.value, 40),
          share: str(s && s.share, 60),
          job: str(s && s.job, 120)
        })).filter((s) => s.name)
      },
      schedule: list(parsed.schedule).slice(0, 16).map((r) => ({
        label: str(r && r.label, 40),
        do: list(r && r.do).map((d) => str(d, 300)).filter(Boolean).slice(0, 8),
        moveOn: str(r && r.moveOn, 300)
      })).filter((r) => r.label && r.do.length),
      phases: list(parsed.phases).slice(0, 4).map((p) => ({
        window: str(p.window, 60),
        goal: str(p.goal, 400),
        exit: str(p.exit, 400),
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
        name: str(m && m.name, 160),
        target: str(m && m.target, 160),
        benchmark: str(m && m.benchmark, 160),
        ifLow: str(m && m.ifLow, 240)
      })).filter((m) => m.name).slice(0, 8),
      rhythm: list(parsed.rhythm).map((r) => ({
        block: str(r && r.block, 160), hours: str(r && r.hours, 40)
      })).filter((r) => r.block).slice(0, 8)
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
