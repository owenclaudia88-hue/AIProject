/**
 * Bring the Prompting Fundamentals articles onto the platform.
 *
 *   node --env-file=.env.local scripts/ingest-fundamentals.mjs
 *
 * Four of the nine guides keep their content in `rich_content`, which is not
 * content at all — it is an <iframe> pointing at a Notion-backed page on
 * ai-black-magic.super.site, wrapped in full-bleed CSS. Framing it would put
 * another site inside the member area and leave the guide dependent on that
 * site staying up.
 *
 * So the page is fetched, its article extracted, its images mirrored into Blob,
 * and the result stored in `library_guides` like every other guide — rendered
 * inline, in our own styling, owned by us.
 *
 * Re-runnable and resumable: an image already in Blob is not fetched again.
 */
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { parse } from 'node-html-parser';
import { neon } from '@neondatabase/serverless';
import { getAsset, upsertAsset, putGuide, mergeMeta } from '../lib/db.js';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set (use --env-file=.env.local)'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);

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

let imgFetched = 0, imgSkipped = 0, imgFailed = 0;

async function mirrorImage(itemId, idx, src) {
  const key = `bm/guide-img/${itemId.replace(/[^\w.-]+/g, '_')}/${idx}.webp`;
  const url = `/api/library/asset?key=${encodeURIComponent(key)}`;
  if (await retry('getAsset', () => getAsset(key))) { imgSkipped++; return url; }
  try {
    const res = await retry('fetch img', () => fetch(src));
    if (!res.ok) { imgFailed++; return null; }
    const webp = await sharp(Buffer.from(await res.arrayBuffer())).rotate()
      .resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const { url: blobUrl } = await put(`library-assets/${key}`, webp, {
      access: 'private', addRandomSuffix: true, contentType: 'image/webp', token: TOKEN
    });
    await retry('upsertAsset', () => upsertAsset(key, blobUrl, 'image/webp'));
    imgFetched++;
    return url;
  } catch (err) { imgFailed++; console.warn(`    ! image: ${err.message}`); return null; }
}

/**
 * Notion's HTML is mostly wrapper divs carrying its own class names. The class
 * names are stripped rather than themed — they belong to a stylesheet we are
 * deliberately not loading — leaving the semantic tags the member area styles.
 */
async function extractArticle(html, itemId) {
  const doc = parse(html);
  const root = doc.querySelector('.notion-root') || doc.querySelector('article') || doc.querySelector('main');
  if (!root) return null;

  root.querySelectorAll('script, style, link, noscript, svg, button, nav, header, footer').forEach((n) => n.remove());
  // Notion ships a hidden copy of the page title and breadcrumbs above the body
  root.querySelectorAll('.notion-header, .notion-page-icon-wrapper, .notion-collection-breadcrumb').forEach((n) => n.remove());

  const imgs = root.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i++) {
    let src = imgs[i].getAttribute('src') || '';
    if (!src) { imgs[i].remove(); continue; }
    if (src.startsWith('/')) src = 'https://ai-black-magic.super.site' + src;
    const url = await mirrorImage(itemId, i, src);
    if (url) { imgs[i].setAttribute('src', url); imgs[i].setAttribute('loading', 'lazy'); }
    else imgs[i].remove();
  }

  // links back to the source site would leak or rot; keep the text, drop the link
  root.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/super\.site|notion\.so/.test(href) || href.startsWith('/')) a.replaceWith(...a.childNodes);
  });

  root.querySelectorAll('*').forEach((n) => {
    n.removeAttribute('class');
    n.removeAttribute('style');
    n.removeAttribute('id');
    n.removeAttribute('data-block-id');
  });

  return root.innerHTML.trim();
}

const rows = await sql`select id, title, meta from library where kind = 'guide' and meta ? 'embedUrl'`;
console.log(`${rows.length} fundamentals to bring in\n`);

let done = 0;
for (const r of rows) {
  const url = r.meta.embedUrl;
  try {
    const res = await retry('fetch page', () => fetch(url));
    if (!res.ok) { console.warn(`  ! ${res.status} ${r.title}`); continue; }
    const html = await extractArticle(await res.text(), r.id);
    if (!html) { console.warn(`  ! no article found in ${r.title}`); continue; }
    await retry('putGuide ' + r.id, () => putGuide(r.id, html));
    // the embed is no longer the content, so stop advertising it
    await retry('meta ' + r.id, () => mergeMeta(r.id, { embedUrl: null, richHtml: null }));
    done++;
    console.log(`  [${done}] ${r.title} — ${(html.length / 1024).toFixed(0)} KB`);
  } catch (err) { console.warn(`  ! ${r.title}: ${err.message}`); }
}

console.log(`\ndone`);
console.log(`  articles stored: ${done} of ${rows.length}`);
console.log(`  images         : ${imgFetched} mirrored, ${imgSkipped} already had, ${imgFailed} failed`);
