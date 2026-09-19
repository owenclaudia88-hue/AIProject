/**
 * Build the image-prompt galleries.
 *
 *   node --env-file=.env.local scripts/ingest-galleries.mjs [--limit=N] [--width=800]
 *
 * An image-prompt collection ("Drone & Aerial Photography") is not one picture —
 * it is dozens of tiles, each with its own prompt and its own generated image.
 * Those live in the source row's `gallery_prompts`, which the main ingest does
 * not touch because this job is slow and wants to be run on its own.
 *
 * For every tile: fetch the original (~2 MB PNG), re-encode it to WebP at
 * --width (default 800px), push it to Vercel Blob and record the tile in
 * `library_gallery`. Full-size originals are deliberately not mirrored — a
 * 41-tile gallery of 2 MB PNGs is ~86 MB per page view, which no member should
 * be asked to download. The prompt text is the product; the image illustrates it.
 *
 * Re-runnable and resumable: a tile whose asset already exists is skipped, so an
 * interrupted run picks up where it stopped. Needs BLOB_READ_WRITE_TOKEN and the
 * Neon DATABASE_URL in .env.local.
 */
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getAsset, upsertAsset, replaceGallery } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'export', 'blackmagic', 'data', 'image_prompts-full.json');

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set (use --env-file=.env.local)'); process.exit(1); }

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const LIMIT = arg('limit', Infinity);   // collections to process, for a dry run
const WIDTH = arg('width', 800);
const CONCURRENCY = 6;

const parseMaybe = (v) => {
  if (!v) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};

const raw = JSON.parse(await readFile(SRC, 'utf8'));
const rows = Array.isArray(raw) ? raw : (raw.data || []);

/** Collections that actually have tiles, in source order. */
const collections = [];
for (const r of rows) {
  const tiles = parseMaybe(r.gallery_prompts);
  if (Array.isArray(tiles) && tiles.length) collections.push({ row: r, tiles });
}
console.log(`${collections.length} collections, ${collections.reduce((n, c) => n + c.tiles.length, 0)} tiles`);
console.log(`re-encoding to ${WIDTH}px WebP\n`);

let done = 0, skipped = 0, fetched = 0, failed = 0, bytesIn = 0, bytesOut = 0;

/**
 * Neon is reached over HTTP, one request per statement, and a long ingest makes
 * thousands of them — an occasional ECONNRESET is normal and not a reason to
 * lose the whole run. Every write goes through here.
 */
async function retry(label, fn, tries = 5) {
  let wait = 400;
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (i >= tries) throw err;
      console.warn(`    retry ${i}/${tries - 1} (${label}): ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}


/** One tile → a WebP in Blob. Returns its asset key, or null if there's no image. */
async function tileAsset(itemId, idx, url) {
  const key = `bm/gallery/${itemId.replace(/[^\w.-]+/g, '_')}/${idx}.webp`;
  if (await retry('getAsset', () => getAsset(key))) { skipped++; return key; }
  if (!url) return null;
  try {
    const res = await retry('fetch tile', () => fetch(url));
    if (!res.ok) { failed++; console.warn(`  ! ${res.status} ${url.slice(0, 90)}`); return null; }
    const src = Buffer.from(await res.arrayBuffer());
    bytesIn += src.length;
    const webp = await sharp(src).rotate()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 78 }).toBuffer();
    bytesOut += webp.length;
    const { url: blobUrl } = await put(`library-assets/${key}`, webp, {
      access: 'private', addRandomSuffix: true, contentType: 'image/webp', token: TOKEN
    });
    await retry('upsertAsset', () => upsertAsset(key, blobUrl, 'image/webp'));
    fetched++;
    return key;
  } catch (err) {
    failed++;
    console.warn(`  ! ${err.message} — ${String(url).slice(0, 80)}`);
    return null;
  }
}

/** Run `job` over `list` with a fixed number of workers, preserving order. */
async function pool(list, job) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= list.length) return;
      out[i] = await job(list[i], i);
    }
  }));
  return out;
}

const started = Date.now();
for (const { row, tiles } of collections.slice(0, LIMIT)) {
  const itemId = `image_prompt:${row.id}`;
  const keys = await pool(tiles, (t, i) => tileAsset(itemId, i, t.generated_image_url || t.image_url || null));
  const entries = tiles.map((t, i) => ({ prompt: t.prompt || null, assetKey: keys[i] }));
  await retry('gallery ' + itemId, () => replaceGallery(itemId, entries));
  done++;
  const withImg = entries.filter((e) => e.assetKey).length;
  console.log(`[${String(done).padStart(2)}/${Math.min(collections.length, LIMIT)}] ${row.title} — ${entries.length} tiles, ${withImg} with an image`);
}

const mins = ((Date.now() - started) / 60000).toFixed(1);
const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
console.log(`\ndone in ${mins} min`);
console.log(`  collections   : ${done}`);
console.log(`  images fetched: ${fetched}   already had: ${skipped}   failed: ${failed}`);
if (fetched) console.log(`  ${mb(bytesIn)} downloaded → ${mb(bytesOut)} stored (${(100 - bytesOut / bytesIn * 100).toFixed(0)}% smaller)`);
