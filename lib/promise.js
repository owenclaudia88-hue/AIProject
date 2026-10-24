import { callTool } from './claude.js';

/**
 * The Promise Builder: one paragraph about an offer in, six promises for the
 * top of its sales page out - four straight, two wild - each with the bar
 * above the headline, the headline, the line under it, and an honest score
 * against the five things that make a promise sell.
 *
 * The rule that matters most is the one about proof: nothing in a promise may
 * claim a result, a number or a name the member did not give. A made-up
 * testimonial on a sales page is worse than none, and this tool would be
 * writing it for them.
 */

export const FIELDS = [
  { key: 'offer', label: 'What is your offer about?', required: true,
    hint: 'Rant it out. The more you say, the better your promises get.',
    example: 'A 5-day challenge that helps busy dental practice owners fill empty hygiene slots with a simple text message system, for $27.' },
  { key: 'win', label: 'What is the quick win?', hint: 'The first result they can point at.',
    example: 'They book 3 hygiene appointments from their old patient list in the first 48 hours.' },
  { key: 'fails', label: 'Why do other fixes fail them?', hint: 'The core reason they are still stuck.',
    example: 'They pay for ads to find new patients while hundreds of old ones sit in the system and nobody texts them.' },
  { key: 'different', label: 'What makes yours different?', hint: 'Your own way of getting the result.',
    example: 'Five ready-made texts sent from the phone they already have. No new software, no ad spend.' },
  { key: 'proof', label: 'Any proof? Wins, numbers, testimonials.',
    hint: 'Skip it if you are new. Your promises never use proof you did not give.',
    example: 'Dr Patel filled 11 slots in her first week. 40 practices have run it.' }
];

export const SCORES = [
  ['small', 'Small', 'Asks for one small, believable step, not a life change.'],
  ['tangible', 'Tangible', 'A result you could see, count or screenshot.'],
  ['verb', 'Action verb', 'Leads with a doing word: get, install, turn, book.'],
  ['button', 'Push button', 'Feels easy and done-for-you, not hard work.'],
  ['time', 'Time', 'Says how fast: in 24 hours, by Friday, in 3 days.']
];

const str = (description) => ({ type: 'string', description });
const score = (d) => ({ type: 'integer', minimum: 1, maximum: 5, description: d });
const OPTION = {
  type: 'object',
  properties: {
    bar: str('The short line in the bar above the headline. Calls out who it is for, the enemy, or a proof point. Ends with "..." when it leads into the headline.'),
    headline: str('The promise itself. Under 16 words. Title Case.'),
    sub: str('One line under the headline: the mechanism, the even-if, or the moment they can picture. One sentence.'),
    scores: {
      type: 'object',
      properties: Object.fromEntries(SCORES.map(([k, , d]) => [k, score(d)])),
      required: SCORES.map(([k]) => k)
    },
    why: str('One sentence on why this one works, plain words, no jargon.')
  },
  required: ['bar', 'headline', 'sub', 'scores', 'why']
};

const TOOL = {
  name: 'promises',
  description: 'Deliver the outcome and the six promises. Always answer by calling this.',
  input_schema: {
    type: 'object',
    properties: {
      outcome: str('The one outcome the whole offer delivers, in one sentence: who, what result, how fast, before or without what.'),
      options: { type: 'array', description: 'Exactly four straight promises.', items: OPTION },
      wild: { type: 'array', description: 'Exactly two wild cards: break one rule on purpose for a bolder angle.', items: OPTION }
    },
    required: ['outcome', 'options', 'wild']
  }
};

const RULES = `# The five things a promise is scored on (1 to 5 each, honestly)
${SCORES.map(([, label, d]) => `- ${label}: ${d}`).join('\n')}

# Rules
- Use ONLY the facts given. Never invent a result, a number, a name, a testimonial or a client count.
  If there is no proof, write promises that need none. If a price is needed and was not given,
  write [PRICE] for them to fill in.
- Plain, everyday words. No hype words: unlock, transform, supercharge, game-changer, skyrocket,
  revolutionary, secret. No exclamation marks.
- The four straight promises each take a different route: lead with proof (only if given), lead
  with the mechanism, call out the enemy, and the bold one.
- The two wild cards each break exactly one rule on purpose (no verb, no time frame, a three-word
  command, a flipped order) and say in "why" which rule they break.
- Score honestly. A promise with no time frame scores 1 or 2 on Time. Not everything is a 5.
- Every sub-line is different. No two promises open the same way.`;

export function buildPromisePrompt(answers) {
  const given = FIELDS.filter((f) => String(answers[f.key] || '').trim())
    .map((f) => `${f.label}\n${String(answers[f.key]).trim()}`).join('\n\n');
  return `You write the promise at the top of a sales page for a small business owner who sells a
coaching, course, service or digital offer. A promise is the bar above the headline, the headline
and the line under it: the first thing a stranger reads, and what decides whether they keep reading.

# Their offer, in their words
${given}

${RULES}

# Output
First the one outcome the offer delivers. Then four straight promises and two wild cards.
Call the promises tool with the finished answer. Do not write anything else.`;
}

const REFINE = {
  tangible: 'Make it more tangible: a result they could see, count or screenshot.',
  bolder: 'Make it bolder: a stronger claim or a sharper angle, still only from the facts given.',
  simpler: 'Make it simpler: fewer words, plainer words, one idea.',
  angle: 'Take a completely new angle on the same outcome.'
};
export const REFINE_KINDS = Object.keys(REFINE);

export async function writePromises(answers) {
  const { data } = await callTool(buildPromisePrompt(answers), TOOL, { maxTokens: 8000 });
  return tidy(data);
}

/** One promise, rewritten the way they asked. */
export async function refinePromise(answers, outcome, option, kind) {
  const tool = {
    name: 'promise', description: 'Deliver the rewritten promise. Always answer by calling this.',
    input_schema: OPTION
  };
  const prompt = `${buildPromisePrompt(answers).split('# Output')[0]}
# The outcome
${outcome}

# The promise to rewrite
Bar: ${option.bar}
Headline: ${option.headline}
Sub: ${option.sub}

# What to change
${REFINE[kind]}

Call the promise tool with the rewritten promise and its new scores. Do not write anything else.`;
  const { data } = await callTool(prompt, tool, { maxTokens: 2000 });
  return cleanOption(data);
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
function cleanOption(o) {
  if (!o || typeof o !== 'object') return null;
  const scores = {};
  for (const [k] of SCORES) scores[k] = Math.min(5, Math.max(1, Math.round(Number(o.scores?.[k]) || 1)));
  const out = { bar: clip(o.bar, 160), headline: clip(o.headline, 200), sub: clip(o.sub, 300), scores, why: clip(o.why, 300) };
  return out.headline ? out : null;
}
function tidy(d) {
  if (!d) throw new Error('the model returned nothing');
  const options = (Array.isArray(d.options) ? d.options : []).map(cleanOption).filter(Boolean).slice(0, 4);
  const wild = (Array.isArray(d.wild) ? d.wild : []).map(cleanOption).filter(Boolean).slice(0, 2);
  if (!options.length) throw new Error('the model returned no promises');
  return { outcome: clip(d.outcome, 400), options, wild };
}
