/**
 * Wire the videos that live *inside* a lesson body to their Bunny sources.
 *
 *   node --env-file=.env.local scripts/link-demo-clips.mjs          # dry run
 *   node --env-file=.env.local scripts/link-demo-clips.mjs --apply
 *
 * Most lessons are one video at the top. A few instead walk through several
 * recordings in the body — "Demo 1", "Demo 2", "Demo 3" — each under its own
 * heading. Circle left a slab of its React player markup where each of those
 * sat, which renders as a stretch of stray CSS text on our page.
 *
 * This replaces each of those slabs with a marker the player fills in, and
 * records the matching Bunny video on the lesson as a numbered clip. The
 * video id stays server-side exactly as the main lesson video does: the
 * browser gets a count and a title, and asks /api/video/sign for each URL.
 */
import { listCourses, getCourse, upsertCourse } from '../lib/db.js';
import { bunnyConfig, isVideoId } from '../lib/bunny.js';
import { neon } from '@neondatabase/serverless';
import { parse } from 'node-html-parser';

const APPLY = process.argv.includes('--apply');
const sql = neon(process.env.DATABASE_URL);
const cfg = bunnyConfig();

/* ---------------- the library ---------------- */
const res = await fetch(`https://video.bunnycdn.com/library/${cfg.libraryId}/videos?page=1&itemsPerPage=100`,
  { headers: { AccessKey: cfg.apiKey, accept: 'application/json' } });
if (!res.ok) { console.error(`Bunny API ${res.status}`); process.exit(1); }
const videos = (await res.json()).items || [];

/** "Demo 2: Email Specialist" -> 2 */
const demoNumber = (s) => { const m = /demo\s*(\d+)/i.exec(s || ''); return m ? +m[1] : null; };

let touchedLessons = 0, linked = 0;

for (const c of await listCourses()) {
  const course = await getCourse(c.slug);
  const data = course.data;
  let courseTouched = false;

  for (const section of data.sections) {
    for (const lesson of section.lessons) {
      const [row] = await sql`select id, body_html from library where id = ${lesson.libId}`;
      if (!row || !row.body_html) continue;

      const root = parse(row.body_html);
      // Circle uses the same wrapper for downloadable attachments as for
      // players, so the wrapper alone is not enough to go on — a "Download
      // the plugin" file looks identical from the outside. Only the ones
      // holding the video placeholder are video slots.
      const slabs = root.querySelectorAll('div.react-renderer.node-file')
        .filter(s => s.querySelector('.lesson-video-embed'));
      if (!slabs.length) continue;

      console.log(`\n=== ${course.title} · ${lesson.title}  (${slabs.length} inline video slot(s))`);
      const clips = [];

      slabs.forEach((slab, i) => {
        // the heading immediately above it names the demo
        let heading = null;
        for (let p = slab; p && !heading;) {
          p = p.previousElementSibling;
          if (p && /^h[1-4]$/i.test(p.tagName)) heading = p.text.replace(/\s+/g, ' ').trim();
        }
        // Only act on a heading that actually names a demo. Falling back to
        // the slot's position would happily attach "Demo 1" to a lesson about
        // installing a plugin, which is worse than leaving it alone.
        const n = demoNumber(heading);
        const match = n === null ? null
          : videos.find(v => demoNumber(v.title) === n && /demo/i.test(v.title) &&
                             !clips.some(c => c.videoId === v.guid));

        if (!match || !isVideoId(match.guid)) {
          console.log(`   slot ${i}: "${heading || '(no heading)'}" — no confident match, left untouched`);
          return;
        }
        console.log(`   slot ${i}: "${heading}"\n            → ${match.title}`);
        clips.push({
          videoId: match.guid,
          title: heading || match.title,
          aspect: match.width && match.height ? +(match.width / match.height).toFixed(4) : null
        });
        slab.replaceWith(`<div class="lesson-clip" data-clip="${clips.length - 1}"></div>`);
        linked++;
      });

      if (!clips.length) continue;
      const html = root.toString();

      if (APPLY) {
        await sql`update library set body_html = ${html} where id = ${row.id}`;
        lesson.clips = clips;
        courseTouched = true;
      }
      touchedLessons++;
    }
  }

  if (APPLY && courseTouched) {
    await upsertCourse({ slug: course.slug, title: course.title, lessonCount: course.lesson_count, sort: course.sort ?? 0, data });
    console.log(`   [course tree saved]`);
  }
}

console.log(`\nlessons with inline videos: ${touchedLessons} · clips linked: ${linked}`);
console.log(APPLY ? 'written.' : 'dry run — nothing written. Re-run with --apply to save.');
