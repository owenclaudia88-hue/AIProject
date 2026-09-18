/**
 * Step 2 of 2 — walk the logged-in area and export it.
 *
 *   node crawl.mjs <siteKey> [--limit 50] [--dry]
 *
 * Reuses the session from auth.mjs, follows links that match the site's
 * includePatterns, and for each page writes:
 *
 *   export/<siteKey>/pages/<slug>.html   raw HTML of the content region
 *   export/<siteKey>/pages/<slug>.txt    visible text
 *   export/<siteKey>/files/…             linked downloads (pdf, zip, …)
 *   export/<siteKey>/manifest.json       every page, with its videos and files
 *
 * Videos are recorded, not downloaded — they live behind signed CDN URLs and
 * belong on a proper video host anyway. The manifest tells you which lesson
 * each one belongs to so you can re-upload and relink them.
 *
 * Resumable: pages already on disk are skipped, so you can stop and re-run.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import {
  loadSites, sessionPath, EXPORT_DIR,
  slugFor, shouldVisit, sleep, classifyEmbed
} from './lib.mjs';

const args = process.argv.slice(2);
const siteKey = args[0];
const limitArg = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;
const dryRun = args.includes('--dry');

if (!siteKey) {
  console.error('Usage: node crawl.mjs <siteKey> [--limit N] [--dry]');
  process.exit(1);
}

const sites = await loadSites();
const site = sites[siteKey];
if (!site) {
  console.error(`No site "${siteKey}" in sites.json.`);
  process.exit(1);
}

let storageState;
try {
  storageState = JSON.parse(await readFile(sessionPath(siteKey), 'utf8'));
} catch {
  console.error(`No saved session. Run:  node auth.mjs ${siteKey}`);
  process.exit(1);
}

const outDir   = join(EXPORT_DIR, siteKey);
const pagesDir = join(outDir, 'pages');
const filesDir = join(outDir, 'files');
await mkdir(pagesDir, { recursive: true });
await mkdir(filesDir, { recursive: true });

const maxPages = limitArg ?? site.maxPages ?? 300;
const delayMs  = site.delayMs ?? 800;
const dlExts   = (site.downloadExtensions ?? ['.pdf', '.zip', '.docx', '.xlsx', '.pptx', '.csv', '.mp3']).map(e => e.toLowerCase());

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState, viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const manifestPath = join(outDir, 'manifest.json');

// Resume: reuse the previous manifest so a re-run neither loses earlier pages
// nor stalls because an already-exported page's links were never re-read.
let previous = [];
try {
  previous = JSON.parse(await readFile(manifestPath, 'utf8')).pages ?? [];
} catch { /* first run */ }

const byUrl = new Map(previous.map(p => [p.url, p]));
const seen = new Set();
const queue = [...site.startUrls];
const downloaded = new Set();
let visited = 0, skipped = 0;

for (const p of previous) {
  for (const link of p.links ?? []) {
    if (!queue.includes(link)) queue.push(link);
  }
}
if (previous.length) console.log(`resuming: ${previous.length} pages already exported`);

console.log(`\nCrawling "${siteKey}"  (max ${maxPages} pages, ${delayMs}ms between)\n`);

while (queue.length && visited < maxPages) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);

  const slug = slugFor(url);
  const htmlPath = join(pagesDir, `${slug}.html`);

  if (await exists(htmlPath)) {
    skipped++;
    console.log(`  skip  ${slug}  (already exported)`);
    continue;
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // let lazy content settle without waiting on long-polling sockets
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch (err) {
    console.log(`  FAIL  ${url}  ${err.message.split('\n')[0]}`);
    continue;
  }

  const sel = site.contentSelector || 'body';
  const data = await page.evaluate(({ sel }) => {
    const root = document.querySelector(sel) || document.body;
    const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };

    return {
      title: document.title || '',
      html: root.innerHTML,
      text: root.innerText,
      links: [...document.querySelectorAll('a[href]')].map(a => abs(a.getAttribute('href'))).filter(Boolean),
      iframes: [...document.querySelectorAll('iframe[src]')].map(f => abs(f.getAttribute('src'))).filter(Boolean),
      videos: [...document.querySelectorAll('video source[src], video[src]')]
                .map(v => abs(v.getAttribute('src'))).filter(Boolean)
    };
  }, { sel });

  const embeds = [...new Set([...data.iframes, ...data.videos])]
    .map(src => ({ src, kind: classifyEmbed(src) }))
    .filter(e => e.kind !== 'other' || /\.(mp4|m3u8|webm)(\?|$)/i.test(e.src));

  const fileLinks = [...new Set(data.links)]
    .filter(l => dlExts.includes(extname(new URL(l).pathname).toLowerCase()));

  if (!dryRun) {
    await writeFile(htmlPath, data.html, 'utf8');
    await writeFile(join(pagesDir, `${slug}.txt`), `${data.title}\n${url}\n\n${data.text}`, 'utf8');
  }

  // pull files down through the authenticated session
  const savedFiles = [];
  for (const link of fileLinks) {
    const name = decodeURIComponent(new URL(link).pathname.split('/').pop() || 'file');
    if (downloaded.has(link)) { savedFiles.push(name); continue; }
    if (dryRun) { savedFiles.push(name); downloaded.add(link); continue; }
    try {
      const res = await context.request.get(link, { timeout: 60000 });
      if (res.ok()) {
        await writeFile(join(filesDir, name), Buffer.from(await res.body()));
        savedFiles.push(name);
        downloaded.add(link);
        console.log(`        + file ${name}`);
      }
    } catch (err) {
      console.log(`        ! file ${name}: ${err.message.split('\n')[0]}`);
    }
  }

  const outLinks = [...new Set(data.links.map(l => l.split('#')[0]))]
    .filter(l => shouldVisit(l, site, new Set()));

  byUrl.set(url, { url, title: data.title, slug, embeds, files: savedFiles, links: outLinks });
  visited++;
  console.log(`  [${String(visited).padStart(3)}] ${data.title.slice(0, 58) || slug}`);

  for (const link of data.links) {
    const clean = link.split('#')[0];
    if (shouldVisit(clean, site, seen) && !queue.includes(clean)) queue.push(clean);
  }

  await sleep(delayMs);
}

const allPages = [...byUrl.values()];

if (!dryRun) {
  await writeFile(manifestPath, JSON.stringify({
    site: siteKey,
    exportedAt: new Date().toISOString(),
    pageCount: allPages.length,
    pages: allPages
  }, null, 2), 'utf8');
}

const embedTotal = allPages.reduce((n, p) => n + p.embeds.length, 0);
console.log(`\ndone`);
console.log(`  pages exported : ${visited} new${skipped ? `, ${skipped} already had` : ''}  (${allPages.length} total)`);
console.log(`  files saved    : ${downloaded.size}`);
console.log(`  videos found   : ${embedTotal}  (recorded in manifest, not downloaded)`);
console.log(`  still queued   : ${queue.length}${queue.length ? '  — raise --limit to continue' : ''}`);
console.log(`  output         : ${outDir}\n`);

await browser.close();
