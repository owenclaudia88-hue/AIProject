/**
 * Drawing an illustration, from content rather than from markup.
 *
 * The first attempt asked the model for a finished SVG. It produced one with a
 * green "LANE 1 · SEND" header above an empty box, and the two other lanes it
 * had described missing altogether - and the checker passed it, because the
 * checker could measure a line of text running off the edge but had no idea
 * what a panel with nothing in it looked like.
 *
 * That is the wrong division of labour. A language model is good at deciding
 * what an illustration should say and bad at arithmetic over a thousand
 * coordinates. So it supplies the content as data and the geometry happens
 * here: panels are sized to their contents, text is wrapped to the width it
 * actually has, the canvas grows to fit, and a panel with nothing in it cannot
 * be drawn because there is no code path that draws one.
 *
 * Three layouts, which is what the library's own illustrations use:
 *   columns — two to four things side by side (plans, settings, options)
 *   rows    — one list of label/value lines (a fact sheet, a checklist)
 *   flow    — three to five steps with arrows between them
 */

const C = {
  page: '#f4f5f7', card: '#ffffff', line: '#e3e5e9', panel: '#f8f9fb',
  ink: '#16181d', body: '#5b6069', faint: '#8b9099',
  blue: '#1a62d8', blueFill: '#eaf1fd', green: '#0f8a5f', greenFill: '#e7f6ef',
  chip: '#eef0f3'
};
const FONT = '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

const W = 1200;          // canvas width
const PAD = 56;          // inside the card
const GAP = 20;          // between panels

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* Advance width for the stack above. Measured off the rendered output rather
   than taken from a spec: 0.5 for regular and 0.54 for bold tracks real text
   closely enough that a wrap never overflows, which is the only thing that
   matters here. */
const widthOf = (text, size, bold) => String(text || '').length * size * (bold ? 0.54 : 0.5);

