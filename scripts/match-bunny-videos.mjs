/**
 * Pair the videos in a Bunny Stream library with the course lessons, and store
 * each match in the course tree as the lesson's `videoId`.
 *
 *   node --env-file=.env.local scripts/match-bunny-videos.mjs          # dry run
 *   node --env-file=.env.local scripts/match-bunny-videos.mjs --apply  # write
 *
 * Titles travel badly — Circle's differ from whatever the files were called on
 * upload — so the runtime match is the duration, which the course tree already
 * records to the second and which is close to unique across a course. Titles
 * only break ties and flag anything that looks wrong for a human to check.
 *
 * Needs BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID and the Neon
 * DATABASE_URL in .env.local.
 */
import { listCourses, getCourse, upsertCourse } from '../lib/db.js';
import { bunnyConfig, isVideoId } from '../lib/bunny.js';

const APPLY = process.argv.includes('--apply');
const { apiKey, libraryId } = bunnyConfig();
if (!apiKey)    { console.error('BUNNY_STREAM_API_KEY not set in .env.local'); process.exit(1); }
if (!libraryId) { console.error('BUNNY_STREAM_LIBRARY_ID not set in .env.local'); process.exit(1); }

/* ---------------- pull the library ---------------- */
async function fetchVideos() {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=100&orderBy=date`;
    const r = await fetch(url, { headers: { AccessKey: apiKey, accept: 'application/json' } });
    if (!r.ok) throw new Error(`Bunny API ${r.status} ${r.statusText} — ${(await r.text()).slice(0, 200)}`);
    const body = await r.json();
    out.push(...(body.items || []));
    if (!body.items?.length || out.length >= (body.totalItems ?? out.length)) break;
  }
  return out;
}

/* ---------------- matching ---------------- */
const durToSec = (d) => { const m = /^(\d{1,2}):(\d{2})$/.exec(d || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Rough word overlap, 0–1 — enough to tell "Sprint 3" from "Sprint 4". */
function titleScore(a, b) {
  const A = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const B = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0; for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

const videos = await fetchVideos();
console.log(`Bunny library ${libraryId}: ${videos.length} video(s)\n`);
if (!videos.length) {
  console.log('Nothing to match — the library is empty. Upload the lesson videos to it first.');
  process.exit(0);
}

const notReady = videos.filter(v => v.status !== 4);
if (notReady.length) {
  console.log(`note: ${notReady.length} video(s) are not finished encoding yet (status !== 4) and will not play:`);
  notReady.forEach(v => console.log(`   status ${v.status}  ${v.title}`));
  console.log('');
}

let matched = 0, ambiguous = 0, unmatched = 0;
const takenBy = new Map();   // video guid -> lesson title (a video belongs to one lesson)

for (const c of await listCourses()) {
  const course = await getCourse(c.slug);
  const data = course.data;
  let touched = 0;
  console.log(`\n=== ${course.title}`);

  for (const section of data.sections) {
    for (const lesson of section.lessons) {
      const want = durToSec(lesson.duration);
      if (want === null) { console.log(`   —      (no video)          ${lesson.title}`); continue; }

      // candidates within 3s, best title first
      const cands = videos
        .filter(v => Math.abs((v.length ?? -1) - want) <= 3 && !takenBy.has(v.guid))
        .map(v => ({ v, score: titleScore(lesson.title, v.title) }))
        .sort((a, b) => b.score - a.score);

      if (!cands.length) { console.log(`   MISS   ${lesson.duration}  ${lesson.title}`); unmatched++; continue; }

      const best = cands[0];
      const tie = cands.length > 1 && cands[1].score === best.score;
      if (tie) {
        console.log(`   AMBIG  ${lesson.duration}  ${lesson.title}`);
        cands.slice(0, 3).forEach(x => console.log(`            candidate: ${x.v.title}  [${x.v.guid}]`));
        ambiguous++;
        continue;
      }

      takenBy.set(best.v.guid, lesson.title);
      const flag = best.score < 0.3 ? '  (titles differ — worth a look)' : '';
      console.log(`   ok     ${lesson.duration}  ${lesson.title}\n            → ${best.v.title}${flag}`);
      if (isVideoId(best.v.guid) && lesson.videoId !== best.v.guid) { lesson.videoId = best.v.guid; touched++; }
      matched++;
    }
  }

  if (APPLY && touched) {
    await upsertCourse({ slug: course.slug, title: course.title, lessonCount: course.lesson_count, sort: course.sort ?? 0, data });
    console.log(`   [saved ${touched} video id(s)]`);
  }
}

const spare = videos.filter(v => !takenBy.has(v.guid));
console.log(`\nmatched ${matched} · ambiguous ${ambiguous} · no video found ${unmatched}`);
if (spare.length) {
  console.log(`\n${spare.length} video(s) in the library matched no lesson:`);
  spare.forEach(v => console.log(`   ${String(v.length ?? '?').padStart(5)}s  ${v.title}`));
}
console.log(APPLY ? '\nwritten to the course tree.' : '\ndry run — nothing written. Re-run with --apply to save.');
