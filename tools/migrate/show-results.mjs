/**
 * Plain-language summary of what's been exported so far, for the menu.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPORT_DIR } from './lib.mjs';

async function dirSize(dir) {
  let bytes = 0, files = 0;
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else { const s = await stat(p); bytes += s.size; files += 1; }
    }
  }
  await walk(dir);
  return { bytes, files };
}

let sites;
try {
  sites = (await readdir(EXPORT_DIR, { withFileTypes: true })).filter(e => e.isDirectory());
} catch {
  console.log('  Nothing captured yet. Log in and capture a platform first.');
  process.exit(0);
}

if (!sites.length) {
  console.log('  Nothing captured yet. Log in and capture a platform first.');
  process.exit(0);
}

for (const s of sites) {
  const dir = join(EXPORT_DIR, s.name);
  const { bytes, files } = await dirSize(dir);
  console.log(`  ${s.name}`);

  // data-index (from pull) or api-index (from capture)
  try {
    const di = JSON.parse(await readFile(join(dir, 'data-index.json'), 'utf8'));
    const withData = di.tables.filter(t => t.rows);
    const rows = di.tables.reduce((n, t) => n + t.rows, 0);
    console.log(`     ${rows} records across ${withData.length} tables (auto-pulled)`);
    for (const t of withData.sort((a, b) => b.rows - a.rows).slice(0, 6)) {
      console.log(`        - ${t.table}: ${t.rows}`);
    }
  } catch {}
  try {
    const ai = JSON.parse(await readFile(join(dir, 'api-index.json'), 'utf8'));
    console.log(`     ${ai.responseCount} API responses recorded (browsed capture)`);
  } catch {}

  console.log(`     ${files} files on disk, ${(bytes / 1024 / 1024).toFixed(1)} MB total`);
  console.log('');
}

console.log(`  All of it is in:  ${EXPORT_DIR}`);
