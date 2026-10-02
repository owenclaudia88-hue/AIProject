/**
 * Clear the placeholder lesson bodies the paid-course ingest used to write.
 *
 *   node --env-file=.env.local scripts/clear-placeholder-bodies.mjs           # dry run
 *   node --env-file=.env.local scripts/clear-placeholder-bodies.mjs --apply
 *
 * The ingest filled every lesson body with the lesson's own title wrapped in a
 * <p>, so the player always had something to show. Now that the lesson panel is
 * one tab among several, that placeholder is worse than nothing: it makes the
 * Lesson tab appear and open first, hiding the course overview behind a line
 * that only repeats the heading above it.
 *
 * Only the courses in the catalogue are touched, and only bodies that are the
 * placeholder. A lesson somebody actually wrote notes for is left alone, which
 * is checked rather than assumed before anything is written.
 */
import { neon } from '@neondatabase/serverless';
import { COURSES } from '../lib/products.js';

const APPLY = process.argv.includes('--apply');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is needed in .env.local'); process.exit(1); }
const sql = neon(url);

const slugs = Object.keys(COURSES).map((k) => `course-${k}`);

const rows = await sql`select id, title, body_html, course from library
                        where kind = 'lesson' and course = any(${slugs})
                        order by course, id`;

/** The title in a paragraph and nothing else — with or without the full stop
 *  the title gained when it was corrected afterwards. */
const isPlaceholder = (r) => {
  const body = String(r.body_html || '').trim();
  if (!body) return false;
  const inner = body.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
  if (inner === String(r.title).trim()) return true;
  // One title was fixed after ingest, so its body holds the older, shorter
  // version of the same line. Still a placeholder, still only the heading.
  return /^<p>[^<]*<\/p>$/i.test(body) && String(r.title).trim().startsWith(inner.slice(0, 40));
};

const targets = rows.filter(isPlaceholder);
const kept = rows.filter((r) => !isPlaceholder(r));

console.log(`lessons across the paid courses : ${rows.length}`);
console.log(`  placeholder bodies to clear   : ${targets.length}`);
console.log(`  bodies left alone             : ${kept.length}`);
kept.forEach((r) => console.log(`     kept: ${r.id} — ${String(r.body_html).slice(0, 60).replace(/\s+/g, ' ')}`));

if (APPLY) {
  for (const r of targets) {
    await sql`update library set body_html = null where id = ${r.id}`;
  }
  console.log(`\ncleared ${targets.length} placeholder bodies.`);
} else {
  console.log('\nDry run. Add --apply to write.\n');
}
