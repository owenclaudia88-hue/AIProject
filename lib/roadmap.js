/**
 * The Personalised AI Roadmap: what we ask, and what comes back.
 *
 * The questions live here rather than in the form, because three things need
 * to agree about them — the form that collects the answers, the admin screen
 * that displays them, and the prompt that turns them into a roadmap. Written
 * out three times they would drift, and the first sign of it would be a
 * roadmap built on a question nobody was asked.
 *
 * Six steps rather than one long page. The same eighteen questions on one
 * screen is a wall; in six short steps it reads as a consultation, which is
 * what it is.
 */

export const STEPS = [
  {
    key: 'business',
    title: 'Your business',
    blurb: 'The basics, so the roadmap is about your business rather than a generic one.',
    fields: [
      { key: 'what', label: 'What do you sell, or want to sell?', type: 'text', required: true,
        placeholder: 'e.g. 1:1 business coaching for tradespeople' },
      { key: 'industry', label: 'What industry are you in?', type: 'line', required: true,
        placeholder: 'e.g. coaching, e-commerce, agency, SaaS' },
      { key: 'stage', label: 'Where are you now?', type: 'choice', required: true,
        options: ['Just an idea', 'Pre-revenue, building', 'First customers', 'Steady revenue, want more',
                  'Established, want to scale'] },
      { key: 'website', label: 'Website or main profile', type: 'line',
        placeholder: 'https://… — or where people find you now' }
    ]
  },
  {
    key: 'customer',
    title: 'Your customer',
    blurb: 'Who the work is for. Most of the roadmap turns on this.',
    fields: [
      { key: 'who', label: 'Who is your ideal customer?', type: 'text', required: true,
        placeholder: 'Be specific — "small business owners" is harder to help with than "plumbers with 2-5 vans"' },
      { key: 'problem', label: 'What problem do you solve for them?', type: 'text', required: true },
      { key: 'find', label: 'How do they find you today?', type: 'text',
        placeholder: 'e.g. word of mouth, Instagram, cold outreach, nowhere yet' }
    ]
  },
  {
    key: 'goal',
    title: 'Your goal',
    blurb: 'What would have to be true in 90 days for this to have been worth it.',
    fields: [
      { key: 'ninety', label: 'What do you want to be true in 90 days?', type: 'text', required: true,
        placeholder: 'A number if you have one — "£5k a month" beats "more revenue"' },
      { key: 'revenue', label: 'Roughly what are you making now, monthly?', type: 'choice',
        options: ['Nothing yet', 'Under $1k', '$1k–$5k', '$5k–$20k', '$20k–$50k', 'Over $50k', 'Rather not say'] },
      { key: 'priority', label: 'If only one thing improved, what should it be?', type: 'choice', required: true,
        options: ['Getting more leads', 'Converting more of them', 'Charging more', 'Serving customers faster',
                  'Getting my time back', 'Launching the thing at all'] }
    ]
  },
  {
    key: 'resources',
    title: 'What you have to work with',
    blurb: 'A plan that needs twenty hours a week from somebody who has four is not a plan.',
    fields: [
      { key: 'hours', label: 'Hours a week you can genuinely give this', type: 'choice', required: true,
        options: ['Under 2', '2–5', '5–10', '10–20', 'More than 20'] },
      { key: 'team', label: 'Who else is involved?', type: 'choice', required: true,
        options: ['Just me', 'Me plus a VA or freelancer', 'A small team', 'A team with its own marketing'] },
      { key: 'budget', label: 'Monthly budget for tools and ads', type: 'choice',
        options: ['Nothing beyond this membership', 'Under $100', '$100–$500', '$500–$2,000', 'Over $2,000'] },
      { key: 'tools', label: 'What are you already using?', type: 'text',
        placeholder: 'e.g. Shopify, Mailchimp, Make, Canva — and how comfortable you are with them' }
    ]
  },
  {
    key: 'blockers',
    title: 'What is in the way',
    blurb: 'The honest version is the useful one. Nobody else reads this.',
    fields: [
      { key: 'stuck', label: 'What is actually stopping you right now?', type: 'text', required: true },
      { key: 'tried', label: 'What have you already tried that did not work?', type: 'text',
        placeholder: 'So the roadmap does not send you back round the same loop' },
      { key: 'ai', label: 'How are you using AI today?', type: 'choice', required: true,
        options: ['Not at all yet', 'Occasional chat, nothing systematic', 'A few prompts I reuse',
                  'Some automations running', 'Quite a lot, want it sharper'] }
    ]
  },
  {
    key: 'preferences',
    title: 'How you like to work',
    blurb: 'So the plan suits you rather than an imaginary average member.',
    fields: [
      { key: 'style', label: 'Would you rather…', type: 'choice', required: true,
        options: ['Do it myself, show me how', 'Set it up once and let it run', 'Hand as much as possible to AI',
                  'A mix — some hands-on, some automated'] },
      { key: 'avoid', label: 'Anything you will not do?', type: 'text',
        placeholder: 'e.g. "no video of my face", "not posting on TikTok", "no cold calling"' },
      { key: 'anything', label: 'Anything else we should know?', type: 'text' }
    ]
  }
];

/** Every field, flattened, for validating a submission and labelling answers. */
export const FIELDS = STEPS.flatMap((s) =>
  s.fields.map((f) => ({ ...f, step: s.key, stepTitle: s.title })));

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [`${f.step}.${f.key}`, f]));

export const REQUIRED = FIELDS.filter((f) => f.required).map((f) => `${f.step}.${f.key}`);

/**
 * Trims a submission to the questions we actually asked.
 *
 * Built from the definition rather than from what arrived, so a field nobody
 * was asked about cannot be posted in and end up in the prompt.
 */
export function cleanAnswers(raw) {
  const out = {};
  const given = raw && typeof raw === 'object' ? raw : {};
  for (const f of FIELDS) {
    const k = `${f.step}.${f.key}`;
    const v = given[k];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, f.type === 'text' ? 2000 : 300);
    if (!trimmed) continue;
    // A choice has to be one of the choices, or it is not a choice.
    if (f.type === 'choice' && !f.options.includes(trimmed)) continue;
    out[k] = trimmed;
  }
  return out;
}

/** Which required questions are still unanswered. */
export function missing(answers) {
  return REQUIRED.filter((k) => !answers[k]);
}

/** The answers as a readable block, for the admin screen and the prompt. */
export function answersAsText(answers) {
  const lines = [];
  for (const s of STEPS) {
    const rows = s.fields
      .map((f) => ({ f, v: answers[`${s.key}.${f.key}`] }))
      .filter((r) => r.v);
    if (!rows.length) continue;
    lines.push(`## ${s.title}`);
    for (const { f, v } of rows) lines.push(`- ${f.label}\n  ${v}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** What the member area needs to draw the form, without the server internals. */
export function formSpec() {
  return STEPS.map((s) => ({
    key: s.key, title: s.title, blurb: s.blurb,
    fields: s.fields.map((f) => ({
      key: `${s.key}.${f.key}`, label: f.label, type: f.type,
      required: !!f.required, placeholder: f.placeholder || '', options: f.options || []
    }))
  }));
}
