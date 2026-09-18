/**
 * Load the browsable library into Neon: Circle course lessons and the AI Black
 * Magic content (prompts, skills, GPTs, guides, automations, videos).
 *
 *   node --env-file=.env.local scripts/ingest-library.mjs
 *
 * Text bodies go into the `library` table. Images (lesson diagrams, card
 * thumbnails) go to Vercel Blob and are referenced through library_assets, so
 * the member reader can show them. Re-runnable: items are upserted by id.
 *
 * Needs BLOB_READ_WRITE_TOKEN + the Neon DATABASE_URL in .env.local.
 */
import { put } from '@vercel/blob';
import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertLibraryItem, upsertAsset, upsertCourse } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT = join(HERE, '..', 'export');
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set.'); process.exit(1); }

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const CT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const ctFor = (name) => CT[name.slice(name.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream';

const assetCache = new Map(); // localPath -> assetKey (avoid re-uploading)
async function uploadAsset(localPath, key) {
  if (assetCache.has(localPath)) return assetCache.get(localPath);
  const body = await readFile(localPath);
  const ct = ctFor(localPath);
  const { url } = await put(`library-assets/${key}`, body, {
    access: 'private', addRandomSuffix: true, contentType: ct, token: TOKEN
  });
  await upsertAsset(key, url, ct);
  assetCache.set(localPath, key);
  return key;
}

let items = 0, assets = 0;

/* ---------------- 1. Circle course lessons ---------------- */
async function ingestCourses() {
  const dir = join(EXPORT, 'community');
  if (!(await exists(join(dir, 'lessons')))) { console.log('(no community/lessons — skipping courses)'); return; }

  let manifest = { lessons: [] };
  try { manifest = JSON.parse(await readFile(join(dir, 'course-manifest.json'), 'utf8')); } catch {}
  const order = new Map(manifest.lessons.map((l, i) => [l.slug, { course: l.course, title: l.title, sort: i }]));

  const imgDir = join(dir, 'lessons', 'images');
  const files = (await readdir(join(dir, 'lessons'))).filter(f => f.endsWith('.html'));
  console.log(`\ncourses: ${files.length} lessons`);

  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    let html = await readFile(join(dir, 'lessons', f), 'utf8');
    const meta = order.get(slug) || {};

    // upload each inline image and rewrite its src to the gated asset endpoint
    for (const m of [...html.matchAll(/images\/([\w.\-]+)/g)]) {
      const imgName = m[1];
      const local = join(imgDir, imgName);
      if (!(await exists(local))) continue;
      const key = `course/${imgName}`;
      await uploadAsset(local, key); assets++;
      html = html.split(`images/${imgName}`).join(`/api/library/asset?key=${encodeURIComponent(key)}`);
    }

    const title = (meta.title || slug).replace(/ \| .*/, '').trim();
    await upsertLibraryItem({
      id: `lesson:${slug}`, kind: 'lesson',
      course: meta.course || 'Course', category: meta.course || null,
      title, bodyHtml: html, sort: meta.sort ?? 0
    });
    items++;
  }
}

/* ---------------- 2. AI Black Magic content ---------------- */
const BM_KINDS = {
  prompts:              { kind: 'prompt',     label: 'Prompts' },
  image_prompts:        { kind: 'image_prompt', label: 'Image & Video Prompts' },
  claude_skills:        { kind: 'skill',      label: 'Agents & Skills' },
  custom_gpts:          { kind: 'gpt',        label: 'Custom GPTs' },
  guides:               { kind: 'guide',      label: 'Prompting Fundamentals' },
  automation_templates: { kind: 'automation', label: 'Automation Templates' },
  videos:               { kind: 'video',      labeled: 'Tutorials', label: 'Tutorials' }
};
const bodyOf = (r) => r.content || r.body || r.instructions || r.html || r.description || '';

async function ingestBlackMagic() {
  const dir = join(EXPORT, 'blackmagic');
  if (!(await exists(join(dir, 'data')))) { console.log('(no blackmagic/data — skipping)'); return; }

  // image-map ties a row (table+id) to its downloaded thumbnail file
  let imageMap = { images: [] };
  try { imageMap = JSON.parse(await readFile(join(dir, 'image-map.json'), 'utf8')); } catch {}
  const thumbFor = new Map(imageMap.images.map(m => [`${m.table}:${m.id}`, m.local_path]));

  for (const [table, cfg] of Object.entries(BM_KINDS)) {
    const path = join(dir, 'data', `${table}-full.json`);
    if (!(await exists(path))) continue;
    const rows = JSON.parse(await readFile(path, 'utf8'));
    console.log(`\n${table}: ${rows.length} rows`);
    let sort = 0;
    for (const r of rows) {
      if (!r || !r.id) continue;
      let thumbKey = null;
      const localThumb = thumbFor.get(`${table}:${r.id}`);
      if (localThumb) {
        const p = join(dir, localThumb.replace(/^files\//, 'files/'));
        if (await exists(p)) { thumbKey = `bm/${basename(localThumb)}`; await uploadAsset(p, thumbKey); assets++; }
      }
      await upsertLibraryItem({
        id: `${cfg.kind}:${r.id}`, kind: cfg.kind,
        category: r.category || cfg.label, title: r.title || r.name || '(untitled)',
        description: r.description || null, bodyHtml: bodyOf(r) || null,
        thumbKey, sort: sort++
      });
      items++;
    }
  }
}

/* ---------------- 3. Course structure (sections → lessons) ---------------- */
async function ingestCourseStructure() {
  const path = join(EXPORT, 'community', 'course-structure.json');
  if (!(await exists(path))) { console.log('(no course-structure.json — skipping course player data)'); return; }
  const { courses = [] } = JSON.parse(await readFile(path, 'utf8'));
  const durToSec = (d) => { const m = /^(\d{1,2}):(\d{2})$/.exec(d || ''); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
  console.log(`\ncourse structure: ${courses.length} courses`);
  let sort = 0;
  for (const c of courses) {
    let lessons = 0, seconds = 0;
    for (const s of c.sections) for (const l of s.lessons) { lessons++; seconds += durToSec(l.duration); }
    const stats = { sections: c.sections.length, lessons, minutes: Math.round(seconds / 60) };
    await upsertCourse({
      slug: c.slug, title: c.title, lessonCount: lessons, sort: sort++,
      data: { title: c.title, sections: c.sections, stats }
    });
    console.log(`  ${c.title}: ${stats.sections} sections · ${stats.lessons} lessons · ${stats.minutes} min`);
  }
}

await ingestCourses();
await ingestBlackMagic();
await ingestCourseStructure();

console.log(`\ndone`);
console.log(`  library items : ${items}`);
console.log(`  images to Blob: ${assets}`);
console.log('  They now appear in the member area library.\n');
