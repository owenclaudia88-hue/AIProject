import { callTool } from './claude.js';
import { VAULT_MODEL } from './vault.js';

/**
 * The Visual Vault's collections: a set of finished prompts, each with a
 * picture made from it (library_gallery). Every row's prompt is rewritten
 * here, in our words and with its own specifics, and the picture is then
 * made again from the new prompt (see api/cron/visual-images.js), so that
 * neither the words nor the pictures are the old library's.
 *
 * The rewrite goes in the row's `vault` column as a draft; `prompt` and
 * `asset_key` stay as they are until publishing.
 */

const TOOL = {
  name: 'gallery_prompt',
  description: 'Deliver the rewritten image prompt. Always answer by calling this.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The prompt, 40 to 100 words, plain sentences.' }
    },
    required: ['prompt']
  }
};

const HYPE = /\b(stunning|breathtaking|masterpiece|award.winning|ultra.realistic|hyper.realistic|8k|4k|trending on|highly detailed|unlock|elevat\w*)\b/i;
const AMERICAN = /\b(colors?|gray|center|centered|jewelry|theater|catalog|harbor|armor|vapor|favorite|organiz\w*|stylized|realiz\w*)\b/;
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/** What is wrong with a rewrite, as lines the model can be told. Empty when nothing is. */
export function checkGalleryPrompt(text, old) {
  const p = [];
  const t = String(text || '').trim();
  const n = words(t);
  if (n < 40 || n > 110) p.push(`the prompt is ${n} words; it must be 40 to 100`);
  if (t.toLowerCase() === String(old || '').trim().toLowerCase()) p.push('the prompt is the old prompt unchanged');
  const hype = t.match(HYPE);
  if (hype) p.push(`filler used: "${hype[0]}"`);
  const us = t.match(AMERICAN);
  if (us) p.push(`American spelling: "${us[0]}" (use British spelling)`);
  if (/!/.test(t)) p.push('an exclamation mark was used');
  if (/^\s*[{[]/.test(t) || /--\w+/.test(t)) p.push('JSON or parameter flags were used; write plain sentences');
  // The old prompt's own distinctive phrases should not survive. Four words in
  // a row shared with it is the sign of a paraphrase rather than a rewrite.
  const oldWords = String(old || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const newText = ' ' + t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (let i = 0; i + 4 <= oldWords.length; i++) {
    const run = ' ' + oldWords.slice(i, i + 4).join(' ') + ' ';
    if (/\b(the|a|an|of|and|in|on|with|to)\b/.test(run.trim().split(' ')[0]) && run.trim().split(' ').every((w) => w.length <= 3)) continue;
    if (newText.includes(run)) { p.push(`a phrase is copied from the old prompt: "${run.trim()}"`); break; }
  }
  return p;
}

function prompt(row, collection, problems = []) {
  return `You write the AI Visual Vault for AI Founder University. Below is one prompt from a collection of
image prompts that came from an older library. Write a new prompt for the same place in the set: the
same kind of picture, in the collection's style, but your own picture, in your own words.

# The collection
Title: ${collection.title}
What it is: ${collection.description}

# The old prompt
"""
${row.prompt}
"""

# How to write ours
- Open with the collection's defining technique or look, stated as bluntly as its title states it,
  in the first sentence: "Double exposure portrait: a woman's silhouette filled with a birch forest",
  "1-bit dithered black and white print of...", "Y2K liquid chrome sculpture of...". Generators draw
  what the first sentence says; an effect mentioned softly later ("merging with", "blending into")
  comes back as an ordinary photo.
- A different picture that belongs in the same collection: change the subject, the setting, the
  moment or the composition, keep the style the collection is about.
- Then concrete, in this order where it applies: what is in the picture and what it is doing; where;
  the light; the camera (lens, distance, angle); the colours; the finish or mood in a few words.
- 40 to 100 words, plain sentences, British spelling (colour, grey, centre). No lists, no JSON, no
  parameter flags, no "8k", "masterpiece", "highly detailed", "stunning".
- No text in the picture, no logos, no brand names, no real people's names.
- Do not reuse the old prompt's phrases. Someone who knows it should recognise the collection,
  not the prompt.
${problems.length ? `
# Your last attempt was rejected for these reasons. Fix every one of them.
- ${problems.join('\n- ')}
` : ''}
Call the gallery_prompt tool with the new prompt. Do not write anything else.`;
}

/**
 * One row, rewritten. Asks once, checks, and on a failed check asks once more
 * with the reasons; a second failure is kept with its problems alongside.
 */
export async function rewriteGalleryPrompt(row, collection, { meter = null, model = VAULT_MODEL } = {}) {
  let { data } = await callTool(prompt(row, collection), TOOL, { maxTokens: 1500, meter, model });
  if (!data?.prompt) throw new Error('the model returned nothing');
  let text = String(data.prompt).trim();
  let problems = checkGalleryPrompt(text, row.prompt);
  if (problems.length) {
    const again = await callTool(prompt(row, collection, problems), TOOL, { maxTokens: 1500, meter, model });
    if (again.data?.prompt) {
      const t2 = String(again.data.prompt).trim();
      const p2 = checkGalleryPrompt(t2, row.prompt);
      if (p2.length <= problems.length) { text = t2; problems = p2; }
    }
  }
  return { prompt: text.slice(0, 1200), problems };
}

/** The aspect ratio a prompt asks for, or square. */
export function aspectOf(text) {
  const m = String(text || '').match(/\b(16:9|9:16|4:5|5:4|3:2|2:3|4:3|3:4|1:1|21:9)\b/);
  if (m) return m[1];
  if (/\b(portrait|vertical|full.length|head and shoulders)\b/i.test(text)) return '4:5';
  if (/\b(landscape|wide shot|panorama|horizon|cinematic)\b/i.test(text)) return '16:9';
  return '1:1';
}
