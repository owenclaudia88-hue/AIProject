/**
 * Bring the long-form guides onto the platform.
 *
 *   node --env-file=.env.local scripts/ingest-guides.mjs [--limit=N]
 *
 * 16 skills and 42 videos keep their real content in a standalone HTML document
 * (`html_file_url`) rather than in a text column. Those documents are complete
 * web pages — their own <head>, their own light-theme stylesheet, their own
 * hero banner — so they cannot simply be dropped into the reader, and framing
 * them would put someone else's page inside the member area rather than the
 * content itself.
 *
 * This takes them apart instead:
 *   - keeps the <body>, drops <style>, <script> and the document shell
 *   - drops the hero block (title, subtitle, read time, download button) — the
 *     reader already renders all of that natively from the item's own fields
 *   - mirrors every image into Blob as WebP and rewrites src to our gated URL
 *   - keeps the class names, which are consistent across all 58 guides, so the
 *     member area's own stylesheet can theme them
 *
 * The result is stored in `library_guides` and rendered inline. Re-runnable and
 * resumable: an image already in Blob is not fetched again.
 */
import { put } from '@vercel/blob';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse } from 'node-html-parser';
import { getAsset, upsertAsset, putGuide, getLibraryItem, mergeMeta } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'export', 'blackmagic', 'data');
const FILES = join(HERE, '..', 'export', 'blackmagic', 'files');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set (use --env-file=.env.local)'); process.exit(1); }

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? Number(h.split('=')[1]) : d; };
const LIMIT = arg('limit', Infinity);
const WIDTH = arg('width', 1000);

async function retry(label, fn, tries = 7) {
  let wait = 500;
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (i >= tries) throw err;
      console.warn(`    retry ${i} (${label}): ${err.message}`);
      await new Promise((r) => setTimeout(r, wait)); wait *= 2;
    }
  }
}

const fileList = await readdir(FILES);
const localFor = (table, id) =>
  fileList.find((f) => f.startsWith(`${table}__${String(id).slice(0, 12)}__`) && f.endsWith('.html'));

let imgFetched = 0, imgSkipped = 0, imgFailed = 0, bytesIn = 0, bytesOut = 0;
let fileFetched = 0, fileSkipped = 0, fileFailed = 0;

const DOWNLOAD_RE = /\.(plugin|zip|skill|md|docx|txt)(\?|$)/i;
// storage names carry an upload stamp: 1787079140389-9anzruy06ci-the-magnet.plugin
const prettyName = (n) => String(n || '').replace(/^\d{10,}-[a-z0-9]+-/i, '');

/**
 * One file linked from a guide → Blob, returning our gated download URL. Shares
 * the bm/files/ key space with the ingest, so the headline download and a link
 * to the same file in the body resolve to one stored copy.
 */
