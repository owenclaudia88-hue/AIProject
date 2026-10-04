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

import { callTool, MODEL, parseJson } from './claude.js';

export { MODEL, parseJson };
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
    goal: str('The member\'s 90-day goal, restated exactly as they entered it, in their currency. '
      + 'Never a lower number than they asked for.'),
    opening: str('Two or three sentences: what this plan does, and the one idea that makes it work. '
      + 'No flattery, no motivation, no restating the questionnaire.'),

    revenue: {
      type: 'object',
      description: 'How the goal is reached, worked backwards into three months. Month 3 must equal '
        + 'or exceed the goal, and every number here must match the phase targets exactly.',
      properties: {
        intro: str('One sentence naming the revenue streams this plan uses.'),
        rows: {
          type: 'array',
          description: '2-4 revenue streams, one row each. Every cell is "volume · amount", '
            + 'e.g. "12 sales · $1,200". Use the member\'s own prices where they gave them.',
          items: {
            type: 'object',
            properties: {
              source: str('The stream, e.g. "Front-end offer at $47".'),
              m1: str('Month 1 as "volume · amount".'),
              m2: str('Month 2 as "volume · amount".'),
              m3: str('Month 3 as "volume · amount".')
            },
            required: ['source', 'm1', 'm2', 'm3']
          }
        },
        total: {
          type: 'object',
          description: 'The monthly totals. These must be the sum of the rows above, and month 3 '
            + 'must reach the goal.',
          properties: { m1: str('e.g. "$1,450"'), m2: str(''), m3: str('') },
          required: ['m1', 'm2', 'm3']
        },
        adSpend: {
          type: 'object',
          description: 'Ad spend per month, if the plan uses paid ads. Month 1 must fit inside the '
            + 'member\'s stated budget. Leave out entirely if there are no ads.',
          properties: { m1: str(''), m2: str(''), m3: str('') }
        },
        budgetRule: str('One rule for funding growth from the business, e.g. "Next month\'s ad budget '
          + 'is up to 40% of this month\'s collected revenue, and rises only while cost per customer '
          + 'stays at or below $35." If there are no ads, say where customers come from instead.'),
        assumptions: str('One sentence listing the assumptions every volume above was derived from: '
          + 'conversion rates, cost per lead or customer, take rates, show rates, churn.')
      },
      required: ['rows', 'total']
    },

    startHere: {
      type: 'object',
      description: 'Day 1. The setup done once that makes every later step faster.',
      properties: {
        minutes: str('Total time for the whole block, e.g. "about 90 minutes".'),
        steps: {
          type: 'array',
          description: '4-6 numbered setup steps.',
          items: {
            type: 'object',
            properties: {
              title: str('Short and imperative.'),
              detail: str('One or two sentences: exactly what to do.'),
              minutes: str('e.g. "15 min".'),
              resources: RESOURCES
            },
            required: ['title']
          }
        }
      }
    },

    phases: {
      type: 'array',
      description: 'Exactly three phases: Days 1-30, Days 31-60, Days 61-90. Phase 1 fixes the '
        + 'bottleneck and opens the fastest revenue before any scaling.',
      items: {
        type: 'object',
        properties: {
          window: str('"Days 1-30", "Days 31-60", "Days 61-90".'),
          name: str('Three or four words naming the job of this phase, e.g. "Fix and monetise".'),
          target: str('The month\'s revenue target, matching the revenue table exactly.'),
          weeks: {
            type: 'array',
            description: 'Weeks 1, 2, 3, 4 in phase 1; pairs of weeks after that; week 13 last.',
            items: {
              type: 'object',
              properties: {
                label: str('"Week 1", "Weeks 5-6", "Week 13".'),
                steps: {
                  type: 'array',
                  description: '3-5 steps. One action each, with real numbers. Anything a step needs '
                    + 'as an input must have been created by an earlier step.',
                  items: {
                    type: 'object',
                    properties: {
                      title: str('A bold action title.'),
                      detail: str('One or two sentences on exactly what to do, with specific numbers.'),
                      resources: RESOURCES
                    },
                    required: ['title']
                  }
                }
              },
              required: ['label', 'steps']
            }
          },
          checkpoint: {
            type: 'object',
            description: 'The end of the month: the revenue target plus one or two numbers that show '
              + 'the plan is on track, and what to do either way.',
            properties: {
              label: str('"Day 30", "Day 60", "Day 90".'),
              numbers: strs('One or two numbers to check, each with its target.'),
              hit: str('What to do if it is hit.'),
              missed: str('What to do if it is missed.')
            }
          }
        },
        required: ['window', 'name', 'weeks']
      }
    },

    fallBehind: strs('3-4 levers to pull if the plan is behind, quickest and cheapest first, '
      + 'specific to this business.'),

    scorecard: {
      type: 'array',
      description: '5-7 numbers that matter for THIS business model, checked weekly.',
      items: {
        type: 'object',
        properties: {
          number: str('What to measure.'),
          target: str('The target.'),
          ifBelow: str('What to do when it is below target.'),
          routine: {
            type: 'object',
            description: 'The AFU routine or tool that prepares this number, if there is one.',
            properties: {
              type: { type: 'string', enum: ['course', 'lesson', 'item', 'download'] },
              id: str('The exact id from the catalogue.')
            }
          }
        },
        required: ['number', 'target']
      }
    },

    workingWeek: {
      type: 'array',
      description: 'Where the weekly hours go. Must add up to within the hours the member said they '
        + 'have, including delivering the work the plan sells.',
      items: {
        type: 'object',
        properties: { block: str('What the hours go on.'), hours: str('e.g. "4-6"') },
        required: ['block', 'hours']
      }
    },

    notDoing: strs('3-5 things not to do, each tied to this member\'s situation, their "will not do" '
      + 'list, or something they already tried that did not work.')
  },
  required: ['goal', 'opening', 'revenue', 'phases']
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

  return `You are the AI Founder University Roadmap Strategist. You write a Personalised AI Roadmap
for one AFU member: a clear, professional 90-day plan that gets them to the goal they entered, with
step-by-step weekly instructions and the AFU resources to use at each step.

This is a plan, not a pitch. They have already bought; nothing here has to sell them anything.

# The member
${name ? `Name: ${name}\n` : ''}${answersAsText(answers)}

# What they already have access to
Everything below is in their membership right now. Recommend ONLY from this list, by exact id.

${cat}

# Core principles
1. Keep the member's goal exactly as entered. Never replace it with a lower target. Build the plan
   that reaches it, and state the assumptions it depends on.
2. Every number must add up. Revenue, volumes, prices, conversion rates, budget and hours must be
   consistent everywhere they appear.
3. Fit the plan to this business model, this stage, this budget, these hours and this "will not do"
   list. Never assume the member sells the same thing as anyone else.
4. Write for a busy owner: plain language, numbered steps, one action per step, no theory, no filler.
5. Use AFU resources first. Name them by their exact catalogue id and say what each does for the step.

# Step 1: Understand the business (do this silently)
- Business model. Pick the closest: digital products or courses; coaching or consulting; agency or
  service; e-commerce or physical products; local or brick-and-mortar service; SaaS or app; creator,
  affiliate or media; or a mix.
- Revenue levers that fit that model. For example - digital products: front-end offer, order bump,
  upsell, membership, higher-priced program. Coaching or consulting: entry offer, group program, 1:1
  or VIP tier, retainers. Agency or service: packages, retainers, upsells to existing clients,
  referrals. E-commerce: average order value, repeat purchase, bundles, subscriptions, email and SMS
  flows. Local service: bookings, rebooking, reviews, local search, memberships. SaaS: trial-to-paid,
  activation, annual plans, expansion, churn. Creator or affiliate: audience growth, list growth,
  sponsorships, own products.
- The main bottleneck. Use their stated priority and blockers, then confirm it with the funnel stage
  most likely to be weakest.
- Delivery capacity. Check the hours available can deliver the volume the plan sells. If a lever
  cannot be delivered in their hours - many 1:1 clients, for instance - choose one that scales.

# Step 2: Build the revenue plan
1. Work backwards from the goal into month 1, month 2 and month 3. Revenue grows each month, and
   month 3 equals or exceeds the goal.
2. Choose 2-4 revenue streams from the levers above. For each month: volume x price = revenue. Use
   their real prices where given; otherwise propose prices that fit the market and say so.
3. Derive every volume from a stated assumption: cost per customer or per lead, conversion rate, take
   rate, churn, show rate, close rate. Use typical benchmarks for this model and price point.
4. If the goal is far above current revenue, close the gap with higher-value or higher-leverage
   levers - a premium offer, recurring revenue, a list or audience engine, partnerships - not by
   assuming unrealistic conversion rates.
5. Fund growth from the business. If the plan uses paid ads, set one budget rule, and month 1 spend
   must fit inside their stated budget. If it uses no ads, show where customers come from instead.
6. State the assumptions in one sentence.

# Step 3: Design the phases
- Three phases: Days 1-30, Days 31-60, Days 61-90, each with a short name describing its job.
- Phase 1 fixes the bottleneck and opens the fastest revenue - usually existing customers, contacts
  or list - before any scaling.
- Each phase ends at a checkpoint: that month's revenue target plus one or two numbers showing the
  plan is on track, with what to do if it is hit and what to do if it is missed.
- The checkpoints must match the revenue table exactly.

# Step 4: Write the weekly steps
- Weeks 1, 2, 3 and 4 in phase 1, then pairs of weeks, then week 13 on its own: review and plan the
  next quarter.
- 3-5 steps per week. Each step: an action title, then one or two sentences on exactly what to do,
  with specific numbers - prices, budgets, counts, targets - and the AFU resource to use.
- If a step needs an input (customer feedback, proof, data, an offer), an earlier step must create it.
- Respect the "will not do" list in every step. Warm follow-up with people who asked is allowed; cold
  outreach is not, unless they said they are willing.
- The weekly hours must fit the time they said they have.

# Step 5: Choose AFU resources
- Only items that exist in the catalogue above, by exact id.
- Per step, the one or two items that most directly do or speed up that step. Prefer, in order:
  specialists and skills for one-off work (a page, an offer, an email sequence); routines for
  recurring work (reports, monitoring, follow-up); specific course lessons with their durations
  rather than whole courses, unless the whole course is genuinely needed; then prompts and downloads.
- Use their existing tools for execution - website, payments, ad platform, email - and AFU resources
  for the thinking, writing and automation around them.
- Leave out anything that does not move this member toward their goal. A short, well-chosen toolkit
  beats a long one.

# Writing rules
- The member's currency throughout, written the same way everywhere.
- One name per concept throughout. "Cost per customer", never also "CAC".
- Address them as "you". Short, concrete sentences.
- Nothing about their personality, habits or motivation. Only what they said and what the numbers show.
- No repeated sections, no motivational lines, no hedging. Assumptions stated once.
- Never these words: unlock, transform, supercharge, game-changer, seamless, effortless, skyrocket,
  "10x". No exclamation marks. If a sentence would work in an advert, cut it.

# Final check - fix anything that fails before you answer
- Month 3 revenue equals or exceeds the goal, and every total adds up.
- Every volume comes from a stated assumption, realistic for this model and price point.
- Month 1 costs fit inside the stated budget; later spend is funded by revenue under the budget rule.
- The plan can be delivered in their stated hours, fulfilment included.
- The phase targets match the revenue table.
- Every step's inputs are created by an earlier step.
- Nothing breaks the "will not do" list.
- Every resource id exists in the catalogue above.

# Output
Call the roadmap tool with the finished plan. Do not write anything else.`;
}

