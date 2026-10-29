import { callTool } from './claude.js';

/**
 * The Vaults: the prompts that came over from the old library, each rebuilt
 * from scratch in a house format, so what members get is ours rather than a
 * copy with the names changed.
 *
 *   AI Prompt Vault   kind 'prompt'        the 901 LLM prompts
 *   AI Visual Vault   kind 'image_prompt'  the image and video prompts
 *
 * Every Vault entry has the same shape: a title that names the result, a
 * one-line description, what you get, the blanks listed up front, the prompt
 * itself (or steps run in order), three follow-ups, and which model it suits.
 * The rebuild lands in `meta.vault` as a draft; the live title, description
 * and body stay exactly as they are until somebody decides to publish, so
 * nothing a member sees changes while the run is on.
 *
 * A Visual Vault entry can also be a collection: a set of finished prompts
 * with a picture made from each (library_gallery). Those rows are rebuilt by
 * their own job (see gallery.js); here the collection's own title and
 * description are rebuilt, with the follow-ups that apply to every prompt in
 * the set.
 */

export const HOWTO = {
  prompt: 'Fill in the brackets, paste it into Claude or ChatGPT, then keep the conversation going with the follow-ups underneath.',
  image_prompt: 'Attach your own photo or screenshot where the prompt asks for one, paste the prompt into the generator, then adjust in the same chat with the lines underneath.'
};
export const VAULT_HOWTO = HOWTO.prompt;

/* The small model, with the hand-written and Opus-written rebuilds as its
   examples. The first thirty-three on Opus cost about 16 cents each, which
   over 862 prompts is a bill nobody wanted; with the house style in front of
   it the small one follows the format for a fraction of a cent, and every
   rebuild is checked against the rules either way. The `vault_model` setting
   overrides this without a deploy. */
export const VAULT_MODEL = process.env.VAULT_MODEL || 'claude-haiku-5-5';

const str = (description) => ({ type: 'string', description });
const list = (description, items = { type: 'string' }) => ({ type: 'array', description, items });

export const TOOL = {
  name: 'vault_prompt',
  description: 'Deliver the rebuilt prompt. Always answer by calling this.',
  input_schema: {
    type: 'object',
    properties: {
      title: str('The result, in up to ten words. Starts with a verb or a concrete noun phrase. Never the original title.'),
      description: str('One sentence, under 160 characters, that says what this is for and what makes it different.'),
      whatYouGet: str('One sentence: what the reader has at the end.'),
      fillIn: list('Up to five things the reader fills in or has ready before pasting, each a short phrase.'),
      brief: str('The prompt itself, for a single-prompt entry. Blanks in [square brackets with a hint inside]. Empty when steps are used.'),
      steps: list('Two to eight prompts run in order, or named variants of one prompt, for an entry with more than one. Empty when brief is used.', {
        type: 'object',
        properties: { title: str('Two to five words.'), brief: str('The prompt for this step or variant.') },
        required: ['title', 'brief']
      }),
      thenAskFor: list('Exactly three follow-up messages the reader can send next, written as they would type them.'),
      worksBestIn: str('Which model or generator suits it, in a few words, with at most one short sentence of reason.'),
      tags: list('Three to five lower-case tags.')
    },
    required: ['title', 'description', 'whatYouGet', 'fillIn', 'thenAskFor', 'worksBestIn', 'tags']
  }
};

/* From the hand-written pilot, so the model has the house style in front of
   it rather than a description of it. */
