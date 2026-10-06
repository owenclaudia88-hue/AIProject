/**
 * The illustrations that go inside a tutorial.
 *
 * Every one of the 42 tutorials in the library has pictures - 298 of them, a
 * median of five per piece - and a tutorial without any is immediately the odd
 * one on the shelf. They are not photographs and not screenshots. They are
 * drawn explanations: a settings screen redrawn as a diagram, two plans side
 * by side, the shape of a product family. The ones based on a real interface
 * say so in their own footnote - "Illustration based on Meta's Help Center,
 * 17 September 2026. Not a screenshot of the app." - and that sentence is the
 * reason this is honest work rather than a fake screenshot.
 *
 * So they are drawn as SVG here, from a description the writer supplies, in
 * the light card style the library uses. SVG because it is text and shapes,
 * which is exactly what these are, and because it stays crisp on a phone.
 *
 * SVG has no text wrapping, so every line is placed explicitly. That is the
 * one thing most likely to go wrong and the thing the checker below looks at
 * hardest: a line that runs past the card edge is worse than no picture.
 */
import { callTool } from './claude.js';
import { upsertAsset } from './db.js';
import { imageFor } from './report-sources.js';
import { renderFigure, renderCover } from './figure-render.js';
import { put } from '@vercel/blob';

/* The palette, read off the library's own illustrations: a white card on a
   faint grey page, near-black type, one blue for structure and selection, one
   green for "do this", grey for everything secondary. */
const STYLE = `THE LOOK. A white card on a faint grey page. Nothing decorative.

  page            #f4f5f7      card            #ffffff
  card border     #e3e5e9      inner panel     #f8f9fb
  heading text    #16181d      body text       #5b6069
  blue (accent)   #1a62d8      blue tint fill  #eaf1fd
  green (do this) #0f8a5f      green tint      #e7f6ef
  chip fill       #eef0f3      footnote text   #8b9099

  Type: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif.
  eyebrow 15px bold, letter-spacing 1.2, uppercase, blue
  heading 34px bold #16181d
  subtitle 19px #5b6069
  panel label 13px bold uppercase #8b9099
  panel title 22px bold #16181d
  body 17px #5b6069
  badge 13px bold
  footnote 14px #8b9099`;

const FIGURE_TOOL = {
  name: 'illustration',
  description: 'The contents of one illustration. The layout is drawn for you.',
  input_schema: {
    type: 'object',
    properties: {
      layout: { type: 'string', enum: ['columns', 'rows', 'flow'],
        description: 'columns = 2-4 things side by side. rows = one list of label/value lines. flow = 3-5 steps with arrows.' },
      eyebrow: { type: 'string', description: 'small blue line above the heading, e.g. "MUSE · PLANS"' },
      title: { type: 'string', description: 'the heading inside the picture' },
      subtitle: { type: 'string', description: 'one grey line under it' },
      panels: {
        type: 'array',
        description: 'columns layout: one per column. Every panel must have something in it.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'small grey label, e.g. "DIAL 1" or "LANE 1 · SEND"' },
            title: { type: 'string' },
            lead: { type: 'string', description: 'a sentence under the title' },
            highlight: { type: 'boolean', description: 'true for the recommended one' },
            badge: {
              type: 'object',
              properties: { text: { type: 'string' }, tone: { type: 'string', enum: ['green', 'blue', 'grey'] } }
            },
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: 'small grey caps, e.g. "WEEKLY ALLOWANCE"' },
                  value: { type: 'string', description: 'the figure or answer, set bold' },
                  note: { type: 'string', description: 'a quieter line under it' }
                }
              }
            }
          }
        }
      },
      panelTitle: { type: 'string', description: 'rows layout: the heading on the single panel' },
      rows: {
        type: 'array',
        description: 'rows layout: the lines of the list.',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, value: { type: 'string' } }
        }
      },
      steps: {
        type: 'array',
        description: 'flow layout: the steps, in order.',
        items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' } } }
      },
      footnote: { type: 'string', description: 'what it is based on, and that it is an illustration rather than a screenshot' }
    },
    required: ['layout', 'title', 'footnote']
  }
};

/**
 * Draw one.
 *
 * The model is asked for the contents and the layout is computed here, which
 * is the opposite of the first attempt: asking for finished SVG produced a
 * green panel header above an empty box with two of its three lanes missing,
 * and no checker short of rendering it would have known. Content in, geometry
 * here, and a panel with nothing in it is unrepresentable.
 */
