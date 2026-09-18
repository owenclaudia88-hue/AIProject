/**
 * Upload the member-library files to Vercel Blob and record them in Neon.
 *
 *   node --env-file=.env.local scripts/upload-content.mjs
 *
 * Reads what was migrated under export/ and, for each downloadable item,
 * uploads it to Blob (private — served only through the gated endpoint) and
 * upserts a row into the content table. Re-runnable: an item already at the
 * same key is replaced, so you can add content and run again.
 *
 * Needs BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob → Tokens) and the Neon
 * DATABASE_URL in .env.local.
 */
import { put } from '@vercel/blob';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertContent } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT = join(HERE, '..', 'export');

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set. Get it from Vercel → Storage → Blob → Tokens,\nadd it to .env.local, and run again.');
  process.exit(1);
}

const prettyKB = (n) => `${(n / 1024).toFixed(0)} KB`;

async function listFiles(dir, exts) {
  try {
    const out = [];
    for (const name of await readdir(dir)) {
      if (exts.some((e) => name.toLowerCase().endsWith(e))) out.push(join(dir, name));
    }
    return out.sort();
  } catch { return []; }
}

// what to publish, in the order it should appear, with a friendly title
function titleFromFilename(name) {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d+\.\d+\.\d+.*$/, '')      // drop version tails
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const groups = [
  { kind: 'plugin',  dir: join(EXPORT, 'product'),  exts: ['.zip'] },
  { kind: 'powerup', dir: join(EXPORT, 'powerups'), exts: ['.zip'] }
];

let uploaded = 0, sortBase = 0;
for (const g of groups) {
  const files = await listFiles(g.dir, g.exts);
  if (!files.length) { console.log(`(${g.kind}: nothing in ${g.dir})`); continue; }
  console.log(`\n${g.kind}: ${files.length} files`);
  let sort = 0;
  for (const path of files) {
    const filename = basename(path);
    const body = await readFile(path);
    const size = (await stat(path)).size;
    const key = `${g.kind}/${filename}`.replace(/\s+/g, '-');

    // access:'public' gives an unguessable URL; we still never expose it to the
    // browser — the gated endpoint fetches it server-side and streams the bytes.
    const { url } = await put(`content/${key}`, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/zip',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    await upsertContent({
      key, title: titleFromFilename(filename), kind: g.kind,
      filename, blobUrl: url, sizeBytes: size, sort: sortBase + sort
    });
    uploaded += 1; sort += 1;
    console.log(`  + ${prettyKB(size).padStart(8)}  ${key}`);
  }
  sortBase += 100;
}

console.log(`\ndone — ${uploaded} items uploaded to Blob and recorded in the database.`);
console.log('They now appear in the member area for signed-in customers.\n');