const EXAMPLES = {
  prompt: [
    {
      original: { title: 'Content-driven Email Newsletter', text: 'You are a content strategist and email marketing expert specializing in content-driven newsletters. Design a high-engagement content newsletter for [AUDIENCE_PROFILE] in [INDUSTRY/NICHE]... Create a comprehensive newsletter framework including: (1) content strategy (2) content mix formula (3) section structure (4) content sourcing strategy (5) contributor program... Develop a content calendar template... Design segmentation approach... Create growth strategy... Include engagement metrics... Format as a publisher\'s guide with newsletter template, editorial calendar, content sourcing system, and metrics dashboard.' },
      vault: {
        title: 'Plan a newsletter people open every week',
        description: 'One angle, three sections and a first issue drafted, instead of a forty-point framework you never finish.',
        whatYouGet: 'A one-page newsletter plan and a complete first issue, written for the people already on your list.',
        fillIn: ['Who reads it and how many', 'What you sell', 'How often you can honestly send', "One thing you know that your readers don't"],
        brief: "I run [what your business does] and I want to start a newsletter for [who is on your list, and roughly how many]. I can send it [weekly / fortnightly] without fail. The thing I know that my readers don't is [your edge: a process, a market, a mistake you keep seeing].\n\nWork with me in three passes.\n\nPass 1: ask me up to five questions you need answered before planning anything. Wait for my answers.\n\nPass 2: give me a one-page plan with:\n- the angle in one sentence, written so a reader could repeat it to a friend\n- three recurring sections, each with a name, what it's for and a target length\n- the first eight issue topics, in order, each with the reason a reader would open it\n- a subject line rule I can apply myself every week\n\nPass 3: draft issue one in full, in my voice, at the lengths you set. End with one question that gets a reply, not a sale.\n\nKeep it to what one person can produce in two hours a week. If something in my answers makes a weekly send unrealistic, say so and plan for fortnightly instead.",
        thenAskFor: ['Rewrite the opening of issue one three ways: a story, a number, a question.', 'Give me the welcome email a new subscriber gets before issue one.', 'Which of the eight topics could become a lead magnet, and what would it be called?'],
        worksBestIn: 'Claude for the drafting; either for the plan.',
        tags: ['newsletter', 'email', 'content', 'audience']
      }
    },
    {
      original: { title: 'Writing Email Sequences', text: 'Prompt 1: I am writing a sequence of 5 emails for my [vegan desert brand called Vegan Delicious]. The sequence is triggered [after someone signs up]... I want you to help me draft the first email... Please ask me questions about my business before we begin.\nPrompt 2: Let\'s try 5 different email sign offs.\nPrompt 3: Let\'s try 5 new subject lines.' },
      vault: {
        title: 'Write a 5-email welcome sequence that sells without pushing',
        description: 'From sign-up to first purchase in five emails, drafted one at a time so each one earns the next.',
        whatYouGet: 'Five emails in your voice, each with a job, plus subject lines and a sending schedule.',
        fillIn: ['What you sell', 'How people join the list', 'Your tone, and what you never do', 'The one thing you want them to buy'],
        steps: [
          { title: 'Set it up', brief: "I'm writing a five-email sequence for [your business and what it sells]. People join the list when they [how they sign up: a download, a quiz, a purchase, a checkout left unfinished]. The sequence should end with them [buying X / booking a call / replying]. My tone is [two or three words], and I never [things you don't do: discount, use urgency, use exclamation marks].\n\nBefore you write anything, ask me the five questions whose answers would most change the emails. Then give me a one-line job for each of the five emails and a sending schedule in days. Wait for me to approve it." },
          { title: 'Draft email one', brief: 'Write email one. Its only job is to make the reader glad they signed up: deliver what they came for, say who we are in two sentences, and ask one easy question that gets a reply. Under 150 words. Three subject lines, none with a question mark.' },
          { title: 'The rest', brief: 'Write emails two to five, one per message, following the jobs we agreed. Each one teaches one thing or tells one story, and the last one makes the offer plainly, with the price, in one paragraph. Keep every email under 200 words and in the same voice as email one.' }
        ],
        thenAskFor: ["Give me a sixth email for people who opened everything but didn't buy.", 'Rewrite email five for someone who has already bought something cheaper from us.', 'Five alternative sign-offs that sound like me.'],
        worksBestIn: 'Either. Keep it in one conversation so the voice stays consistent.',
        tags: ['email', 'welcome sequence', 'copywriting']
      }
    },
    {
      original: { title: 'Remove Overused Phrases & Constructions', text: 'You must strictly avoid every overused construction, word, expression, and punctuation mark listed in this sheet, including the em-dash. For every idea, use one of the suggested replacement strategies from the sheet. After writing the draft, scan your own text...' },
      vault: {
        title: 'Take the AI tells out of your writing',
        description: 'The words, phrases and habits that give away machine-written text, with the fix for each, applied to your draft.',
        whatYouGet: 'Your text rewritten without the usual giveaways, plus a list of what changed and why, so you learn the pattern.',
        fillIn: ['Your draft'],
        brief: "Rewrite the text below so it reads as if a busy person wrote it, then show me what you changed.\n\nRemove all of these:\n- Dashes used for drama. Use a comma, a full stop or brackets.\n- Three-item lists where two would do, and \"not just X, but Y\" constructions.\n- Openers like \"In today's fast-paced world\", \"In the ever-evolving landscape\", \"Let's dive in\".\n- Filler adjectives: robust, seamless, cutting-edge, game-changing, powerful, comprehensive, crucial, vital, key.\n- Verbs nobody says out loud: delve, leverage, utilise, elevate, unlock, harness, navigate, foster, empower.\n- Words that announce a point instead of making it: \"It's important to note\", \"Ultimately\", \"At the end of the day\", \"That being said\".\n- Rhetorical questions followed by the answer.\n- A closing line that sums up what was just said.\n- Two sentences in a row that start with the same word.\n\nKeep my meaning, my facts and roughly my length. Keep contractions. Vary sentence length. If a sentence says nothing, cut it rather than fix it.\n\nAfter the rewrite, list each change as \"was → now\", grouped by the rule it broke. Then tell me the two habits that came up most, so I can stop doing them.\n\nText:\n[paste your draft]",
        thenAskFor: ['Do it again, but keep it closer to my original wording.', 'Check the rewritten version against the list once more and tell me if anything slipped through.', 'Give me the same list as a short rule sheet I can paste at the top of any future prompt.'],
        worksBestIn: 'Claude for anything over a few paragraphs.',
        tags: ['editing', 'writing', 'voice']
      }
    }
  ],
  image_prompt: [
    {
      original: { title: 'Create Professional Images For Digital Product, App, or Website', text: 'We recommend using Nano Banana... First, attach the image or screenshot you wish to transform, then enter one of the prompts below.\nUI Banner Promo: Create a sleek banner promoting [product name]. Use the attached screenshot as the base, pulling in key UI elements like buttons and charts. Add a bold headline in modern font on a [blue] gradient background for a professional look.\nFeature Spotlight Banner: Generate a compact banner spotlighting [specific feature]... futuristic tech theme with high contrast colors.\nDiscount Offer Banner: ... bold text \'[offer details]\' with a vibrant red and yellow scheme for urgency.\n(ten variants in all)' },
      vault: {
        title: 'Turn one app screenshot into a set of marketing images',
        description: 'Six images from the screenshot you already have: a launch banner, a feature close-up, an offer, a quote, a before-and-after and a phone-sized version, in your own colours.',
        whatYouGet: 'Six finished marketing images built on your real interface, each one a separate prompt you paste with the screenshot attached.',
        fillIn: ['A clean screenshot of your app or site, at least 1,500 pixels wide', 'Your product name and one-line headline', 'Your two brand colours, as hex codes if you have them', 'The one feature, offer or quote each image is about'],
        steps: [
          { title: 'Launch banner', brief: 'Use the attached screenshot of [product name] as the base. Make a wide launch banner, 16:9. Keep the real interface readable and in the centre at a slight angle, on a plain background of [your main brand colour] fading to a darker shade of the same. Add the headline "[your headline, under eight words]" in a clean sans-serif, white, top left. No other text, no stock icons, no invented interface elements.' },
          { title: 'Feature close-up', brief: 'From the attached screenshot, crop in on [the feature, e.g. the reporting chart] and make it the whole picture, 4:5. Blur the rest of the interface softly behind it, keep the feature sharp and exactly as it appears. Add one short label "[three to five words]" in [brand colour] underneath. Nothing else added.' },
          { title: 'Offer image', brief: 'Make a square offer image from the attached screenshot. Show the interface small in the lower half on a background of [brand colour]. Above it, the words "[the offer, e.g. 30% off until Friday]" large and plain in white. No badges, no starbursts, no exclamation marks, no colours other than mine and white.' },
          { title: 'Customer quote', brief: 'Use the attached screenshot faded to about 40% as a background, 1:1. On top, the quote "[one sentence from a customer]" in white serif text, with "[customer first name, job]" smaller beneath it. Keep the interface recognisable but secondary. No photo of a person, no quotation-mark graphics.' },
          { title: 'Before and after', brief: 'Make a side-by-side image, 16:9. Left half: a plain grey mock-up of [what people used before, e.g. a spreadsheet], labelled "Before" in grey. Right half: the attached screenshot, labelled "After" in [brand colour]. A thin vertical line between them. Same scale on both sides, nothing else added.' },
          { title: 'Phone version', brief: 'Rebuild the launch banner from the attached screenshot as a 9:16 image for a phone screen. The interface fills the lower two thirds, the headline "[your headline]" sits in the top third in white on [brand colour]. Keep the text large enough to read on a phone and leave the top and bottom 10% empty for the app overlays.' }
        ],
        thenAskFor: ['Keep everything and swap the background for white with a light grey edge.', 'Same image, but make the headline half the size and move it bottom left.', 'Give me the same one in 4:5 for Instagram without losing any of the interface.'],
        worksBestIn: 'Nano Banana (Google Gemini) or ChatGPT images: both keep a real screenshot intact. Midjourney redraws it.',
        tags: ['marketing images', 'app screenshots', 'banners', 'nano banana']
      }
    },
    {
      original: { title: 'Simple Photo To Professional Marketing Video', text: 'Enter the first prompt into ChatGPT: You are an expert prompt engineer. Write a JSON prompt for an AI image generator... professional advertising-style product photo using the uploaded image of a [coffee cup]... Output only a valid JSON object.\nThen paste the output into Nano Banana with your photo.\nThen paste the second prompt into Google Veo with the Nano Banana image: {"purpose": "Animate a Surreal Gravity/Motion reveal...", "camera": {...}, "staging": {"timeline": [...]}, ...} (a long JSON block)' },
      vault: {
        title: 'From a phone snap of your product to an eight-second ad clip',
        description: 'Three prompts in a row: tidy the photo into an advert-grade still, then make it float and land. No JSON, no studio.',
        whatYouGet: 'One clean product still and one short clip of it in motion, made from a photo you took on your phone.',
        fillIn: ['A photo of the product on any background, in focus', 'What the product is, in a few words', 'A colour that goes with the product'],
        steps: [
          { title: 'The clean still', brief: 'Use the attached photo of [what the product is]. Keep the product exactly as it is, including its label and logo, and clean any dust or marks off it. Put it in an outdoor setting that suits it, [e.g. a wooden table in morning sun / wet slate after rain], with soft, even advertising light and a shallow depth of field so the background is gently out of focus. Product in the centre with space around it, 16:9. Nothing added: no text, no extra logos, no props that spell out what the product is for.' },
          { title: 'The clip', brief: 'Animate the attached image. The [product] floats weightless for the first two seconds, turning very slightly. Fine particles in [your colour] drift around it, never covering the label. The camera pushes in slowly. At six seconds gravity returns: the product settles upright onto a soft reflective surface with a small bounce and a ripple spreading out. Hold the last second perfectly still and sharp. Eight seconds, 24 frames a second, no text, no sound.' },
          { title: 'The alternative ending', brief: 'Same clip as before, but instead of landing, the [product] slowly turns a full circle while the background brightens from [your colour] to white. End on the label facing the camera. Eight seconds, no text.' }
        ],
        thenAskFor: ['Keep the clip but slow the whole thing down by half.', 'Same still, but on a plain white background for the shop page.', 'Make a 9:16 version of the clip for Reels, with the product lower in frame.'],
        worksBestIn: 'Nano Banana for the still, then Veo or Kling for the clip. Hailuo works for the clip if you want it cheaper.',
        tags: ['product video', 'ad clip', 'veo', 'nano banana']
      }
    }
  ]
};

