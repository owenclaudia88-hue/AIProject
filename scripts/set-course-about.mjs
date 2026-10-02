/**
 * Write the "About this course" overviews from lib/course-about.js onto the
 * course rows the member area reads.
 *
 *   node --env-file=.env.local scripts/set-course-about.mjs              # dry run
 *   node --env-file=.env.local scripts/set-course-about.mjs --apply
 *   node --env-file=.env.local scripts/set-course-about.mjs --apply --only business-builder
 *
 * Adding an overview for a new course means adding an entry to course-about.js
 * and running this — not editing anything here.
 *
 * Only the `about` key of the course tree is touched. The sections, lessons and
 * stats are read and written back unchanged, so re-running this can never
 * disturb the lessons.
 */
import { neon } from '@neondatabase/serverless';
import { ABOUT } from '../lib/course-about.js';

const APPLY = process.argv.includes('--apply');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 ? process.argv[i + 1] : null;
})();

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is needed in .env.local'); process.exit(1); }
const sql = neon(url);

let written = 0, missing = 0;

for (const [key, about] of Object.entries(ABOUT)) {
  if (ONLY && ONLY !== key) continue;

  // The paid courses were ingested under this slug. A course added another way
  // can be pointed at explicitly with `slug` on its about entry.
  const slug = about.slug || `course-${key}`;
  const rows = await sql`select slug, title, data from courses where slug = ${slug} limit 1`;

  if (!rows[0]) {
    console.log(`  MISSING  ${slug} — no such course row`);
    missing++;
    continue;
  }

  const data = rows[0].data || {};
  const lessons = (data.sections || []).reduce((n, s) => n + (s.lessons || []).length, 0);
  const had = data.about ? 'replacing' : 'adding';

  if (APPLY) {
    await sql`update courses
                 set data = ${JSON.stringify({ ...data, about })}::jsonb
               where slug = ${slug}`;
  }

  console.log(`  ${APPLY ? 'wrote' : 'would write'}  ${rows[0].title}`);
  console.log(`      ${had} the overview · ${lessons} lessons left untouched`);
  written++;
}

console.log(`\n${APPLY ? 'wrote' : 'would write'} ${written} overview(s)` +
  (missing ? `, ${missing} course row(s) not found` : ''));
if (!APPLY) console.log('Dry run. Add --apply to write.\n');
