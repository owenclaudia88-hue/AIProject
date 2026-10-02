/**
 * Clean the markup a member's message is allowed to contain, on the server.
 *
 * The browser sanitises before sending and again before rendering, but neither
 * is a defence: both run on a machine the member controls, and the request can
 * be made without a browser at all. This is the one that decides what gets
 * stored.
 *
 * Written as a tokeniser over the input rather than a set of patterns to strip.
 * "Remove the bad bits" loses to anyone who knows markup — there is always
 * another encoding. Reading the input one tag at a time and emitting only what
 * is on the list cannot be talked around, because an unrecognised tag is never
 * emitted at all.
 */

const ALLOWED = {
  b: [], strong: [], i: [], em: [], s: [], del: [], u: [],
  code: [], pre: [], br: [], p: [], div: [],
  ul: [], ol: [], li: [], blockquote: [],
  a: ['href']
};

// Everything inside these is content, not markup, so the tag and its contents
// go together rather than the tag alone leaving its payload behind as text.
const DROP_CONTENTS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template']);

const VOID = new Set(['br']);

const escapeText = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Only absolute http(s). A scheme nobody can see is how a link becomes a script. */
const safeHref = (raw) => {
  const v = String(raw || '').trim().replace(/[\u0000-\u001F\u007F]/g, '');
  return /^https?:\/\/[^\s"'<>]+$/i.test(v) ? v : null;
};

export function sanitizeHtml(input, { maxLength = 8000 } = {}) {
  const src = String(input == null ? '' : input).slice(0, maxLength * 4);
  let out = '';
  const open = [];
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { out += escapeText(src.slice(i)); break; }
    if (lt > i) out += escapeText(src.slice(i, lt));

    const gt = src.indexOf('>', lt);
    // A '<' with no '>' after it is text, not the start of a tag.
    if (gt < 0) { out += escapeText(src.slice(lt)); break; }

    const raw = src.slice(lt + 1, gt).trim();

    // "5 < 7 and 9 > 2" is a sentence, not a tag. Anything that does not start
    // like one is text, and dropping it would quietly eat the middle of what
    // somebody wrote.
    if (!/^[!?/]?[a-zA-Z]/.test(raw)) {
      out += '&lt;';
      i = lt + 1;
      continue;
    }

    i = gt + 1;

    // Comments, doctypes and processing instructions carry nothing worth keeping.
    if (raw.startsWith('!') || raw.startsWith('?')) continue;

    const closing = raw.startsWith('/');
    const name = (closing ? raw.slice(1) : raw).split(/[\s/>]/)[0].toLowerCase();

    if (DROP_CONTENTS.has(name)) {
      if (!closing) {
        // Skip to the matching close, so the payload goes with the tag.
        const end = src.toLowerCase().indexOf('</' + name, i);
        const endGt = end < 0 ? -1 : src.indexOf('>', end);
        i = endGt < 0 ? src.length : endGt + 1;
      }
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED, name)) continue;  // unwrap

    if (closing) {
      const at = open.lastIndexOf(name);
      if (at < 0) continue;                        // a close with no open
      while (open.length > at) out += '</' + open.pop() + '>';
      continue;
    }

    if (VOID.has(name)) { out += '<' + name + '>'; continue; }

    let attrs = '';
    if (ALLOWED[name].length) {
      for (const attr of ALLOWED[name]) {
        const m = new RegExp(attr + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(raw);
        if (!m) continue;
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (attr === 'href') {
          const href = safeHref(value);
          if (href) attrs += ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow"`;
        }
      }
    }

    out += '<' + name + attrs + '>';
    open.push(name);

    // A message nesting hundreds of tags is not a message. Closing them here
    // keeps a pathological input from becoming a pathological page.
    if (open.length > 40) { while (open.length) out += '</' + open.pop() + '>'; }
  }

  while (open.length) out += '</' + open.pop() + '>';
  return out.slice(0, maxLength);
}

/** Is there anything in this besides empty markup? */
export function htmlIsEmpty(html) {
  return !String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}