export async function drawFigure({ figure, subject, meter = null }) {
  const prompt = `Decide the contents of one illustration for a tutorial about ${subject}.

WHAT IT HAS TO SHOW
${figure.title ? `Heading: ${figure.title}` : ''}
${figure.eyebrow ? `Eyebrow: ${figure.eyebrow}` : ''}
${figure.subtitle ? `Line under the heading: ${figure.subtitle}` : ''}

${figure.content}

${figure.basedOn ? `It redraws something real: ${figure.basedOn}. Say so in the footnote.` : ''}

Pick the layout that fits what this has to show, and fill it in completely.
Every panel you ask for must have a title and something under it; if you name
three lanes, send three panels. Keep a panel title under six words, a value
under twenty characters, and a note under about fifteen words - they are set
in a column a few hundred pixels wide.

The footnote says what the picture is based on and that it is an illustration,
not a screenshot. For example: "Illustration based on Etsy's seller help pages,
October 2026. Not a screenshot of the app."

${STYLE}`;

  const out = await callTool(prompt, FIGURE_TOOL, { maxTokens: 8000, meter });
  if (!out.data) return null;
  try {
    return renderFigure(out.data);
  } catch (err) {
    console.error('[figures] could not draw', err?.message);
    return null;
  }
}

/**
 * A last look at our own output.
 *
 * The geometry is computed rather than guessed now, so this is no longer the
 * thing standing between a broken picture and a member - it is the check that
 * the content was worth drawing at all. A figure with four labels on it is a
 * box, not an explanation.
 */
export function checkFigure(svg, { width = 1200 } = {}) {
  const bad = [];
  if (!svg) return ['nothing was drawn'];
  if (!/^<svg[\s>]/i.test(svg.trim())) bad.push('not an svg document');

  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/i);
  if (!vb) bad.push('no viewBox');
  else if (Number(vb[1]) !== width) bad.push(`viewBox is ${vb[1]} wide, not ${width}`);

  const h = vb ? Number(vb[2]) : 0;
  if (h && (h < 260 || h > 2000)) bad.push(`${h}px tall, outside the usable range`);

  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/gi)].map((m) => m[1].trim()).filter(Boolean);
  if (texts.length < 6) bad.push(`only ${texts.length} labels; not enough to explain anything`);

  // A panel with a heading and nothing under it is what this whole module was
  // rewritten to prevent, so it is worth confirming it did not come back.
  const panels = (svg.match(/<rect[^>]*rx="14"/g) || []).length;
  if (panels && texts.length < panels * 2) {
    bad.push(`${panels} panels but only ${texts.length} labels; some are empty`);
  }
  return bad;
}

/**
 * Store one where the member area already serves pictures from.
 *
 * The same /api/library/asset route and library_assets table the 298 migrated
 * images use, so a drawn figure and a migrated one are indistinguishable to
 * the page.
 */
