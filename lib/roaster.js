import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { callTool } from './claude.js';
import { SCORES } from './promise.js';

/**
 * The Offer Roaster: a sales page in, a verdict out - a score out of 100, the
 * three fixes worth the most money with lines to paste, a new top of the page,
 * and the page checked part by part.
 *
 * Two ways in: a link, which the server fetches and reduces to its words, or
 * the copy pasted in (for a page behind a login, or one still in a doc).
 * Either way the roaster only ever sees text, and says so where it matters:
 * it cannot judge a design or a video it was never shown.
 */

export const SECTIONS = [
  'Qualifier Bar', 'Headline + Subheadline', 'Proof Badges', 'Lead', 'Mechanism', 'The Math',
  'Old Way vs New Way', 'Hero Proof', "What's Included", 'Guarantee', 'Bonuses', 'Proof Block', 'The Close'
];

/* ---------- reading a page ---------- */

/* Addresses a link must never reach: this machine, the private network, the
   cloud's own metadata service. Without this, "roast my page" is a way to make
   our server fetch things only it can see. */
function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
    || v.startsWith('::ffff:') && privateAddress(v.slice(7));
}

async function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error('That does not look like a link. Check it, or paste the copy instead.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only web links (http or https) can be read.');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('That link cannot be read. Paste the copy instead.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error('That link cannot be read. Paste the copy instead.');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error('That site could not be found. Check the link.');
  if (addrs.some((a) => privateAddress(a.address))) throw new Error('That link cannot be read. Paste the copy instead.');
  return u;
}

/** The words on a page: scripts, styles and markup gone, blocks on their own lines. */
export function pageText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/section|\/tr|\/blockquote|\/header|\/footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function readPage(raw) {
  let u = await safeUrl(raw);
  // Redirects followed by hand, each one checked again: a public link that
  // redirects somewhere private is the oldest way round a check like this.
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(u, {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AIFounderUniversityOfferRoaster/1.0)', accept: 'text/html' }
    }).catch(() => { throw new Error('That page did not answer. Check the link, or paste the copy instead.'); });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      u = await safeUrl(new URL(res.headers.get('location'), u).href);
      continue;
    }
    if (!res.ok) throw new Error(`That page answered with an error (${res.status}). Paste the copy instead.`);
    if (!/html|text/i.test(res.headers.get('content-type') || '')) throw new Error('That link is not a web page. Paste the copy instead.');
    const body = (await res.text()).slice(0, 3_000_000);
    const text = pageText(body);
    if (text.length < 300) throw new Error('There was not enough text on that page to roast. If it is behind a login or built in a page builder that loads late, paste the copy instead.');
    return { text: text.slice(0, 40000), host: u.hostname.replace(/^www\./, '') };
  }
  throw new Error('That link redirects too many times. Paste the copy instead.');
}

/* ---------- the roast ---------- */

const str = (d) => ({ type: 'string', description: d });
const TOP = {
  type: 'object',
  properties: { bar: str('The line above the headline.'), headline: str('The headline.'), sub: str('The line under it.') },
  required: ['headline']
};

const TOOL = {
  name: 'roast',
  description: 'Deliver the finished roast. Always answer by calling this.',
  input_schema: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100, description: 'How ready the page is for paid traffic, 0-100.' },
      verdict: str('Three to five words, in capitals, naming the state of the page, e.g. "LEAKING SALES IN PLAIN SIGHT" or "READY FOR TRAFFIC".'),
      diagnosis: str('One sentence: the single biggest thing costing this page sales.'),
      jab: str('One short, sharp line a friend would say about the page. Honest, not cruel.'),
      offer: str('The offer as the page presents it, in two or three plain sentences: what it is, who for, the price, anything the buyer also needs.'),
      fixes: {
        type: 'array', description: 'Exactly three fixes, the one worth the most money first.',
        items: {
          type: 'object',
          properties: {
            title: str('The fix in a few words, imperative.'),
            section: { type: 'string', enum: SECTIONS },
            now: str('What the page says now, quoted exactly from the page.'),
            why: str('One or two sentences: why this costs sales.'),
            paste: str('The replacement, ready to paste. Placeholders in [CAPITALS] for anything only the owner knows.')
          },
          required: ['title', 'section', 'why', 'paste']
        }
      },
      top: {
        type: 'object',
        properties: {
          now: TOP, better: TOP,
          scores: { type: 'object', properties: Object.fromEntries(SCORES.map(([k, , d]) => [k, { type: 'integer', minimum: 1, maximum: 5, description: d }])) },
          warning: str('One line if the new headline still has a weakness the owner should know, otherwise empty.'),
          why: str('One or two sentences on why the new top is better.')
        },
        required: ['now', 'better', 'scores', 'why']
      },
      sections: {
        type: 'array', description: 'All thirteen parts of a page that sells, in this order, each marked.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: SECTIONS },
            status: { type: 'string', enum: ['strong', 'weak', 'missing'] },
            note: str('Under 15 words: what is there or what is missing.')
          },
          required: ['name', 'status', 'note']
        }
      },
      more: { type: 'array', items: { type: 'string' }, description: 'Up to ten more specific lines worth fixing, one sentence each.' },
      caveat: str('What could not be judged from the text alone (design, video, screenshots), if anything.')
    },
    required: ['score', 'verdict', 'diagnosis', 'offer', 'fixes', 'top', 'sections']
  }
};