/* A collection's own entry: the rows carry the prompts, so this only writes
   the frame around them. One example is enough to show the shape. */
const COLLECTION_EXAMPLE = {
  original: { title: 'Lighting Styles & Moods', text: 'Explore every lighting technique from Rembrandt and butterfly setups to neon gels, candlelight, and golden hour. (48 prompts with an image each, e.g. "A portrait lit by a single candle held just below the chin, warm orange light climbing the face and falling off into black, 85mm, f/1.8, deep shadow, intimate.")' },
  vault: {
    title: 'Forty-eight ways to light a face',
    description: 'One prompt per lighting setup, from a single candle to a wall of neon, each naming the light, the lens and the mood so you can borrow it for your own subject.',
    whatYouGet: 'A reference set of lighting prompts with a picture of each, to copy as they are or to lift the lighting line out of and put in front of your own subject.',
    fillIn: [],
    thenAskFor: ['Same lighting, but the subject is [your product or your own photo, attached].', 'Keep the light and change the lens to a wide 24mm, so more of the room shows.', 'Make it 9:16 and move the light source to the left.'],
    worksBestIn: 'Midjourney or Flux for from-scratch; Nano Banana when you attach your own photo.',
    tags: ['lighting', 'portraits', 'reference', 'photography']
  }
};

