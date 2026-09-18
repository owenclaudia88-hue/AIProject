/**
 * Circle course pull — for community.*.circle.so style platforms.
 *
 *   node pull-circle.mjs <siteKey>
 *
 * After a one-time login (auth.mjs), this walks every course → section →
 * lesson by itself and, for each lesson, saves:
 *   - the rendered instructions (HTML + plain text)
 *   - every Circle API response it triggered (structured lesson data)
 *   - any file it links (product ZIPs, plugin files, PDFs) downloaded in your
 *     session, so gated download links resolve
 *   - video URLs, recorded for re-hosting (not downloaded — they are large and
 *     belong on a real video host)
 *
 * You don't click through lessons. Every request runs in your own session.
 *
 * Output:
 *   export/<siteKey>/lessons/<slug>.html   rendered lesson body
 *   export/<siteKey>/lessons/<slug>.txt    plain text
 *   export/<siteKey>/api/<n>.json          raw API responses
 *   export/<siteKey>/files/…               downloaded ZIPs / docs
 *   export/<siteKey>/course-manifest.json  every lesson, its files and videos
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSites, sessionPath, EXPORT_DIR, slugFor, classifyEmbed, sleep } from './lib.mjs';

const siteKey = process.argv[2];
if (!siteKey) { console.error('Usage: node pull-circle.mjs <siteKey>'); process.exit(1); }

const sites = await loadSites();
const site = sites[siteKey];
if (!site) { console.error(`No site "${siteKey}" in sites.json.`); process.exit(1); }

let storageState;
try { storageState = JSON.parse(await readFile(sessionPath(siteKey), 'utf8')); }
catch { console.error(`No saved session. Run:  node auth.mjs ${siteKey}`); process.exit(1); }

const outDir     = join(EXPORT_DIR, siteKey);
const lessonsDir = join(outDir, 'lessons');
const apiDir     = join(outDir, 'api');
const filesDir   = join(outDir, 'files');
for (const d of [lessonsDir, apiDir, filesDir]) await mkdir(d, { recursive: true });

const origin = new URL(site.startUrls[0]).origin;
const host = new URL(site.startUrls[0]).host;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState, viewport: { width: 1400, height: 950 } });
const page = await context.newPage();

// record Circle's own API JSON as we go
const apiSeen = new Set();
let apiN = 0;
page.on('response', async (res) => {
  try {
    const url = res.url();
    if (!url.includes(host) || !/\/api\//.test(url)) return;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) return;
    const body = await res.text();
    if (!body || body.length < 3) return;
    const key = url + body.length;
    if (apiSeen.has(key)) return;
    apiSeen.add(key);
    apiN += 1;
    await writeFile(join(apiDir, `${String(apiN).padStart(4, '0')}.json`), body, 'utf8');
  } catch {}
});

async function internalLinks(matcher) {
  return page.evaluate((matcher) => {
    const re = new RegExp(matcher);
    const out = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (re.test(href)) out.add(href.split('#')[0]);
    }
    return [...out];
  }, matcher);
}

// 1. find every course
console.log(`\nopening ${site.startUrls[0]} ...`);
// If the config lists the courses explicitly, use those and skip discovery.
// Most reliable — no dependence on how Circle renders its nav.
const courseSet = new Set((site.courses || []).map(c =>
  c.startsWith('http') ? c : origin + (c.startsWith('/') ? c : '/c/' + c)
));
async function harvestCourses() {
  const found = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll('a[href]')) {
      const h = el.getAttribute('href') || '';
      const m = h.match(/\/c\/[a-z0-9][a-z0-9-]*/i);
      if (m) out.add(m[0]);
    }
    return [...out];
  });
  for (const slugPath of found) courseSet.add(origin + slugPath);
}

