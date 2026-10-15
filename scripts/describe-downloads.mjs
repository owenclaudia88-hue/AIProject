/**
 * Give every download and every course a one-line description.
 *
 *   node --env-file=.env.local scripts/describe-downloads.mjs          # dry run
 *   node --env-file=.env.local scripts/describe-downloads.mjs --apply
 *
 * The roadmap can only say what something does if it knows. Today a download
 * is a title and a filename — "Ads", "Automate", "Niche" — which is nothing to
 * reason from, so the plan either leaves them out or says something vague. The
 * courses are no better off: a title and a lesson count.
 *
 * Nothing here is invented. A download is described from inside its own zip:
 * the name the pack gives itself and the first real sentence of its README. A
 * course is described from the titles of its own lessons. Where a zip has
 * neither, it is left alone and listed at the end rather than guessed at.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
/* The same reader the upload script uses, so there is one definition of what
   a pack says about itself rather than two that drift. */
import { describeZip } from '../lib/describe-zip.js';
/* Reads and writes go through raw SQL below, which never runs the migration —
   so one call through lib/db first, purely to make sure the column this script
   is about actually exists before it asks for it. */
import { getSettings } from '../lib/db.js';

const sql = neon(process.env.DATABASE_URL);
await getSettings();
const APPLY = process.argv.includes('--apply');
const EXPORT = 'export';

/* ---------- downloads, from inside their zips ---------- */

const zips = new Map();                        // filename -> full path
for (const dir of readdirSync(EXPORT, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const full = join(EXPORT, dir.name);
  for (const f of readdirSync(full)) if (f.toLowerCase().endsWith('.zip')) zips.set(f, join(full, f));
}

const rows = await sql`select key, title, kind, filename, description from content order by kind, title`;
const planned = [];
const unknown = [];

for (const row of rows) {
  const path = zips.get(row.filename);
  if (!path) { unknown.push(`${row.key}  (no zip in export/)`); continue; }
  const text = describeZip(path, { title: row.title });
  if (!text) { unknown.push(`${row.key}  (nothing readable inside)`); continue; }
  planned.push({ key: row.key, kind: row.kind, title: row.title, was: row.description, text });
}

/* ---------- courses, from their own lesson titles ---------- */

const courses = await sql`select slug, title, description, data from courses order by sort`;
const coursePlan = [];
for (const c of courses) {
  const titles = ((c.data?.sections) || []).flatMap((s) => (s.lessons || []).map((l) => l.title)).filter(Boolean);
  if (!titles.length) { unknown.push(`${c.slug}  (no lessons to describe it from)`); continue; }
  const stats = c.data?.stats || {};
  const shown = titles.slice(0, 6).join(', ');
  const text = `${titles.length} lessons${stats.minutes ? `, about ${Math.round(stats.minutes / 60)}h` : ''}`
    + `. Covers: ${shown}${titles.length > 6 ? `, and ${titles.length - 6} more` : ''}.`;
  coursePlan.push({ slug: c.slug, title: c.title, was: c.description, text });
}

/* ---------- show, then write ---------- */

console.log(`=== downloads (${planned.length}) ===\n`);
for (const p of planned) {
  console.log(`${p.kind.padEnd(9)} ${p.title}`);
  console.log(`   ${p.text}\n`);
}
console.log(`=== courses (${coursePlan.length}) ===\n`);
for (const c of coursePlan) {
  console.log(`${c.title}`);
  console.log(`   ${c.text}\n`);
}
if (unknown.length) {
  console.log(`=== left alone (${unknown.length}) ===`);
  for (const u of unknown) console.log(`   ${u}`);
}

if (!APPLY) {
  console.log('\nDry run. Add --apply to write these.\n');
  process.exit(0);
}

for (const p of planned) {
  await sql`update content set description = ${p.text} where key = ${p.key}`;
}
for (const c of coursePlan) {
  await sql`update courses set description = ${c.text} where slug = ${c.slug}`;
}
console.log(`\nwritten: ${planned.length} downloads, ${coursePlan.length} courses.\n`);