function prompt(text) {
  return `You are a direct-response copywriter roasting a small business's sales page, the way a sharp
friend who has written hundreds of them would: honest, specific, and useful. The goal is more sales,
not a nicer page.

# The page (its text only: no design, images or video came through)
"""
${text}
"""

# How to roast it
1. Score it 0-100 for how ready it is to take paid traffic. 90+ is rare. Most pages land 40-75.
2. Find the three fixes worth the most money, most valuable first. For each: quote exactly what the page
   says now, say in plain words why it costs sales, and write the replacement ready to paste.
3. Rewrite the top of the page (the line above the headline, the headline, the line under it) and score
   the new version 1-5 on: ${SCORES.map(([, l, d]) => `${l} (${d})`).join('; ')}.
4. Mark all thirteen parts of a page that sells as strong, weak or missing, with a short note each:
   ${SECTIONS.join(', ')}.
5. List up to ten more specific lines worth fixing.
6. Say what you could not judge from text alone.

# Rules
- Quote the page exactly when you say what it says now. Never put words in its mouth.
- Never invent proof: no made-up testimonials, results, names or numbers. Where proof belongs and the page
  has none, write a placeholder in [CAPITALS] for the owner to fill in, and say where to get it.
- Use the page's own facts: its price, its numbers, its guarantee.
- Plain words. No hype: unlock, transform, supercharge, game-changer, skyrocket, secret. No exclamation marks.

Call the roast tool with the finished roast. Do not write anything else.`;
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const top = (t) => ({ bar: clip(t?.bar, 200), headline: clip(t?.headline, 240), sub: clip(t?.sub, 400) });

export async function roast(text) {
  const { data } = await callTool(prompt(text), TOOL, { maxTokens: 12000 });
  if (!data) throw new Error('the model returned nothing');
  const scores = {};
  for (const [k] of SCORES) scores[k] = Math.min(5, Math.max(1, Math.round(Number(data.top?.scores?.[k]) || 1)));
  const byName = new Map((Array.isArray(data.sections) ? data.sections : []).map((s) => [s?.name, s]));
  const result = {
    score: Math.min(100, Math.max(0, Math.round(Number(data.score) || 0))),
    verdict: clip(data.verdict, 60).toUpperCase(),
    diagnosis: clip(data.diagnosis, 400),
    jab: clip(data.jab, 240),
    offer: clip(data.offer, 600),
    fixes: (Array.isArray(data.fixes) ? data.fixes : []).slice(0, 3).map((f) => ({
      title: clip(f?.title, 120), section: SECTIONS.includes(f?.section) ? f.section : '',
      now: clip(f?.now, 600), why: clip(f?.why, 500), paste: clip(f?.paste, 1500)
    })).filter((f) => f.title && f.paste),
    top: { now: top(data.top?.now), better: top(data.top?.better), scores, warning: clip(data.top?.warning, 240), why: clip(data.top?.why, 500) },
    // Always the thirteen, in order: a part the model skipped is shown as not judged rather than vanishing.
    sections: SECTIONS.map((name) => {
      const s = byName.get(name);
      return { name, status: ['strong', 'weak', 'missing'].includes(s?.status) ? s.status : 'weak', note: clip(s?.note, 160) || 'Not judged.' };
    }),
    more: (Array.isArray(data.more) ? data.more : []).map((m) => clip(m, 300)).filter(Boolean).slice(0, 10),
    caveat: clip(data.caveat, 500)
  };
  if (!result.fixes.length) throw new Error('the model returned no fixes');
  return result;
}
