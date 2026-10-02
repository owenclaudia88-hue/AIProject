/**
 * Build the paid courses in the member area from their Bunny collections.
 *
 *   node --env-file=.env.local scripts/ingest-paid-courses.mjs            # dry run
 *   node --env-file=.env.local scripts/ingest-paid-courses.mjs --apply
 *   node --env-file=.env.local scripts/ingest-paid-courses.mjs --apply --only ai-marketing
 *
 * Everything comes from COURSES in lib/products.js and the videos in each
 * collection, so a course is added by adding a catalogue entry — not by editing
 * this file. Re-runnable: rows upsert by id, so re-running after uploading a
 * new video picks it up.
 *
 * Lessons are ordered by the number at the front of the file name, which is how
 * the videos were uploaded. A title with no number sorts first, because that is
 * what an unnumbered intro always turns out to be.
 */
import { upsertLibraryItem, upsertCourse } from '../lib/db.js';
import { bunnyConfig } from '../lib/bunny.js';
import { COURSES } from '../lib/products.js';

const APPLY = process.argv.includes('--apply');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 ? process.argv[i + 1] : null;
})();

const { apiKey, libraryId } = bunnyConfig();
if (!apiKey || !libraryId) {
  console.error('BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID are needed in .env.local');
  process.exit(1);
}

const res = await fetch(
  `https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=500`,
  { headers: { AccessKey: apiKey } });
if (!res.ok) { console.error('Bunny said', res.status, await res.text()); process.exit(1); }
const allVideos = (await res.json()).items || [];

/** "7. Why Brand Voice Is Your Biggest Growth Lever.mp4" -> 7 */
const leadingNumber = (title) => {
  const m = /^\s*(\d+)\s*[.)-]/.exec(String(title));
  return m ? Number(m[1]) : 0;   // 0 sorts an unnumbered intro to the front
};

/** Strip the number, the extension and the stray punctuation uploads collect. */
const cleanTitle = (title) => String(title)
  .replace(/\.(mp4|mov|m4v|webm)$/i, '')
  .replace(/^\s*\d+\s*[.)-]\s*/, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const mmss = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

let courses = 0, lessons = 0;

for (const [key, course] of Object.entries(COURSES)) {
  if (ONLY && ONLY !== key) continue;

  const mine = allVideos
    .filter((v) => v.collectionId === course.collection)
    .sort((a, b) => leadingNumber(a.title) - leadingNumber(b.title) ||
                    String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));

  console.log(`\n${course.name}`);
  if (!mine.length) { console.log('   no videos in that collection — skipped'); continue; }
  if (mine.length !== course.lessons) {
    console.log(`   NOTE: catalogue says ${course.lessons} lessons, the collection has ${mine.length}`);
  }

  const slug = `course-${key}`;
  const tree = { title: course.name, sections: [], stats: null };
  const built = [];
  let totalSeconds = 0;

  for (let i = 0; i < mine.length; i++) {
    const v = mine[i];
    const num = String(i + 1).padStart(2, '0');
    const libId = `lesson:${key}-${num}`;
    const title = cleanTitle(v.title);
    totalSeconds += v.length || 0;

    if (v.length === 0) console.log(`   WARNING: "${title}" is 0 seconds — check the upload`);

    if (APPLY) {
      await upsertLibraryItem({
        id: libId,
        kind: 'lesson',
        course: slug,
        category: course.short,
        title,
        description: null,
        // The video is the lesson. No body: the lesson panel is one tab among
        // several now, and a placeholder repeating the heading above it would
        // make the Lesson tab appear and open first, hiding the course
        // overview behind a line that says nothing.
        bodyHtml: null,
        sort: i,
        requires: course.entitlement
      });
    }

    built.push({
      libId,
      lessonId: `${key}-${num}`,
      title,
      duration: mmss(v.length || 0),
      videoId: v.guid,
      // The player draws the frame at this shape before the video loads, so it
      // does not jump once it does.
      aspect: v.width && v.height ? Number((v.width / v.height).toFixed(4)) : 1.7778
    });
    lessons++;
  }

  tree.sections.push({ name: course.name, label: course.short, lessons: built });
  tree.stats = {
    lessons: built.length,
    minutes: Math.round(totalSeconds / 60),
    sections: 1
  };

  if (APPLY) {
    await upsertCourse({
      slug,
      title: course.name,
      lessonCount: built.length,
      // After the membership's own courses, in catalogue order.
      sort: 10 + Object.keys(COURSES).indexOf(key),
      data: tree,
      requires: course.entitlement
    });
  }

  console.log(`   ${built.length} lessons · ${Math.round(totalSeconds / 60)} min · unlocked by ${course.entitlement}`);
  courses++;
}

console.log(`\n${APPLY ? 'wrote' : 'would write'} ${courses} courses, ${lessons} lessons.`);
if (!APPLY) console.log('Dry run. Add --apply to write.\n');