async function mirrorFile(url) {
  const name = prettyName(decodeURIComponent(url.split('/').pop().split('?')[0]));
  const key = `bm/files/${name}`;
  const gated = `/api/library/asset?key=${encodeURIComponent(key)}&download=1`;
  if (await retry('getAsset file', () => getAsset(key))) { fileSkipped++; return gated; }
  try {
    const res = await retry('fetch file', () => fetch(url));
    if (!res.ok) { fileFailed++; console.warn(`    ! ${res.status} ${name}`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'application/octet-stream';
    const { url: blobUrl } = await put(`library-assets/${key}`, buf, {
      access: 'private', addRandomSuffix: true, token: TOKEN, contentType: ct
    });
    await retry('upsertAsset file', () => upsertAsset(key, blobUrl, ct));
    fileFetched++;
    return gated;
  } catch (err) { fileFailed++; console.warn(`    ! file: ${err.message}`); return null; }
}

/** One guide image → WebP in Blob. Returns the gated URL to put in the src. */
async function mirrorImage(itemId, idx, src) {
  const key = `bm/guide-img/${itemId.replace(/[^\w.-]+/g, '_')}/${idx}.webp`;
  const url = `/api/library/asset?key=${encodeURIComponent(key)}`;
  if (await retry('getAsset', () => getAsset(key))) { imgSkipped++; return url; }
  try {
    let buf;
    if (src.startsWith('data:')) {
      const b64 = src.slice(src.indexOf(',') + 1);
      buf = Buffer.from(b64, 'base64');
    } else {
      const res = await retry('fetch img', () => fetch(src));
      if (!res.ok) { imgFailed++; return null; }
      buf = Buffer.from(await res.arrayBuffer());
    }
    bytesIn += buf.length;
    const webp = await sharp(buf).rotate().resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    bytesOut += webp.length;
    const { url: blobUrl } = await put(`library-assets/${key}`, webp, {
      access: 'private', addRandomSuffix: true, contentType: 'image/webp', token: TOKEN
    });
    await retry('upsertAsset', () => upsertAsset(key, blobUrl, 'image/webp'));
    imgFetched++;
    return url;
  } catch (err) { imgFailed++; console.warn(`    ! image: ${err.message}`); return null; }
}

/**
 * Strip the document down to the content the member area should own. Parsed
 * properly rather than by regex — the hero and container nest several levels,
 * and cutting them with string matching leaves orphaned fragments behind.
 */
async function extract(html, itemId, downloadUrl) {
  const doc = parse(html, { blockTextElements: { script: false, style: false } });
  const body = doc.querySelector('body') || doc;

  // Read the hero before removing it: the blurb, read time and level are the
  // only things in there the reader cannot already render from the item itself.
  const txt = (sel) => { const n = body.querySelector(sel); return n ? n.text.replace(/\s+/g, ' ').trim() : null; };
  const hero = {
    heroText: txt('.hero-subtitle'),
    readTime: (txt('.read-time') || '').replace(/^[^\w]+/, '') || null,
    level: (txt('.difficulty') || '').replace(/^[^\w]+/, '') || null
  };

  body.querySelectorAll('style, script, link, noscript').forEach((n) => n.remove());
  // the hero repeats the title, blurb, read time and download button — all of
  // which the reader already renders natively from the item's own fields
  body.querySelectorAll('.hero, .hero-pattern, .download-btn, .btn-yellow, .cta-sub, .download-meta')
    .forEach((n) => n.remove());

  // unwrap the page container so our own layout owns the width
  const container = body.querySelector('.container');
  const root = container || body;

  // images → our own gated copies
  const imgs = root.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    const src = imgs[i].getAttribute('src');
    if (!src) continue;
    const url = await mirrorImage(itemId, i, src);
    if (url) imgs[i].setAttribute('src', url);
    else imgs[i].remove();
    imgs[i].setAttribute?.('loading', 'lazy');
  }

  // Links back to the source storage. A guide often offers more than the one
  // headline file — a README, a connectors doc, a set of prompt .txt files —
  // each with its own label explaining it, so they are mirrored individually
  // rather than collapsed into the single top-level download button.
  const links = root.querySelectorAll('a');
  for (const a of links) {
    const href = a.getAttribute('href') || '';
    if (!/uwcjoexhodkdkqdmlpns\.supabase\.co/.test(href)) continue;
    if (DOWNLOAD_RE.test(href)) {
      const gated = await mirrorFile(href);
      if (gated) { a.setAttribute('href', gated); a.setAttribute('download', ''); continue; }
    }
    a.replaceWith(...a.childNodes);   // leaks or rots otherwise
  }

  return { html: root.innerHTML.trim(), hero };
}

const TABLES = [
  { file: 'claude_skills-full.json', table: 'claude_skills', kind: 'skill' },
  { file: 'videos-full.json', table: 'videos', kind: 'video' }
];

let done = 0, missing = 0, heroed = 0;
const started = Date.now();

for (const t of TABLES) {
  const raw = JSON.parse(await readFile(join(DATA, t.file), 'utf8'));
  const rows = (Array.isArray(raw) ? raw : raw.data).filter((r) => r.html_file_url);
  console.log(`\n${t.table}: ${rows.length} guides`);
  for (const r of rows) {
    if (done >= LIMIT) break;
    const f = localFor(t.table, r.id);
    if (!f) { missing++; console.warn(`  ! not on disk: ${r.title}`); continue; }
    const itemId = `${t.kind}:${r.id}`;
    // point the guide's own download link at our gated copy of the file
    const item = await retry('item ' + itemId, () => getLibraryItem(itemId));
    const fileKey = item && item.meta && item.meta.fileKey;
    const dlUrl = fileKey ? `/api/library/asset?key=${encodeURIComponent(fileKey)}&download=1` : null;
    const out = await extract(await readFile(join(FILES, f), 'utf8'), itemId, dlUrl);
    await retry('putGuide ' + itemId, () => putGuide(itemId, out.html));
    // fold the hero's own facts back onto the item
    const hm = Object.fromEntries(Object.entries(out.hero).filter(([, v]) => v));
    if (Object.keys(hm).length && item) {
      await retry('meta ' + itemId, () => mergeMeta(itemId, hm));
      heroed++;
    }
    done++;
    console.log(`  [${String(done).padStart(2)}] ${r.title} — ${(out.html.length / 1024).toFixed(0)} KB` +
      (hm.readTime ? `  (${hm.readTime}${hm.level ? ', ' + hm.level : ''})` : ''));
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`\ndone in ${((Date.now() - started) / 60000).toFixed(1)} min`);
console.log(`  guides stored : ${done}${missing ? `   not on disk: ${missing}` : ''}   with hero facts: ${heroed}`);
console.log(`  images        : ${imgFetched} mirrored, ${imgSkipped} already had, ${imgFailed} failed`);
console.log(`  linked files  : ${fileFetched} mirrored, ${fileSkipped} already had, ${fileFailed} failed`);
if (imgFetched) console.log(`  ${mb(bytesIn)} → ${mb(bytesOut)}`);