/** Break text into lines that fit `max` pixels. Long words are left alone. */
function wrap(text, max, size, bold = false) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (widthOf(next, size, bold) > max && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const text = (x, y, s, { size = 17, fill = C.body, bold = false, spacing = 0, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"`
  + (bold ? ' font-weight="700"' : '')
  + (spacing ? ` letter-spacing="${spacing}"` : '')
  + (anchor !== 'start' ? ` text-anchor="${anchor}"` : '')
  + `>${esc(s)}</text>`;

/** Lines of wrapped text, returning the svg and the height it used. */
function block(x, y, body, max, { size = 17, fill = C.body, bold = false, lead = 1.45 } = {}) {
  const lines = wrap(body, max, size, bold);
  const step = Math.round(size * lead);
  const svg = lines.map((l, i) => text(x, y + i * step, l, { size, fill, bold })).join('\n');
  return { svg, height: lines.length * step };
}

const rect = (x, y, w, h, { fill = C.panel, stroke = C.line, r = 14, width = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"`
  + (stroke ? ` stroke="${stroke}" stroke-width="${width}"` : '') + '/>';

function badge(x, y, label, tone) {
  const fill = tone === 'green' ? C.greenFill : tone === 'blue' ? C.blueFill : C.chip;
  const ink = tone === 'green' ? C.green : tone === 'blue' ? C.blue : C.body;
  const w = Math.round(widthOf(label, 13, true)) + 26;
  return { svg: rect(x, y, w, 28, { fill, stroke: '', r: 999 })
    + text(x + 13, y + 19, label, { size: 13, fill: ink, bold: true }), width: w, height: 28 };
}

/* ---------------- the header every layout shares ---------------- */

function header({ eyebrow, title, subtitle }, inner) {
  let y = PAD + 6;
  let svg = '';
  if (eyebrow) {
    svg += text(PAD, y + 12, String(eyebrow).toUpperCase(),
      { size: 15, fill: C.blue, bold: true, spacing: 1.3 });
    y += 34;
  }
  if (title) {
    const t = block(PAD, y + 26, title, inner, { size: 34, fill: C.ink, bold: true, lead: 1.25 });
    svg += t.svg; y += t.height + 8;
  }
  if (subtitle) {
    const s = block(PAD, y + 14, subtitle, inner, { size: 19, fill: C.body, lead: 1.4 });
    svg += s.svg; y += s.height + 10;
  }
  return { svg, y: y + 16 };
}

function footer(y, footnote, inner) {
  if (!footnote) return { svg: '', y };
  const f = block(PAD, y + 26, footnote, inner, { size: 14, fill: C.faint, lead: 1.4 });
  return { svg: f.svg, y: y + 26 + f.height };
}

/* ---------------- layouts ---------------- */

function columns(spec, inner) {
  const panels = (spec.panels || []).filter((p) => p && (p.title || (p.rows || []).length));
  const n = Math.min(4, Math.max(1, panels.length));
  const w = Math.floor((inner - GAP * (n - 1)) / n);
  const padIn = 24;
  const maxText = w - padIn * 2;

  // Lay each panel out first so the tallest decides the row height: a panel
  // drawn to its own height makes a ragged row, which is the thing that made
  // the broken one look broken.
  const laid = panels.slice(0, n).map((p) => {
    let y = padIn;
    let svg = '';
    if (p.label) { svg += text(padIn, y + 12, String(p.label).toUpperCase(), { size: 13, fill: C.faint, bold: true, spacing: 1 }); y += 26; }
    if (p.title) { const t = block(padIn, y + 20, p.title, maxText, { size: 22, fill: C.ink, bold: true, lead: 1.3 }); svg += t.svg; y += t.height + 10; }
    if (p.lead) { const l = block(padIn, y + 16, p.lead, maxText, { size: 17, lead: 1.45 }); svg += l.svg; y += l.height + 8; }
    for (const row of (p.rows || []).slice(0, 8)) {
      if (row?.label) { svg += text(padIn, y + 14, String(row.label).toUpperCase(), { size: 12, fill: C.faint, bold: true, spacing: .9 }); y += 22; }
      if (row?.value) { const v = block(padIn, y + 16, row.value, maxText, { size: 18, fill: C.ink, bold: true, lead: 1.35 }); svg += v.svg; y += v.height + 6; }
      if (row?.note) { const nt = block(padIn, y + 13, row.note, maxText, { size: 14, lead: 1.4 }); svg += nt.svg; y += nt.height + 10; }
    }
    if (p.badge?.text) { const b = badge(padIn, y + 6, p.badge.text, p.badge.tone); svg += b.svg; y += b.height + 10; }
    return { svg, height: y + padIn - 8, highlight: !!p.highlight };
  });

  const h = Math.max(...laid.map((p) => p.height));
  const svg = laid.map((p, i) => {
    const x = PAD + i * (w + GAP);
    return `<g transform="translate(${x},0)">`
      + rect(0, 0, w, h, { fill: p.highlight ? C.blueFill : C.panel, stroke: p.highlight ? C.blue : C.line, width: p.highlight ? 2 : 1 })
      + p.svg + '</g>';
  }).join('\n');
  return { svg, height: h, panels: laid.length };
}

function rows(spec, inner) {
  const list = (spec.rows || []).filter((r) => r && (r.label || r.value));
  const padIn = 28;
  let y = padIn;
  let svg = '';
  if (spec.panelTitle) {
    svg += text(padIn, y + 20, spec.panelTitle, { size: 22, fill: C.ink, bold: true });
    y += 40;
  }
  list.slice(0, 10).forEach((r, i) => {
    if (i) { svg += `<line x1="${padIn}" y1="${y}" x2="${inner - padIn}" y2="${y}" stroke="${C.line}"/>`; y += 18; }
    const l = block(padIn, y + 16, r.label, inner - padIn * 2, { size: 18, fill: C.ink, bold: true, lead: 1.35 });
    svg += l.svg; y += l.height + 4;
    if (r.value) { const v = block(padIn, y + 14, r.value, inner - padIn * 2, { size: 15, lead: 1.4 }); svg += v.svg; y += v.height + 10; }
  });
  const h = y + padIn - 10;
  return { svg: `<g transform="translate(${PAD},0)">` + rect(0, 0, inner, h) + svg + '</g>',
    height: h, panels: list.length };
}

function flow(spec, inner) {
  const steps = (spec.steps || []).filter((s) => s && (s.title || s.detail)).slice(0, 5);
  const n = Math.max(1, steps.length);
  const arrow = 44;
  const w = Math.floor((inner - arrow * (n - 1)) / n);
  const padIn = 20;
  const laid = steps.map((s, i) => {
    let y = padIn;
    let svg = text(padIn, y + 14, `STEP ${i + 1}`, { size: 12, fill: C.faint, bold: true, spacing: 1 });
    y += 26;
    const t = block(padIn, y + 17, s.title, w - padIn * 2, { size: 19, fill: C.ink, bold: true, lead: 1.3 });
    svg += t.svg; y += t.height + 8;
    if (s.detail) { const d = block(padIn, y + 14, s.detail, w - padIn * 2, { size: 15, lead: 1.45 }); svg += d.svg; y += d.height; }
    return { svg, height: y + padIn };
  });
  const h = Math.max(...laid.map((s) => s.height));
  let svg = '';
  laid.forEach((s, i) => {
    const x = PAD + i * (w + arrow);
    svg += `<g transform="translate(${x},0)">` + rect(0, 0, w, h) + s.svg + '</g>';
    if (i < laid.length - 1) {
      const ax = x + w + 12;
      svg += `<path d="M${ax} ${h / 2} L${ax + 20} ${h / 2}" stroke="${C.blue}" stroke-width="2" fill="none"/>`
        + `<path d="M${ax + 14} ${h / 2 - 6} L${ax + 21} ${h / 2} L${ax + 14} ${h / 2 + 6}" fill="${C.blue}"/>`;
    }
  });
  return { svg, height: h, panels: laid.length };
}

/* ---------------- the drawing ---------------- */

/**
 * One illustration, as SVG. Throws if there is nothing to draw, because an
 * empty figure is the failure this module exists to make impossible.
 */
export function renderFigure(spec) {
  const inner = W - PAD * 2;
  const head = header(spec, inner);

  const layout = spec.layout === 'rows' ? rows : spec.layout === 'flow' ? flow : columns;
  const body = layout(spec, inner);
  if (!body.panels) throw new Error('the illustration had no content to draw');

  const bodyY = head.y;
  const foot = footer(bodyY + body.height, spec.footnote, inner);
  const H = Math.round(foot.y + PAD);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect x="0" y="0" width="${W}" height="${H}" fill="${C.page}"/>
<rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="18" fill="${C.card}" stroke="${C.line}"/>
${head.svg}
<g transform="translate(0,${bodyY})">${body.svg}</g>
${foot.svg}
</svg>`;
}