/** The words of a stored prompt, markup gone. */
export function promptText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/‍/g, '')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const isCollection = (row) => row.kind === 'image_prompt' && row.meta?.contentMode === 'image_gallery';

/** The original as the model should see it: title, description, every step. */
export function originalOf(row, gallery = []) {
  const items = Array.isArray(row.meta?.promptItems) && row.meta.promptItems.length
    ? row.meta.promptItems
    : [{ title: 'Prompt', content: row.body_html }];
  const parts = items.map((it) => {
    const text = promptText(it.content);
    return items.length > 1 ? `[${promptText(it.title) || 'Step'}]\n${text}` : text;
  });
  const intro = row.kind === 'image_prompt' && items.length > 1 && row.body_html ? promptText(row.body_html) + '\n\n' : '';
  const sample = gallery.length
    ? `(${gallery.length} prompts with an image each; five of them:)\n` + gallery.slice(0, 5).map((g) => `- ${g.prompt}`).join('\n')
    : '';
  return {
    title: String(row.title || '').trim(),
    description: promptText(row.description),
    category: String(row.category || '').trim(),
    steps: items.length,
    text: (sample || (intro + parts.join('\n\n'))).slice(0, 9000)
  };
}

const VOICE = {
  prompt: `- Written as the reader speaking to the model: "I run...", "Give me...", "Ask me...".
- No personas: never "You are a world-class expert with 15 years of experience". The model does not
  need telling who to be; it needs telling what to do, in what order, and what to leave out.
- Say what to leave out. The old prompts ask for everything; ours ask for the few things that matter
  and name what we don't want ("no competitor audits", "don't give me launch plans").
- Make it a working session where that helps: ask questions first, wait, then deliver in passes.
- Be honest about what a model can't do (live search volumes, your numbers) and plan around it.
- Sized for one person: hours a week, words a week, what they can actually make.
- The brief runs 80 to 400 words; each step 30 to 250 words.`,
  image_prompt: `- Written as instructions to an image or video generator: what is in the picture, where, in what
  light, through what lens, in what colours, at what aspect ratio. Concrete nouns, no adjectives
  that don't change the picture ("stunning", "beautiful", "professional-looking").
- Where the reader attaches their own photo or screenshot, say what must stay exactly as it is
  (the product, the label, the interface) and what may change.
- Say what to leave out of the picture: no added text, no stock icons, no extra logos, no props
  that spell out the category.
- Each prompt is complete on its own and pasteable as it stands, 40 to 180 words. An entry with
  several variants uses steps, one per variant, each with a two-to-five-word title; an entry that
  is a sequence (still first, then clip) uses steps in order.
- No JSON, no parameter soup. Plain sentences a generator reads well and a person can edit.
- Name the generator it suits in worksBestIn (Nano Banana, Midjourney, Flux, Veo, Kling...) and say
  in one phrase why, if it matters (keeps a real photo intact; redraws from scratch).`
};