// Only auto-discover if no explicit list was configured.
if (courseSet.size === 0) {
  const discovery = [site.startUrls[0], origin + '/courses', origin + '/home'];
  if (site.startUrls[0].includes('/c/')) {
    courseSet.add(origin + '/c/' + site.startUrls[0].split('/c/')[1].split('/')[0]);
  }
  for (const d of discovery) {
    await page.goto(d, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await sleep(900);
    await harvestCourses();
  }
  if (courseSet.size === 0) {
    const { readdir } = await import('node:fs/promises');
    for (const f of await readdir(apiDir).catch(() => [])) {
      const txt = await readFile(join(apiDir, f), 'utf8').catch(() => '');
      for (const m of txt.matchAll(/"slug"\s*:\s*"([a-z0-9][a-z0-9-]*)"/gi)) {
        courseSet.add(origin + '/c/' + m[1]);
      }
    }
  }
}

let courseLinks = [...courseSet];
console.log(`courses found: ${courseLinks.length}`);
if (courseLinks.length) courseLinks.forEach(c => console.log(`  - ${c.replace(origin, '')}`));

// 2. for each course, collect its lesson URLs, then visit each lesson
const lessonImagesDir = join(lessonsDir, 'images');
await mkdir(lessonImagesDir, { recursive: true });
const manifest = [];
const filesGot = new Set();
const imgGot = new Map();       // remote image url -> local filename
let imgN = 0;
let lessonCount = 0;

for (const course of courseLinks) {
  await page.goto(course, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await sleep(1000);

  let lessons = await internalLinks('/lessons/\\d+');
  lessons = [...new Set(lessons.map(h => origin + (h.startsWith('/') ? h : '/' + h)))];
  const courseName = course.split('/c/')[1] || course;
  console.log(`\n${courseName}: ${lessons.length} lessons`);

  for (const lessonUrl of lessons) {
    await page.goto(lessonUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await sleep(900);

    const data = await page.evaluate(() => {
      // Circle renders the lesson body in the main column; grab the largest
      // content region rather than the nav/sidebar.
      const candidates = [...document.querySelectorAll('main, article, [class*="lesson"], [class*="content"]')];
      let best = document.body, bestLen = 0;
      for (const el of candidates) {
        const len = (el.innerText || '').length;
        if (len > bestLen) { best = el; bestLen = len; }
      }
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
      return {
        title: document.title || '',
        html: best.innerHTML,
        text: best.innerText,
        links: [...best.querySelectorAll('a[href]')].map(a => abs(a.getAttribute('href'))).filter(Boolean),
        images: [...best.querySelectorAll('img[src]')].map(i => abs(i.getAttribute('src'))).filter(Boolean),
        iframes: [...document.querySelectorAll('iframe[src]')].map(f => abs(f.getAttribute('src'))).filter(Boolean),
        videos: [...document.querySelectorAll('video source[src], video[src]')].map(v => abs(v.getAttribute('src'))).filter(Boolean)
      };
    });

    const slug = slugFor(lessonUrl);

    // Download the inline images (diagrams, screenshots) so the instructions
    // are self-contained, and rewrite the saved HTML to point at local copies.
    let html = data.html;
    for (const imgUrl of [...new Set(data.images)]) {
      if (/^data:/i.test(imgUrl)) continue;
      try {
        let local = imgGot.get(imgUrl);
        if (!local) {
          const res = await context.request.get(imgUrl, { timeout: 60000, maxRedirects: 5 });
          if (!res.ok()) continue;
          const ct = (res.headers()['content-type'] || '').toLowerCase();
          if (!ct.startsWith('image/')) continue;
          const ext = (ct.split('/')[1] || 'img').split(';')[0].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
          local = `img_${String(++imgN).padStart(4, '0')}.${ext}`;
          await writeFile(join(lessonImagesDir, local), Buffer.from(await res.body()));
          imgGot.set(imgUrl, local);
        }
        // point the HTML at the local file (images/ is a sibling of the .html)
        html = html.split(imgUrl).join(`images/${local}`);
      } catch {}
    }

    await writeFile(join(lessonsDir, `${slug}.html`), html, 'utf8');
    await writeFile(join(lessonsDir, `${slug}.txt`), `${data.title}\n${lessonUrl}\n\n${data.text}`, 'utf8');

    // videos → record for re-hosting
    const videos = [...new Set([...data.iframes, ...data.videos])]
      .map(src => ({ src, kind: classifyEmbed(src) }))
      .filter(v => v.kind !== 'other' || /\.(mp4|m3u8|webm)(\?|$)/i.test(v.src));

    // files → download in-session (product ZIPs, plugins, docs)
    const DOC = /\.(zip|pdf|docx?|xlsx?|pptx?|csv|md|json|plugin|skill|txt)(\?|$)/i;
    const fileLinks = data.links.filter(l =>
      DOC.test(new URL(l).pathname) ||
      /\/download\//.test(l) ||
      /drive\.google\.com/.test(l) ||
      /\.circle\.so.*\/(download|attachments|uploads)/.test(l)
    );
    const savedFiles = [];
    for (const link of fileLinks) {
      if (filesGot.has(link)) { savedFiles.push(link); continue; }
      try {
        const res = await context.request.get(link, { timeout: 90000, maxRedirects: 6 });
        if (!res.ok()) continue;
        const ct = (res.headers()['content-type'] || '').toLowerCase();
        if (ct.includes('text/html')) continue; // a page, not a file
        const cd = res.headers()['content-disposition'] || '';
        const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        let name = m ? decodeURIComponent(m[1]) : (new URL(link).pathname.split('/').filter(Boolean).pop() || 'file');
        name = `${slug}__${name}`.replace(/[^\w.\-]+/g, '_').slice(0, 120);
        await writeFile(join(filesDir, name), Buffer.from(await res.body()));
        filesGot.add(link);
        savedFiles.push(name);
        console.log(`      + file ${name}`);
      } catch {}
    }

    lessonCount += 1;
    manifest.push({ course: courseName, url: lessonUrl, title: data.title, slug, videos, files: savedFiles });
    console.log(`  [${String(lessonCount).padStart(3)}] ${data.title.slice(0, 56) || slug}${videos.length ? `  (${videos.length} video)` : ''}`);
    await sleep(site.delayMs ?? 500);
  }
}

await writeFile(join(outDir, 'course-manifest.json'), JSON.stringify({
  site: siteKey, pulledAt: new Date().toISOString(),
  courseCount: courseLinks.length, lessonCount, lessons: manifest
}, null, 2), 'utf8');

const videoTotal = manifest.reduce((n, l) => n + l.videos.length, 0);
console.log(`\ndone`);
console.log(`  courses     : ${courseLinks.length}`);
console.log(`  lessons     : ${lessonCount}  (instructions saved as html + txt)`);
console.log(`  lesson images: ${imgGot.size}  (downloaded, html points at local copies)`);
console.log(`  files       : ${filesGot.size}  (ZIPs / docs downloaded)`);
console.log(`  videos      : ${videoTotal}  (URLs in course-manifest.json, for re-hosting)`);
console.log(`  output      : ${outDir}\n`);

await browser.close();
