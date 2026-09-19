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
import { readFile, readdir, access, stat as fstat } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertLibraryItem, upsertAsset, upsertCourse, getAsset } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT = join(HERE, '..', 'export');
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set.'); process.exit(1); }

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const CT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const ctFor = (name) => CT[name.slice(name.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream';

const assetCache = new Map(); // localPath -> assetKey (avoid re-uploading)
async function uploadAsset(localPath, key, contentType) {
  if (assetCache.has(localPath)) return assetCache.get(localPath);
  if (await getAsset(key)) { assetCache.set(localPath, key); return key; }   // already up
  const body = await readFile(localPath);
  const ct = contentType || ctFor(localPath);
  const { url } = await put(`library-assets/${key}`, body, {
    access: 'private', addRandomSuffix: true, contentType: ct, token: TOKEN
  });
  await upsertAsset(key, url, ct);
  assetCache.set(localPath, key);
  return key;
}

let items = 0, assets = 0;

/**
 * Neon is reached over HTTP, one request per statement, and a long ingest makes
 * thousands of them — an occasional ECONNRESET is normal and not a reason to
 * lose the whole run. Every write goes through here.
 */
async function retry(label, fn, tries = 5) {
  let wait = 400;
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (err) {
      if (i >= tries) throw err;
      console.warn(`    retry ${i}/${tries - 1} (${label}): ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}


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
  prompts:              { kind: 'prompt',       label: 'Prompts' },
  image_prompts:        { kind: 'image_prompt', label: 'Image & Video Prompts' },
  claude_skills:        { kind: 'skill',        label: 'Agents & Skills' },
  custom_gpts:          { kind: 'gpt',          label: 'Custom GPTs' },
  guides:               { kind: 'guide',        label: 'Prompting Fundamentals' },
  automation_templates: { kind: 'automation',   label: 'Automation Templates' },
  videos:               { kind: 'video',        label: 'Tutorials' }
};

/**
 * The item's own body. Deliberately does NOT fall back to `description` — a row
 * whose only text is its description (every video, and the gallery collections
 * whose content lives in gallery_prompts) should report "no body" so the reader
 * renders the right thing instead of printing the description twice.
 */
const bodyOf = (r) => r.content || r.body || r.instructions || r.html || r.template_content || r.prompt_text || null;

/** tags / categories / search_keywords arrive as arrays, JSON strings or CSV. */
function normTags(r) {
  const out = new Set();
  const push = (v) => {
    if (v == null) return;
    if (typeof v === 'string' && /^\s*\[/.test(v)) { try { return push(JSON.parse(v)); } catch { /* fall through */ } }
    if (Array.isArray(v)) return v.forEach(push);
    if (typeof v === 'object') return push(v.name || v.title || v.label);
    String(v).split(',').map((x) => x.trim()).filter(Boolean).forEach((t) => out.add(t));
  };
  push(r.tags); push(r.categories); push(r.search_keywords); push(r.platform);
  return [...out].slice(0, 24);
}

const asArray = (v) => {
  if (v == null) return null;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) && p.length ? p : null; } catch { return v.trim() ? [v.trim()] : null; } }
  return Array.isArray(v) && v.length ? v : null;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)));

/** Everything kind-specific the reader needs, kept out of the fixed columns. */
function metaFor(table, r) {
  // `instructions` is the per-item "how to use this" note on everything whose
  // body lives in another column. Where instructions IS the body (skills, GPTs)
  // bodyOf already used it, so leaving it out here avoids printing it twice.
  const howTo = (r.content || r.body || r.template_content) ? r.instructions : null;
  const base = clean({
    howTo, promptItems: asArray(r.prompt_items), promptType: r.type,
    difficulty: r.difficulty_level, useCases: asArray(r.use_cases),
    modelCompatibility: asArray(r.model_compatibility), featured: r.is_featured || undefined
  });
  if (table === 'videos') {
    return clean({ ...base, videoUrl: r.video_url, duration: r.duration, instructor: r.instructor_name,
      supportingText: r.supporting_text });
  }
  if (table === 'image_prompts') {
    return clean({ ...base, contentMode: r.content_mode, promptText: r.prompt_text,
      videoUrl: r.video_url, videoText: r.video_text, galleryVideos: asArray(r.gallery_videos) });
  }
  if (table === 'claude_skills') {
    return clean({ ...base, itemType: r.item_type, capabilities: asArray(r.capabilities),
      starters: asArray(r.conversation_starters), promptItems: asArray(r.prompt_items) });
  }
  if (table === 'custom_gpts') {
    return clean({ ...base, gptUrl: r.gpt_url, capabilities: asArray(r.capabilities),
      starters: asArray(r.conversation_starters), knowledgeFiles: asArray(r.knowledge_files) });
  }
  if (table === 'automation_templates') {
    return clean({ ...base, platform: r.platform, toolsRequired: asArray(r.tools_required),
      setupTime: r.estimated_setup_time });
  }
  if (table === 'guides') {
    // rich_content is { iframeUrl, htmlContent } on the few guides that embed one
    const rc = typeof r.rich_content === 'string' ? (() => { try { return JSON.parse(r.rich_content); } catch { return null; } })() : r.rich_content;
    return clean({ ...base, estimatedTime: r.estimated_time, prerequisites: asArray(r.prerequisites),
      embedUrl: rc && rc.iframeUrl, richHtml: rc && rc.htmlContent });
  }
  return base;
}

/** Pull a remote file straight into Blob (used for the skills' .md downloads). */
async function mirrorRemote(url, key, contentType) {
  if (await retry('getAsset ' + key, () => getAsset(key))) return key;   // already mirrored — resumable
  const res = await retry('fetch ' + key, () => fetch(url));
  if (!res.ok) { console.warn(`    ! ${res.status} fetching ${url}`); return null; }
  const buf = Buffer.from(await res.arrayBuffer());
  const { url: blobUrl } = await put(`library-assets/${key}`, buf, {
    access: 'private', addRandomSuffix: true, token: TOKEN,
    contentType: contentType || res.headers.get('content-type') || 'application/octet-stream'
  });
  await retry('asset ' + key, () => upsertAsset(key, blobUrl, contentType || 'application/octet-stream'));
  assets++;
  return key;
}

/**
 * Files in export/blackmagic/files are named <table>__<first 12 of id>__<remote
 * filename>, so a row can find its own downloads and its long-form guide.
 */
const DOWNLOAD_RE = /https?:\/\/[^"'\s)]+\.(?:zip|skill|md)/i;
// Storage filenames carry an upload stamp: 1778487590258-c4uoswxow5o-brand-kit.skill
const prettyName = (n) => String(n || '').replace(/^\d{10,}-[a-z0-9]+-/i, '');

async function ingestBlackMagic() {
  const dir = join(EXPORT, 'blackmagic');
  if (!(await exists(join(dir, 'data')))) { console.log('(no blackmagic/data — skipping)'); return; }
  const filesDir = join(dir, 'files');
  const fileList = (await exists(filesDir)) ? await readdir(filesDir) : [];
  const localFor = (table, id, ext) =>
    fileList.find((f) => f.startsWith(`${table}__${String(id).slice(0, 12)}__`) && (!ext || f.endsWith(ext)));
  const localNamed = (name) => fileList.find((f) => f.endsWith('__' + name));

  // image-map ties a row (table+id) to its downloaded thumbnail file
  let imageMap = { images: [] };
  try { imageMap = JSON.parse(await readFile(join(dir, 'image-map.json'), 'utf8')); } catch {}
  const thumbFor = new Map(imageMap.images.map(m => [`${m.table}:${m.id}`, m.local_path]));

  for (const [table, cfg] of Object.entries(BM_KINDS)) {
    const path = join(dir, 'data', `${table}-full.json`);
    if (!(await exists(path))) continue;
    const raw = JSON.parse(await readFile(path, 'utf8'));
    const rows = Array.isArray(raw) ? raw : (raw.data || []);
    console.log(`\n${table}: ${rows.length} rows`);
    let sort = 0, files = 0, bodies = 0, guides = 0;
    for (const r of rows) {
      if (!r || !r.id) continue;
      const id = `${cfg.kind}:${r.id}`;

      let thumbKey = null;
      const localThumb = thumbFor.get(`${table}:${r.id}`);
      if (localThumb) {
        const p = join(dir, localThumb.replace(/^files\//, 'files/'));
        if (await exists(p)) { thumbKey = `bm/${basename(localThumb)}`; await uploadAsset(p, thumbKey); assets++; }
      }

      const meta = metaFor(table, r);

      // Long-form guide. 16 skills and 42 videos keep their real content in a
      // standalone HTML file rather than in `instructions` — without this they
      // show a title and nothing else.
      let guideHtml = null, guideFile = null;
      if (r.html_file_url) {
        guideFile = localFor(table, r.id, '.html');
        if (guideFile) guideHtml = await readFile(join(filesDir, guideFile), 'utf8');
        else console.warn(`    ! guide not on disk for ${r.title}`);
      }

      // What the member downloads. Most skills name it in skill_url; four keep
      // it only as a link inside their guide, so look there too.
      let dlUrl = r.skill_url || null;
      if (!dlUrl && guideHtml) dlUrl = (guideHtml.match(DOWNLOAD_RE) || [])[0] || null;
      if (dlUrl) {
        const remoteName = dlUrl.split('/').pop();
        const nice = prettyName(remoteName);
        const key = `bm/files/${nice}`;
        const local = localNamed(remoteName);
        const stored = local
          ? await retry('upload ' + nice, () => uploadAsset(join(filesDir, local), key))
          : await mirrorRemote(dlUrl, key);
        if (stored) {
          meta.fileKey = stored; meta.fileName = nice;
          if (local) { try { meta.fileSize = (await fstat(join(filesDir, local))).size; } catch {} }
          files++;
          // Point the guide's own download button at our gated copy as well.
          if (guideHtml) guideHtml = guideHtml.split(dlUrl).join(`/api/library/asset?key=${encodeURIComponent(stored)}&download=1`);
        }
      }

      if (guideHtml) guides++;   // stored by scripts/ingest-guides.mjs

      const body = bodyOf(r);
      if (body) bodies++;

      await retry('upsert ' + id, () => upsertLibraryItem({
        id, kind: cfg.kind,
        category: r.category || cfg.label, title: r.title || r.name || '(untitled)',
        description: r.description || null,
        bodyHtml: body,
        thumbKey, sort: sort++,
        tags: normTags(r),
        meta: Object.keys(meta).length ? meta : null
      }));
      items++;
    }
    console.log(`  ${bodies}/${sort} with a real body` + (guides ? `, ${guides} long-form guides (see ingest-guides)` : '') + (files ? `, ${files} downloadable files` : ''));
  }
  console.log('\n  (gallery tiles are a separate job: scripts/ingest-galleries.mjs)');
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