function prompt(row, { problems = [], gallery = [] } = {}) {
  const kind = row.kind === 'image_prompt' ? 'image_prompt' : 'prompt';
  const collection = isCollection(row);
  const o = originalOf(row, collection ? gallery : []);
  const examples = (collection ? [COLLECTION_EXAMPLE] : EXAMPLES[kind])
    .map((e, i) => `## Example ${i + 1}\nOld title: ${e.original.title}\nOld prompt (abridged): ${e.original.text}\n\nRebuilt:\n${JSON.stringify(e.vault, null, 1)}`).join('\n\n');
  const vaultName = kind === 'prompt' ? 'AI Prompt Vault' : 'AI Visual Vault';
  const what = kind === 'prompt' ? 'a prompt for Claude or ChatGPT' : 'a set of prompts for image and video generators';

  return `You write the ${vaultName} for AI Founder University, a campus for founders who want AI doing
real work in their business. Below is ${what} from an older library. Rebuild it from scratch in the
house format so that it does the same job, better, and reads as ours.

# The house format
- title: names the result the reader gets. Starts with a verb or a concrete noun phrase. Not the old title.
- description: one sentence, under 160 characters: what it's for and what's different about it.
- whatYouGet: one sentence, what the reader has at the end.
- fillIn: what the reader fills in or has ready before pasting, up to five short phrases.
- brief: the prompt itself. Or steps: several prompts, run in order or as named variants. Never both.
- thenAskFor: exactly three follow-up messages, written as the reader would type them.
- worksBestIn: which model or generator suits it, with at most one short reason.
- tags: three to five, lower case.
${collection ? `
# This entry is a collection
It is a set of ${gallery.length} finished prompts, each with a picture, that are rebuilt separately. Write only
the frame: title, description, whatYouGet, an empty fillIn, no brief and no steps, three follow-ups that
apply to any prompt in the set, worksBestIn and tags. Describe what the set is for and how to use it.
` : ''}
# The voice
- Plain English, British spelling (organise, programme, colour). Contractions are fine.
${VOICE[kind]}
- Blanks in [square brackets, with a hint inside of what goes there], not [SHOUTED_PLACEHOLDERS].
- No hype: unlock, leverage, delve, elevate, harness, supercharge, game-changer, cutting-edge,
  world-class, legendary, comprehensive, robust, seamless, skyrocket, 10x. No exclamation marks.
- No markdown headings or bold inside the prompt. Numbered or dashed lines are fine.

# Not a paraphrase
Keep the job of the old prompt. Change the approach where the old one is weak: fewer deliverables,
a sharper order, a thing to leave out, a different setting or structure. If the old prompt depends on
something it doesn't contain (a sheet, a list, a video), write that content in. If it has junk in it
(stylesheet text, code, another prompt's ending), ignore it. If it has ten near-identical variants,
keep the five or six that are genuinely different. Someone who knows the old prompt should recognise
the job and nothing else.

${examples}

# The prompt to rebuild
Category: ${o.category}
Old title: ${o.title}
Old description: ${o.description}
Old prompt${o.steps > 1 ? ` (${o.steps} parts)` : ''}:
"""
${o.text}
"""
${problems.length ? `
# Your last attempt was rejected for these reasons. Fix every one of them.
- ${problems.join('\n- ')}
` : ''}
Call the vault_prompt tool with the rebuilt prompt. Do not write anything else.`;
}

