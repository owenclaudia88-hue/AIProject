/**
 * Pull the clean course tree (sections, lesson titles, durations, order) from
 * the Circle course pages using the saved session, and write it to
 *   export/community/course-structure.json
 *
 *   node pull-course-structure.mjs
 *
 * The lesson BODIES were already saved by pull-circle.mjs; this only captures
 * the structure that the course landing page shows (which the per-lesson HTML
 * does not carry). Each lesson is keyed by `libId` = "lesson:<slug>" so it maps
 * onto the rows the library ingest created.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSites, sessionPath, EXPORT_DIR, slugFor, sleep } from './lib.mjs';

const sites = await loadSites();
const site = sites.community;
const origin = new URL(site.startUrls[0]).origin;
const courses = site.courses || [];

const storageState = JSON.parse(await readFile(sessionPath('community'), 'utf8'));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState, viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();

const out = [];
for (const courseUrl of courses) {
  const slug = courseUrl.split('/c/')[1].split('/')[0];
  await page.goto(courseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await sleep(1800);
  // make sure every section is expanded (so all lesson rows are in the DOM)
  try {
    const expand = page.getByText(/Expand all sections/i);
    if (await expand.count()) { await expand.first().click(); await sleep(800); }
  } catch {}
  // scroll the whole page so lazily-rendered sections lower down mount
  for (let y = 0; y < 6; y++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9)).catch(() => {});
    await sleep(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await sleep(400);

  const data = await page.evaluate(() => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    // A section is a header <button> whose next sibling holds its lesson
    // anchors. This is structural, so it does not depend on the header text.
    const btns = [...document.querySelectorAll('button')].filter(b => {
      const sib = b.nextElementSibling;
      return sib && sib.querySelector && sib.querySelector('a[href*="/lessons/"]');
    });
    const sections = [];
    const seenLes = new Set();
    for (const b of btns) {
      const name = clean(b.innerText).replace(/\s*\d+\s*lessons?\b.*$/i, '').trim();
      const lessons = [];
      for (const a of b.nextElementSibling.querySelectorAll('a[href*="/lessons/"]')) {
        const href = a.getAttribute('href') || '';
        const les = (href.match(/lessons\/(\d+)/) || [])[1];
        if (!les || seenLes.has(les)) continue;
        seenLes.add(les);
        const t = clean(a.innerText);
        const dm = t.match(/(\d{1,2}:\d{2})\s*$/);
        const duration = dm ? dm[1] : '';
        const title = duration ? clean(t.slice(0, t.length - duration.length)) : t;
        lessons.push({ les, title, duration, href });
      }
      if (lessons.length) sections.push({ name, lessons });
    }
    return { sections };
  });

  const sections = data.sections.map((s, i) => ({
    label: `Section ${i + 1}`,
    name: s.name || `Section ${i + 1}`,
    lessons: s.lessons.map(l => {
      const url = origin + l.href;
      return { lessonId: l.les, libId: 'lesson:' + slugFor(url), title: l.title, duration: l.duration, url };
    })
  }));

  const lessonCount = sections.reduce((n, s) => n + s.lessons.length, 0);
  out.push({ slug, title: undefined, sections, lessonCount });
  console.log(`${slug}: ${sections.length} sections, ${lessonCount} lessons`);
  sections.forEach(s => console.log(`   ${s.label} · ${s.name}  (${s.lessons.length})`));
}

const COURSE_TITLES = {
  '70-ai-specialists-for-claude-course': '70 AI Specialists for Claude',
  'video-shorts-specialist-for-claude': 'Video Shorts Specialist',
  'carousel-post-specialist-for-claude': 'Carousel Post Specialist',
  'image-designers-for-claude': 'Image Designers',
  'ai-automation-specialists-for-claude-01f5af': 'AI Automation Specialists',
  'email-specialists-for-claude-97058b': 'Email Specialist'
};
for (const c of out) c.title = COURSE_TITLES[c.slug] || c.slug;

await writeFile(join(EXPORT_DIR, 'community', 'course-structure.json'),
  JSON.stringify({ pulledAt: new Date().toISOString(), courses: out }, null, 2), 'utf8');

console.log(`\nsaved export/community/course-structure.json  (${out.length} courses)`);
await browser.close();
