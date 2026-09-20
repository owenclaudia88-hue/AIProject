/**
 * Re-capture every Circle lesson body cleanly and rebrand it, then re-ingest.
 *
 *   node --env-file=.env.local scripts/recapture-lessons.mjs
 *
 * The first pull grabbed the wrong DOM region for several lessons (Circle's
 * feed/nav) and left competitor branding in the good ones. This:
 *   - reads the real lesson body from `.tiptap.ProseMirror`
 *   - removes the "Mastering Claude for Business" / Bogdan Vaida promo blocks
 *   - rebrands Hyper Entrepreneur → AI Founder University, support email → ours
 *   - rewrites their download / lesson / prompt-vault links to our own pages
 *   - drops lessons that are nothing but a promo
 *   - uploads inline images to private Blob and points the body at the gated
 *     asset endpoint
 * then writes the cleaned bodies to the `library` table and refreshes the
 * `courses` structure (minus dropped lessons).
 *
 * Needs the saved Circle session (tools/migrate/.sessions/community.json),
 * BLOB_READ_WRITE_TOKEN and the Neon DATABASE_URL in .env.local.
 */
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';
import { upsertLibraryItem, upsertAsset, upsertCourse, deleteLibraryByKind } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set.'); process.exit(1); }

const _pw = await import(pathToFileURL(join(ROOT, 'tools/migrate/node_modules/playwright/index.js')).href);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

const structPath = join(ROOT, 'export/community/course-structure.json');
const struct = JSON.parse(await readFile(structPath, 'utf8'));
const storageState = JSON.parse(await readFile(join(ROOT, 'tools/migrate/.sessions/community.json'), 'utf8'));

// A lesson whose title is itself a Mastering-Claude advert — drop outright.
const DROP_TITLE = /exclusive invitation|master claude to run your business/i;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState, viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();

// clear stale lesson rows (including any dropped promo lessons) for a clean set
await deleteLibraryByKind('lesson');
const resourceReport = [];  // { course, lesson, href, text }
const videoReport = [];     // { course, lesson, src } — inline lesson videos

const CT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif' };
const imgCache = new Map();  // remote url -> asset key
let imgN = 0, assets = 0;

async function uploadImage(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const res = await ctx.request.get(url, { timeout: 60000, maxRedirects: 5 });
  if (!res.ok()) return null;
  const ct = (res.headers()['content-type'] || '').toLowerCase();
  if (!ct.startsWith('image/')) return null;
  const ext = (ct.split('/')[1] || 'img').split(';')[0].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const key = `course/lesson_${String(++imgN).padStart(4, '0')}.${ext}`;
  const { url: blobUrl } = await put(`library-assets/${key}`, Buffer.from(await res.body()), {
    access: 'private', addRandomSuffix: true, contentType: CT[ext] || ct, token: TOKEN
  });
  await upsertAsset(key, blobUrl, CT[ext] || ct);
  imgCache.set(url, key); assets++;
  return key;
}

const stripTags = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

let captured = 0, dropped = [], items = 0;