/* ---------------- the call ---------------- */

/**
 * The roadmap, delivered as data.
 *
 * The retries, the ceiling and the tool handling live in lib/claude.js now:
 * the reports pipeline needs exactly the same behaviour, and two copies of
 * logic this fiddly would have disagreed within a month.
 */
export async function callClaude(prompt) {
  return callTool(prompt, {
    name: 'roadmap',
    description: 'Deliver the finished roadmap. Always answer by calling this.',
    input_schema: SCHEMA
  });
}

/* ---------------- validation ---------------- */

/**
 * Whether a title appears in a sentence as itself, rather than inside a longer
 * word. Both arguments are already lowercase.
 */
export function wholePhrase(hay, needle) {
  const word = /[a-z0-9]/;
  let at = hay.indexOf(needle);
  while (at !== -1) {
    const before = at === 0 ? '' : hay[at - 1];
    const after = hay[at + needle.length] || '';
    if (!word.test(before) && !word.test(after)) return true;
    at = hay.indexOf(needle, at + 1);
  }
  return false;
}

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

  /**
   * Everything in the catalogue, by title, for finding what a step talks about
   * but forgot to attach.
   *
   * A step that says "install the Email Specialist plugin" and links to
   * nothing is the complaint that started this: the name is right there and
   * the member still has to go and look for it. Short titles are left out
   * because a two-word title matches prose by accident, and it is better to
   * miss a link than to invent one.
   */
  const named = [];
  const push = (type, id, title, extra) => {
    const t = String(title || '').trim();
    // Sixteen characters, which is not arbitrary: the downloads are named
    // "Sales Page", "Leads", "Content", "Newsletter". Match those and "the
    // sales page should use their words" becomes a link to a prompt pack, and
    // every roadmap turns blue. A missed link costs nothing; a wrong one
    // teaches the member not to trust the links.
    if (t.length >= 16) named.push({ type, id, title: t, needle: t.toLowerCase(), ...extra });
  };
  for (const c of catalogue.courses) push('course', c.slug, c.title);
  for (const l of (catalogue.lessons || [])) push('lesson', l.id, l.title, { course: l.course, duration: l.duration });
  for (const i of catalogue.items) push('item', i.id, i.title, { kind: i.kind, kindLabel: i.kindLabel });
  for (const d of catalogue.downloads) push('download', d.key, d.title);

  /**
   * What a step's own words name, so the document can link the words
   * themselves.
   *
   * Not added to the step's resources: those chips are chosen deliberately and
   * a second copy of each one underneath would be noise. The mention is the
   * link.
   */
  const mentionsIn = (step) => {
    const hay = [step.why, step.detail, ...list(step.how)].filter(Boolean).join(' · ').toLowerCase();
    if (!hay) return undefined;
    const found = [];
    for (const n of named) {
      if (found.length >= 4) break;
      if (!wholePhrase(hay, n.needle)) continue;
      const { needle, ...rest } = n;
      found.push(rest);
    }
    return found.length ? found : undefined;
  };

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
  const revenue = obj(parsed.revenue);
  const startHere = obj(parsed.startHere);
  const warnings = [];

  /* ---- the toolkit, derived rather than asked for ----

     The spec wants every resource the plan names, in order of use, with where
     it is used. Asking the model for that list as well as for the steps gives
     two lists that can disagree, and the one that disagrees is always the
     summary. Built from the steps instead, so it cannot. */
  const toolkit = [];
  const seenTool = new Set();
  const collect = (when, rs) => {
    for (const r of rs) {
      const k = r.type + ':' + r.id;
      if (seenTool.has(k)) continue;
      seenTool.add(k);
      toolkit.push({ when, type: r.type, id: r.id, title: r.title, course: r.course, kindLabel: r.kindLabel });
    }
  };

  const sh = {
    minutes: str(startHere.minutes, 60),
    steps: list(startHere.steps).slice(0, 8).map((s) => {
      const step = {
        title: str(s && s.title, 200),
        detail: str(s && s.detail, 700),
        minutes: str(s && s.minutes, 40)
      };
      step.resources = resources(s && s.resources);
      step.mentions = mentionsIn(step);
      return step;
    }).filter((s) => s.title)
  };
  for (const s of sh.steps) collect('Day 1', s.resources);

  const phases = list(parsed.phases).slice(0, 4).map((p) => {
    const window = str(p.window, 60);
    const weeks = list(p.weeks).slice(0, 8).map((w) => ({
      label: str(w && w.label, 40),
      steps: list(w && w.steps).slice(0, 8).map((st) => {
        const step = { title: str(st && st.title, 200), detail: str(st && st.detail, 900) };
        step.resources = resources(st && st.resources);
        step.mentions = mentionsIn(step);
        return step;
      }).filter((st) => st.title)
    })).filter((w) => w.label && w.steps.length);

    for (const w of weeks) for (const s of w.steps) collect(w.label, s.resources);

    const cp = obj(p.checkpoint);
    return {
      window,
      name: str(p.name, 80),
      target: str(p.target, 80),
      weeks,
      checkpoint: {
        label: str(cp.label, 40),
        numbers: list(cp.numbers).map((n) => str(n, 200)).filter(Boolean).slice(0, 4),
        hit: str(cp.hit, 500),
        missed: str(cp.missed, 500)
      }
    };
  }).filter((p) => p.window && p.weeks.length);

  /* ---- do the months add up ----

     The brief says every number must add up, so this checks rather than hopes:
     the row amounts are summed and compared with the stated total. It is a
     report, not a correction - rewriting somebody's revenue plan on a regex
     would be worse than printing it wrong - and the admin screen says so
     before anybody publishes. */
  const money = (s) => {
    // "12 sales · $1,200" — the amount is the last number, after the separator.
    const tail = String(s || '').split(/[·|]/).pop();
    const m = String(tail).replace(/[, ]/g, '').match(/-?\d+(?:\.\d+)?/g);
    if (!m) return null;
    const n = Number(m[m.length - 1]);
    return Number.isFinite(n) ? n : null;
  };

  const rows = list(revenue.rows).slice(0, 8).map((r) => ({
    source: str(r && r.source, 200),
    m1: str(r && r.m1, 80), m2: str(r && r.m2, 80), m3: str(r && r.m3, 80)
  })).filter((r) => r.source);

  const total = obj(revenue.total);
  const totals = { m1: str(total.m1, 60), m2: str(total.m2, 60), m3: str(total.m3, 60) };
  for (const m of ['m1', 'm2', 'm3']) {
    const stated = money(totals[m]);
    if (stated === null || !rows.length) continue;
    const parts = rows.map((r) => money(r[m])).filter((n) => n !== null);
    if (parts.length !== rows.length) continue;
    const sum = parts.reduce((a, b) => a + b, 0);
    // A pound or two is rounding; anything more is a plan that argues with
    // itself in front of the member.
    if (Math.abs(sum - stated) > Math.max(2, stated * 0.01)) {
      warnings.push(`month ${m.slice(1)}: the rows add up to ${sum.toLocaleString()} but the total says ${stated.toLocaleString()}`);
    }
  }

  const adSpend = obj(revenue.adSpend);
  const ads = { m1: str(adSpend.m1, 60), m2: str(adSpend.m2, 60), m3: str(adSpend.m3, 60) };

  const scorecard = list(parsed.scorecard).slice(0, 8).map((m) => {
    const row = {
      number: str(m && m.number, 160),
      target: str(m && m.target, 160),
      ifBelow: str(m && m.ifBelow, 300)
    };
    const r = resources(m && m.routine ? [m.routine] : [])[0];
    if (r) row.routine = r;
    return row;
  }).filter((m) => m.number);
  for (const m of scorecard) if (m.routine) collect('Weekly', [m.routine]);

  return {
    roadmap: {
      goal: str(parsed.goal, 200),
      opening: str(parsed.opening, 1200),
      revenue: {
        intro: str(revenue.intro, 500),
        rows,
        total: totals,
        adSpend: (ads.m1 || ads.m2 || ads.m3) ? ads : null,
        budgetRule: str(revenue.budgetRule, 500),
        assumptions: str(revenue.assumptions, 800)
      },
      startHere: sh,
      phases,
      fallBehind: list(parsed.fallBehind).map((f) => str(f, 400)).filter(Boolean).slice(0, 5),
      scorecard,
      workingWeek: list(parsed.workingWeek).map((r) => ({
        block: str(r && r.block, 160), hours: str(r && r.hours, 40)
      })).filter((r) => r.block).slice(0, 8),
      toolkit,
      notDoing: list(parsed.notDoing).map((w) => str(w, 400)).filter(Boolean).slice(0, 6)
    },
    dropped,
    warnings
  };
}

