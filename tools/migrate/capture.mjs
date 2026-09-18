/**
 * Network capture — for app-style platforms the crawler can't follow.
 *
 *   node capture.mjs <siteKey> [--filter <regex>]
 *
 * Opens a browser with your saved session and then gets out of the way. You
 * browse normally — click into spaces, open lessons, scroll the feed — and it
 * records every JSON response the app receives.
 *
 * You end up with the platform's own structured data (posts, lessons, members,
 * whatever its API returns) rather than scraped text. It copes with SPAs,
 * modals and infinite scroll for the simple reason that a human is doing the
 * navigating, so anything you can see, it captures.
 *
 * Press Enter in the terminal to stop.
 *
 * Output:
 *   export/<siteKey>/api/<n>-<slug>.json   one file per response
 *   export/<siteKey>/api-index.json        url, method, status, size, file
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadSites, sessionPath, EXPORT_DIR } from './lib.mjs';

const args = process.argv.slice(2);
const siteKey = args[0];
const filterArg = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;

if (!siteKey) {
  console.error('Usage: node capture.mjs <siteKey> [--filter <regex>]');
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

const outDir = join(EXPORT_DIR, siteKey);
const apiDir = join(outDir, 'api');
await mkdir(apiDir, { recursive: true });

// Default: JSON from the same host we started on. Most apps put their data
// under /api/, but not all, so match on content-type rather than path.
const host = new URL(site.startUrls[0]).host;
const filter = filterArg ? new RegExp(filterArg) : new RegExp(`^https?://${host.replace(/\./g, '\\.')}/`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState, viewport: { width: 1500, height: 950 } });
const page = await context.newPage();

const index = [];
const seen = new Set();
let n = 0;

function slugify(url) {
  const u = new URL(url);
  return (u.pathname + u.search)
    .replace(/^\/+/, '')
    .replace(/\.json(?=$|\?)/i, '')   // avoid "…spaces.json.json"
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90) || 'root';
}

page.on('response', async (res) => {
  try {
    const url = res.url();
    if (!filter.test(url)) return;

    const ct = (res.headers()['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) return;

    // same endpoint + same status twice usually means pagination or polling;
    // keep both, but skip byte-identical repeats
    const body = await res.text();
    const key = url + '|' + body.length;
    if (seen.has(key)) return;
    seen.add(key);

    // ignore empty or trivial payloads
    if (body.length < 3) return;

    n += 1;
    const file = `${String(n).padStart(4, '0')}-${slugify(url)}.json`;
    await writeFile(join(apiDir, file), body, 'utf8');

    let topLevel = '';
    try {
      const parsed = JSON.parse(body);
      topLevel = Array.isArray(parsed)
        ? `array(${parsed.length})`
        : Object.keys(parsed).slice(0, 5).join(',');
    } catch { topLevel = '(not parseable)'; }

    index.push({
      n, url, method: res.request().method(), status: res.status(),
      bytes: body.length, keys: topLevel, file
    });

    const short = url.replace(/^https?:\/\/[^/]+/, '');
    console.log(`  [${String(n).padStart(3)}] ${String(body.length).padStart(7)}b  ${short.slice(0, 72)}`);
  } catch {
    // responses can be gone by the time we ask (redirects, aborted requests)
  }
});

console.log(`\nOpening ${site.startUrls[0]}`);
console.log(`Capturing JSON matching: ${filter}\n`);
console.log('Browse the platform normally — open every area you want to keep.');
console.log('Scroll lists to the bottom so paginated data loads.');
console.log('Press Enter here when done.\n');

await page.goto(site.startUrls[0], { waitUntil: 'domcontentloaded' }).catch(() => {});

const rl = createInterface({ input: process.stdin, output: process.stdout });
await rl.question('');
rl.close();

await writeFile(join(outDir, 'api-index.json'), JSON.stringify({
  site: siteKey,
  capturedAt: new Date().toISOString(),
  responseCount: index.length,
  responses: index
}, null, 2), 'utf8');

const bytes = index.reduce((t, r) => t + r.bytes, 0);
console.log(`\ndone`);
console.log(`  responses captured : ${index.length}`);
console.log(`  total size         : ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  output             : ${apiDir}`);
console.log(`  index              : ${join(outDir, 'api-index.json')}\n`);

await browser.close();