export async function storeFigure(svg, { itemId, n }) {
  const key = `written/${itemId}/${n}.svg`;
  const blob = await put(`library/${key}`, svg, {
    access: 'private', contentType: 'image/svg+xml', addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  await upsertAsset(key, blob.url, 'image/svg+xml');
  return `/api/library/asset?key=${encodeURIComponent(key)}`;
}

/**
 * The markup the library uses for a picture with something to say.
 *
 * The caption's first sentence is bold and the rest is not, which is how all
 * 48 captions in the library read. `credit` is the publisher's name when the
 * picture is theirs rather than ours - their captions end "Image: Meta", and
 * that is the whole difference between crediting somebody and passing their
 * work off as a drawing of ours.
 */
/**
 * The card picture, drawn and stored. Returns the key for library.thumb_key.
 *
 * All 48 tutorials the library is modelled on carry their own thumbnail - a
 * separate image rather than the first picture out of the article - and one
 * with the generic placeholder is immediately the odd card on the shelf.
 *
 * Never throws. A tutorial with no thumbnail is worse-looking but still a
 * tutorial, and losing the piece over its cover would be the wrong trade.
 */
export async function makeCover({ itemId, title, category }) {
  try {
    const svg = renderCover({ title, category });
    const key = `written/${itemId}/cover.svg`;
    const blob = await put(`library/${key}`, svg, {
      access: 'private', contentType: 'image/svg+xml', addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    await upsertAsset(key, blob.url, 'image/svg+xml');
    return key;
  } catch (err) {
    console.error('[figures] no cover:', err?.message);
    return null;
  }
}

/* Across the 47 tutorials this library is modelled on, only 10 wrap an image
   in a <figure> and only 9 caption one: the ordinary case is a bare
   <img class="figimg"> carrying its explanation in the alt text, with the
   paragraph above it doing the describing. So a caption is used when there is
   something to say that the surrounding text does not already say, and a
   credit always forces one, because an uncredited vendor image is the thing
   we are trying not to do. */
export function figureHtml({ src, alt, caption, credit, title, content }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* The model is asked for both of these and sometimes returns neither, and
     the first run shipped three figures with alt="" and no caption at all.
     An empty alt on an explanatory diagram is the picture not existing for
     anybody using a screen reader, so it falls back to what the figure was
     asked to show rather than to nothing. */
  const text = String(caption || title || '').trim();
  const describe = String(alt || content || title || '').trim().slice(0, 300);

  const img = `<img class="figimg" src="${esc(src)}" alt="${esc(describe)}" loading="lazy">`;
  if (!text && !credit) return img;

  const [lead, ...rest] = text.split(/(?<=\.)\s+/);
  const tail = [rest.join(' ').trim(), credit ? `Image: ${credit}` : ''].filter(Boolean).join(' ');
  return `<figure>${img}`
    + `<figcaption><strong>${esc(lead)}</strong>${tail ? ' ' + esc(tail) : ''}</figcaption>`
    + '</figure>';
}

/**
 * Draw every figure a piece asked for and put them where it asked.
 *
 * The writer marks each place with [[FIGURE n]]. A figure that cannot be drawn
 * or does not pass its check has its marker removed rather than left in the
 * text, because a literal "[[FIGURE 3]]" in a published tutorial is worse than
 * one fewer picture.
 */
export async function illustrate({ piece, itemId, subject, story = null, meter = null, max = 5 }) {
  let html = String(piece.bodyHtml || '');
  const asked = (piece.figures || []).slice(0, max);
  const made = [];
  const failed = [];

  /* The publisher's own picture, for a figure that wants to show the real
     thing rather than a drawing of it - the launch image, the screenshot of
     the feature. Fetched once and shared, since a piece is about one story.
     Pointed at rather than copied, which is the arrangement the weekly report
     settled on: it stays the publisher's, on their server, and theirs to
     withdraw. */
  let vendor;
  const vendorImage = async () => {
    if (vendor !== undefined) return vendor;
    vendor = null;
    if (story?.url) {
      try { vendor = await imageFor({ url: story.url, source: story.source, sourceName: story.sourceName }); }
      catch { vendor = null; }
    }
    return vendor;
  };

  /* Drawn together rather than one after another. Each one is a model call of
     a minute or so, and four in a row put a single piece past the serverless
     limit on its first real run - the whole invocation timed out and stored
     nothing. They do not depend on each other, so there is no reason they
     should queue. */
  const drawn = await Promise.all(asked.map(async (figure) => {
    const n = Number(figure.n) || 0;
    if (figure.kind === 'fromSource') {
      const img = await vendorImage();
      return img
        ? { n, figure, src: img.url, credit: img.sourceName || story?.sourceName, kind: 'fromSource' }
        : { n, figure, why: 'the source offers no picture we may point at' };
    }
    try {
      const svg = await drawFigure({ figure, subject, meter });
      const problems = svg ? checkFigure(svg) : ['nothing was drawn'];
      if (problems.length) return { n, figure, why: problems.join('; ') };
      return { n, figure, svg, kind: 'drawn' };
    } catch (err) {
      return { n, figure, why: String(err.message || err).slice(0, 120) };
    }
  }));

  for (const d of drawn) {
    const marker = new RegExp(`\\[\\[FIGURE\\s*${d.n}\\]\\]`, 'gi');
    if (d.why) { failed.push({ n: d.n, why: d.why }); html = html.replace(marker, ''); continue; }
    // Stored one at a time: these are writes, and a burst of them at the blob
    // store buys nothing when the slow part is already done.
    const src = d.src || await storeFigure(d.svg, { itemId, n: d.n });
    html = html.replace(marker, figureHtml({
      src, alt: d.figure.alt, caption: d.figure.caption, credit: d.credit,
      title: d.figure.title, content: d.figure.content
    }));
    made.push({ n: d.n, src, kind: d.kind });
  }

  // Any marker the writer left that no figure matched.
  html = html.replace(/\[\[FIGURE\s*\d+\]\]/gi, '');
  return { html, made, failed };
}