const HYPE = /\b(unlock|leverag\w*|delv\w*|elevat\w*|harness\w*|supercharg\w*|game.chang\w*|cutting.edge|world.class|legendary|comprehensive|robust|seamless\w*|skyrocket\w*|10x)\b/i;
/* The spellings that come out of a model by default. A short list of the ones
   that actually turn up in prompts like these, not every -ize in the language:
   "size" and "prize" are not American. */
const AMERICAN = /\b((organ|optim|priorit|monet|custom|real|recogn|summar|categor|visual|personal|maxim|minim|util|final|emphas|special|strateg|apolog|critic|familiar|memor|standard|capital)iz(e|es|ed|ing|ation|ations)|analyz\w*|colors?|behaviors?|favorite|catalog|center)\b/;
const PERSONA = /^\s*(you are|act as|you're an?|assume the role)/i;
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/* How long a prompt may run, by kind: a working brief for a language model
   is a page; an instruction to an image generator is a paragraph. */
const LIMITS = {
  prompt: { brief: [80, 420], step: [25, 260], steps: [2, 5] },
  image_prompt: { brief: [30, 320], step: [15, 230], steps: [2, 8] }
};

/** What is wrong with a rebuild, as lines the model can be told. Empty when nothing is. */
export function check(data, row) {
  const p = [];
  const d = data || {};
  const kind = row.kind === 'image_prompt' ? 'image_prompt' : 'prompt';
  const lim = LIMITS[kind];
  const collection = isCollection(row);
  const title = String(d.title || '').trim();
  const oldTitle = String(row.title || '').trim().toLowerCase();
  if (title.length < 12 || title.length > 80) p.push('title must be 12 to 80 characters');
  if (title.toLowerCase() === oldTitle) p.push('title must not be the old title');
  const desc = String(d.description || '').trim();
  if (desc.length < 40 || desc.length > 180) p.push('description must be 40 to 180 characters');
  if (!String(d.whatYouGet || '').trim()) p.push('whatYouGet is empty');
  if (!Array.isArray(d.fillIn) || d.fillIn.length > 5 || (!collection && d.fillIn.length < 1)) p.push('fillIn must have one to five items');
  const steps = Array.isArray(d.steps) ? d.steps.filter((s) => s && String(s.brief || '').trim()) : [];
  const brief = String(d.brief || '').trim();
  if (brief && steps.length) p.push('use brief or steps, not both');
  if (collection) {
    if (brief || steps.length) p.push('a collection entry has no brief and no steps; the prompts are rebuilt separately');
  } else {
    if (!brief && !steps.length) p.push('brief is empty and there are no steps');
    if (brief) {
      const n = words(brief);
      if (n < lim.brief[0] || n > lim.brief[1]) p.push(`brief is ${n} words; it must be ${lim.brief[0]} to ${lim.brief[1] - 20}`);
      if (PERSONA.test(brief)) p.push('brief opens with a persona ("You are..."); open with what the reader wants instead');
      if (!/\[[^\]]+\]/.test(brief)) p.push('brief has no [blanks] for the reader to fill');
    }
    if (steps.length) {
      if (steps.length < lim.steps[0] || steps.length > lim.steps[1]) p.push(`steps must be ${lim.steps[0]} to ${lim.steps[1]}`);
      steps.forEach((s, i) => {
        const n = words(s.brief);
        if (n < lim.step[0] || n > lim.step[1]) p.push(`step ${i + 1} is ${n} words; each step must be ${lim.step[0] + 5} to ${lim.step[1] - 10}`);
        if (PERSONA.test(s.brief)) p.push(`step ${i + 1} opens with a persona`);
        if (!String(s.title || '').trim()) p.push(`step ${i + 1} has no title`);
      });
      if (!steps.some((s) => /\[[^\]]+\]/.test(s.brief))) p.push('no step has a [blank] for the reader to fill');
    }
  }
  if (!Array.isArray(d.thenAskFor) || d.thenAskFor.length !== 3) p.push('thenAskFor must have exactly three items');
  if (!Array.isArray(d.tags) || d.tags.length < 3 || d.tags.length > 5) p.push('tags must have three to five items');
  if (!String(d.worksBestIn || '').trim()) p.push('worksBestIn is empty');

  const everything = [title, desc, d.whatYouGet, brief, ...steps.map((s) => s.brief), ...(Array.isArray(d.thenAskFor) ? d.thenAskFor : [])].join('\n');
  const hype = everything.match(HYPE);
  if (hype) p.push(`hype word used: "${hype[0]}"`);
  const us = everything.match(AMERICAN);
  if (us) p.push(`American spelling: "${us[0]}" (use British spelling)`);
  if (/!/.test(everything)) p.push('an exclamation mark was used');
  if (/^#{1,6}\s|\*\*/m.test(everything)) p.push('markdown headings or bold were used inside the prompt');
  if (kind === 'image_prompt' && /^\s*[{[]/m.test(everything)) p.push('JSON was used; write plain sentences');
  return p;
}

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** The rebuild, cut to the shape the member area will render. */
function shape(d, collection) {
  const steps = Array.isArray(d.steps) ? d.steps.filter((s) => s && String(s.brief || '').trim()) : [];
  const out = {
    title: clip(d.title, 80),
    description: clip(d.description, 200),
    whatYouGet: clip(d.whatYouGet, 300),
    fillIn: (Array.isArray(d.fillIn) ? d.fillIn : []).map((s) => clip(s, 120)).filter(Boolean).slice(0, 5),
    thenAskFor: (Array.isArray(d.thenAskFor) ? d.thenAskFor : []).map((s) => clip(s, 240)).filter(Boolean).slice(0, 3),
    worksBestIn: clip(d.worksBestIn, 160),
    tags: (Array.isArray(d.tags) ? d.tags : []).map((s) => clip(s, 30).toLowerCase()).filter(Boolean).slice(0, 5)
  };
  if (collection) out.collection = true;
  else if (steps.length) out.steps = steps.slice(0, 8).map((s) => ({ title: clip(s.title, 60), brief: clip(s.brief, 4000) }));
  else out.brief = clip(d.brief, 4000);
  return out;
}

/**
 * One prompt, rebuilt. Asks once, checks, and on a failed check asks once more
 * with the reasons. A second failure is still saved - with its problems
 * alongside, so a person can find it - because a rebuild that is two words
 * over a limit is better kept and read than thrown away and paid for again.
 *
 * `gallery` is the collection's rows, for an entry that is one.
 */
export async function rebuildPrompt(row, { meter = null, model = VAULT_MODEL, gallery = [] } = {}) {
  let { data } = await callTool(prompt(row, { gallery }), TOOL, { maxTokens: 8000, meter, model });
  if (!data) throw new Error('the model returned nothing');
  let problems = check(data, row);
  if (problems.length) {
    const again = await callTool(prompt(row, { problems, gallery }), TOOL, { maxTokens: 8000, meter, model });
    if (again.data) {
      const p2 = check(again.data, row);
      if (p2.length <= problems.length) { data = again.data; problems = p2; }
    }
  }
  return { vault: shape(data, isCollection(row)), problems };
}