for (const course of struct.courses) {
  let sort = 0;
  for (const section of course.sections) {
    const keep = [];
    for (const lesson of section.lessons) {
      if (DROP_TITLE.test(lesson.title || '')) { dropped.push(lesson.title); continue; }

      await page.goto(lesson.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForSelector('.tiptap.ProseMirror', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(700);

      const res = await page.evaluate((title) => {
        const el = [...document.querySelectorAll('.tiptap.ProseMirror')]
          .sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
        if (!el) return { html: '', images: [] };
        const root = el.cloneNode(true);

        const PROMO = /unadvertised bonus|mastering claude for business|exclusive invitation|as our customer, you also received|special unadvertised bonus|50% discount on our flagship/i;
        const SUPPORT = /need support|still having issues/i;

        // remove the promo run: from the first promo child up to the next
        // support heading (kept) or the end of the body.
        const kids = [...root.children];
        let ps = -1;
        for (let i = 0; i < kids.length; i++) { if (PROMO.test(kids[i].textContent || '')) { ps = i; break; } }
        if (ps >= 0) {
          for (let i = ps; i < kids.length; i++) {
            if (i > ps && SUPPORT.test(kids[i].textContent || '')) break;
            kids[i].remove();
          }
        }
        // kill any lingering promo/Bogdan bits
        [...root.querySelectorAll('a')].forEach(a => {
          if (/mcfb|mastering/i.test(a.getAttribute('href') || '') || /bogdan/i.test(a.textContent || '')) {
            (a.closest('p,li,figure') || a).remove();
          }
        });
        [...root.querySelectorAll('p,li,h1,h2,h3,h4')].forEach(n => {
          if (/bogdan vaida/i.test(n.textContent || '')) n.remove();
        });

        // Circle wraps every inline image in a zoom button. We have no lightbox
        // and none of its Tailwind, so the button kept its browser default
        // chrome — a pale box drawn around each image on a dark lesson page.
        [...root.querySelectorAll('button')].forEach(b => b.replaceWith(...b.childNodes));

        // inline video players (Circle-hosted) won't play for our members and
        // carry the old brand — swap each for a placeholder, collect the src.
        const videos = [];
        [...root.querySelectorAll('media-theme, hls-video, video, iframe')].forEach(v => {
          if (!v.isConnected) return;
          let src = v.getAttribute('src') || '';
          if (!src) { const s = v.querySelector && v.querySelector('[src]'); if (s) src = s.getAttribute('src') || ''; }
          if (src) videos.push(src.replace(/^blob:/, ''));
          const ph = document.createElement('div');
          ph.className = 'lesson-video-embed';
          ph.textContent = '▶ Video — coming soon';
          v.replaceWith(ph);
        });

        // rebrand text
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const R = [
          [/support@hyperentrepreneur\.com/gi, 'support@aifounderuniversity.com'],
          [/Hyper Entrepreneur Community/gi, 'AI Founder University'],
          [/Hyper Entrepreneur/gi, 'AI Founder University'],
          [/hyperentrepreneur\.com/gi, 'aifounderuniversity.com']
        ];
        let t;
        while ((t = walk.nextNode())) { let v = t.nodeValue; for (const [re, to] of R) v = v.replace(re, to); t.nodeValue = v; }

        // rewrite the links we can already resolve to our own pages; leave the
        // external RESOURCE links (Notion vaults, Google Drive, Canva …) intact
        // so the owner can download and re-host them first — collect those.
        const RESOURCE = /(notion\.(site|so)|drive\.google|docs\.google|canva\.com|gamma\.app|figma\.com|airtable\.com|loom\.com|typeform|dropbox\.com|we\.tl|wetransfer)/i;
        const resources = [];
        [...root.querySelectorAll('a')].forEach(a => {
          const h = a.getAttribute('href') || '';
          if (/^mailto:support@(hyperentrepreneur|aifounderuniversity)/i.test(h)) a.setAttribute('href', 'mailto:support@aifounderuniversity.com');
          else if (/go\.(hyper|aifounder)[^/]*\/download/i.test(h) || /\/download\/70-ai-specialists/i.test(h)) a.setAttribute('href', '/members/#downloads');
          else if (/hyperentrepreneur\.com\/c\//i.test(h) || /aifounderuniversity\.com\/c\//i.test(h)) {
            const m = h.match(/\/c\/([a-z0-9-]+)/i); a.setAttribute('href', m ? ('/members/#course-' + m[1]) : '/members/');
          } else if (RESOURCE.test(h)) {
            resources.push({ href: h, text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) });
          } else if (/(go\.)?(hyper|aifounder)[a-z]*\.com\/(?!c\/)/i.test(h)) {
            const sp = document.createElement('span'); sp.textContent = a.textContent; a.replaceWith(sp);
          }
        });

        // drop a leading heading that just repeats the lesson title
        const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const first = root.firstElementChild;
        if (first && /^H[1-4]$/.test(first.tagName) && norm(first.textContent) === norm(title)) first.remove();

        // tidy empties
        [...root.querySelectorAll('p,ul,ol')].forEach(n => { if (!(n.textContent || '').trim() && !n.querySelector('img')) n.remove(); });

        const images = [...root.querySelectorAll('img')].map(i => i.src).filter(s => /^https?:/i.test(s));
        return { html: root.innerHTML, images, resources, videos };
      }, lesson.title);

      captured++;
      let html = res.html || '';
      for (const url of [...new Set(res.images)]) {
        const key = await uploadImage(url).catch(() => null);
        if (key) html = html.split(url).join('/api/library/asset?key=' + encodeURIComponent(key));
      }
      // safety net: strip any video player the DOM pass missed (custom media
      // elements vary) and neutralise any stray old-brand URL.
      const VPH = '<div class="lesson-video-embed">▶ Video — coming soon</div>';
      html = html
        .replace(/<media-controller[\s\S]*?<\/media-controller>/gi, VPH)
        .replace(/<media-theme[\s\S]*?<\/media-theme>/gi, VPH)
        .replace(/<hls-video[\s\S]*?<\/hls-video>/gi, VPH)
        .replace(/<video[\s\S]*?<\/video>/gi, VPH)
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, VPH)
        .replace(/(?:blob:)?https?:\/\/[^"'<>\s]*hyperentrepreneur\.com[^"'<>\s]*/gi, '#');

      for (const r of (res.resources || [])) resourceReport.push({ course: course.title, lesson: lesson.title, href: r.href, text: r.text });
      for (const v of (res.videos || [])) videoReport.push({ course: course.title, lesson: lesson.title, src: v });

      // If the only thing left is a video placeholder, empty the body — the
      // player's main video area already shows the "coming soon" state. Keep the
      // lesson (it is a real video lesson); only DROP_TITLE promos are removed.
      const textOnly = stripTags(html).replace(/▶ Video — coming soon/g, '').trim();
      if (!textOnly) html = '';

      await upsertLibraryItem({
        id: lesson.libId, kind: 'lesson',
        course: course.slug, category: course.title,
        title: lesson.title, bodyHtml: html, sort: sort++
      });
      items++;
      keep.push(lesson);
      process.stdout.write('.');
    }
    section.lessons = keep;
  }
  // recompute stats and refresh the course row (dropped lessons excluded)
  const durToSec = d => { const m = /^(\d{1,2}):(\d{2})$/.exec(d || ''); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
  course.sections = course.sections.filter(s => s.lessons.length);
  let lessons = 0, seconds = 0;
  for (const s of course.sections) for (const l of s.lessons) { lessons++; seconds += durToSec(l.duration); }
  const stats = { sections: course.sections.length, lessons, minutes: Math.round(seconds / 60) };
  course.lessonCount = lessons;
  await upsertCourse({ slug: course.slug, title: course.title, lessonCount: lessons, sort: struct.courses.indexOf(course), data: { title: course.title, sections: course.sections, stats } });
  console.log(`\n${course.title}: ${lessons} lessons kept (${stats.sections} sections)`);
}

await writeFile(structPath, JSON.stringify(struct, null, 2), 'utf8');

// De-duplicate the resource list (same URL can appear in several lessons) and
// save it so the owner can download each file and we can re-host + re-link.
const seenRes = new Set();
const uniqueRes = resourceReport.filter(r => { const k = r.href; if (seenRes.has(k)) return false; seenRes.add(k); return true; });
await writeFile(join(ROOT, 'export/community/lesson-resources.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), resources: resourceReport, unique: uniqueRes, inlineVideos: videoReport }, null, 2), 'utf8');

console.log(`\ndone`);
console.log(`  lessons captured : ${captured}`);
console.log(`  lessons ingested : ${items}`);
console.log(`  lessons dropped  : ${dropped.length}`);
dropped.forEach(t => console.log(`     - ${t}`));
console.log(`  images uploaded  : ${assets}`);
console.log(`\n  external resource links to download & re-host (${uniqueRes.length} unique):`);
for (const r of uniqueRes) console.log(`   [${r.course}] ${r.lesson}\n       ${r.href}`);
await browser.close();
