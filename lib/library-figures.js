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

const RULES = `HOW TO DRAW IT.

Canvas: width exactly 1200. Height whatever the content needs, 520 to 1400.
Set width="1200" height="H" viewBox="0 0 1200 H".

SVG does not wrap text. Every line is its own <text> element with its own y.
Work out the line breaks yourself and keep every line inside its box:
at 17px, a line fits about 0.52 x fontSize per character, so a 520px-wide
panel holds roughly 58 characters at 17px. Count before you place. A line that
overruns its panel is the one thing that makes these look broken.

Use <rect rx="14"> for cards and panels, <rect rx="999"> for chips and badges,
<circle> for radio dials, and a <path> tick for a selected state. No gradients,
no shadows, no images, no <style> blocks, no classes - put the fill, the
font-size and the font-weight on each element as attributes. No <foreignObject>:
it does not render when the SVG is used as an image.

Leave 48px of padding inside the outer card and 28px inside a panel.

The last line inside the card is a footnote in 14px #8b9099 saying what the
illustration is based on and that it is an illustration, not a screenshot -
for example "Illustration based on OpenAI's announcement, 5 October 2026. Not a
screenshot of the app." That line is not optional when the picture redraws a
real interface.`;

const FIGURE_TOOL = {
  name: 'figure',
  description: 'One illustration, as a complete SVG document.',
  input_schema: {
    type: 'object',
    properties: {
      svg: { type: 'string', description: 'the whole <svg>…</svg>, nothing before or after it' },
      width: { type: 'integer' },
      height: { type: 'integer' }
    },
    required: ['svg', 'width', 'height']
  }
};

/** Draw one. Returns the svg text, or null. */
export async function drawFigure({ figure, subject, meter = null }) {
  const prompt = `Draw one illustration for a tutorial about ${subject}.

WHAT IT HAS TO SHOW
${figure.title ? `Heading inside the picture: ${figure.title}` : ''}
${figure.eyebrow ? `Eyebrow above the heading: ${figure.eyebrow}` : ''}
${figure.subtitle ? `Line under the heading: ${figure.subtitle}` : ''}

${figure.content}

${figure.basedOn ? `It redraws something real: ${figure.basedOn}. Say so in the footnote.` : ''}

${STYLE}

${RULES}`;

  const out = await callTool(prompt, FIGURE_TOOL, { maxTokens: 16000, meter });
  const svg = String(out.data?.svg || '').trim();
  return /^<svg[\s>]/i.test(svg) ? svg : null;
}

/**
 * What would stop this being put in front of somebody.
 *
 * Mostly geometry. A model asked to place text by hand will sometimes run a
 * line past the edge of the card, and that is invisible to every check except
 * one that actually measures it.
 */
export function checkFigure(svg, { width = 1200 } = {}) {
  const bad = [];
  if (!svg) return ['nothing was drawn'];
  if (!/^<svg[\s>]/i.test(svg.trim())) bad.push('not an svg document');
  if (/<foreignObject/i.test(svg)) bad.push('uses foreignObject, which does not render in an image');
  if (/<script/i.test(svg)) bad.push('carries a script');
  if (/<image[\s>]/i.test(svg)) bad.push('embeds a bitmap');

  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/i);
  if (!vb) bad.push('no viewBox');
  else if (Number(vb[1]) !== width) bad.push(`viewBox is ${vb[1]} wide, not ${width}`);

  const h = vb ? Number(vb[2]) : 0;
  if (h && (h < 360 || h > 1800)) bad.push(`${h}px tall, outside the usable range`);

  /* Text that starts outside the canvas, or so near the right edge that a line
     of any length must overrun it. Catching the x alone is crude and still
     catches the common failure. */
  for (const m of svg.matchAll(/<text[^>]*\bx="(-?[\d.]+)"[^>]*\by="(-?[\d.]+)"/gi)) {
    const x = Number(m[1]); const y = Number(m[2]);
    if (x < 0 || x > width - 40) { bad.push(`text placed at x=${x}, off the canvas`); break; }
    if (h && (y < 0 || y > h)) { bad.push(`text placed at y=${y}, off the canvas`); break; }
  }

  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/gi)].map((m) => m[1]);
  if (texts.length < 4) bad.push('almost no text; an explanatory illustration needs labels');

  /* The longest line against the width it was given. 0.52 x font-size per
     character is close enough for a sans-serif to catch a real overrun. */
  for (const m of svg.matchAll(/<text[^>]*\bx="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]+)<\/text>/gi)) {
    const x = Number(m[1]); const size = Number(m[2]); const len = m[3].length;
    if (x + len * size * 0.52 > width + 8) {
      bad.push(`a line of ${len} characters at ${size}px from x=${x} runs past the edge`);
      break;
    }
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

  const [lead, ...rest] = text.split(/(?<=\.)\s+/);
  const tail = [rest.join(' ').trim(), credit ? `Image: ${credit}` : ''].filter(Boolean).join(' ');
  return `<figure><img class="figimg" src="${esc(src)}" alt="${esc(describe)}" loading="lazy">`
    + (text
      ? `<figcaption><strong>${esc(lead)}</strong>${tail ? ' ' + esc(tail) : ''}</figcaption>`
      : '')
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
