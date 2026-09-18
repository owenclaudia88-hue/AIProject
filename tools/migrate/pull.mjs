/**
 * Auto-pull — for Supabase-backed platforms. No browsing required.
 *
 *   node pull.mjs <siteKey>
 *
 * You log in once (auth.mjs). This then opens the app in your session and,
 * from inside that authenticated page, enumerates the database tables and
 * pages through every row automatically. Hundreds or thousands of records
 * come down in one run — you don't click anything.
 *
 * Every request runs in your own browser tab, as you, using the app's own
 * Supabase client and token. Nothing here handles a password, and no data
 * leaves your machine except the API calls the app itself would make.
 *
 * Output:
 *   export/<siteKey>/data/<table>.json     all rows of each table
 *   export/<siteKey>/data-index.json       row counts per table
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSites, sessionPath, EXPORT_DIR } from './lib.mjs';

const siteKey = process.argv[2];
if (!siteKey) {
  console.error('Usage: node pull.mjs <siteKey>');
  process.exit(1);
}

const sites = await loadSites();
const site = sites[siteKey];
if (!site) { console.error(`No site "${siteKey}" in sites.json.`); process.exit(1); }

let storageState;
try {
  storageState = JSON.parse(await readFile(sessionPath(siteKey), 'utf8'));
} catch {
  console.error(`No saved session. Run:  node auth.mjs ${siteKey}`);
  process.exit(1);
}

const outDir  = join(EXPORT_DIR, siteKey);
const dataDir = join(outDir, 'data');
await mkdir(dataDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState });
const page = await context.newPage();

// The most reliable way to learn the project, key and token is to watch the
// app make its own requests: it cannot render your content without sending all
// three. We sniff the first Supabase request rather than digging through
// localStorage or minified globals, which vary by app and version.
const conf = { url: null, anon: null, token: null, ref: null };
page.on('request', (req) => {
  const url = req.url();
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\//);
  if (!m) return;
  const h = req.headers();
  const apikey = h['apikey'];
  const auth = h['authorization'];
  if (apikey && !conf.anon) {
    conf.ref = m[1];
    conf.url = `https://${m[1]}.supabase.co`;
    conf.anon = apikey;
    // the app authenticates its data calls with the logged-in user's token
    if (auth && /^Bearer\s+/i.test(auth)) conf.token = auth.replace(/^Bearer\s+/i, '');
  }
});

// Record every data response the app receives. This is the reliable path when
// the platform serves content through edge functions or RPC rather than open
// tables (table enumeration then returns nothing). We save exactly what the app
// itself loaded.
const captured = [];
const seenResp = new Set();
page.on('response', async (res) => {
  try {
    const url = res.url();
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/(rest|functions|graphql)\/v1\//.test(url)) return;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) return;
    const body = await res.text();
    if (!body || body.length < 2) return;
    const req = res.request();
    const key = req.method() + ' ' + url + ' ' + body.length;
    if (seenResp.has(key)) return;
    seenResp.add(key);
    captured.push({ url, method: req.method(), status: res.status(), postData: req.postData() || null, body });
  } catch { /* response gone / redirected */ }
});

console.log(`\nOpening ${site.startUrls[0]} in your session...`);
await page.goto(site.startUrls[0], { waitUntil: 'domcontentloaded' }).catch(() => {});

// give the app time to fire its data requests; nudge it if it's slow
for (let i = 0; i < 12 && (!conf.anon || !conf.token); i++) {
  await page.waitForTimeout(1000);
  if (i === 4) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
}

// token can also live in localStorage if the app used a cached session
if (!conf.token) {
  const ls = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-[a-z0-9]+-auth-token$/.test(k)) {
        let raw = localStorage.getItem(k);
        try {
          if (raw.startsWith('base64-')) raw = atob(raw.slice(7));
          const p = JSON.parse(raw);
          return p.access_token || p?.currentSession?.access_token || null;
        } catch {}
      }
    }
    return null;
  });
  if (ls) conf.token = ls;
}

if (!conf.url || !conf.anon) {
  console.error('\nThis platform did not make any Supabase requests, so "grab everything"');
  console.error("can't be used here. Use the browse-and-record option instead");
  console.error('(menu 7 / 8), or re-run the login if it did not stick.\n');
  await browser.close();
  process.exit(1);
}
if (!conf.token) {
  console.error('\nFound the platform but not your login token. Re-run the Log in step,');
  console.error('make sure you are fully signed in, then try again.\n');
  await browser.close();
  process.exit(1);
}

console.log(`  project : ${conf.ref}.supabase.co`);
console.log(`  session : found (logged in)\n`);

// A fetch that runs INSIDE the page, so it carries the app's own origin and
// token — identical to what the app does when you click. Used for pagination.
async function apiGet(fullUrl, extraHeaders = {}) {
  return page.evaluate(async ({ fullUrl, anon, token, extraHeaders }) => {
    const res = await fetch(fullUrl, {
      headers: { apikey: anon, Authorization: `Bearer ${token}`, ...extraHeaders }
    });
    return { status: res.status, text: await res.text() };
  }, { fullUrl, anon: conf.anon, token: conf.token, extraHeaders });
}

// Visit every section so each one's list query fires and its table registers.
// The dashboard alone only touches a few tables; the sidebar links reach the
// rest (prompts, custom GPTs, automation, tutorials, fundamentals, ...). Deep
// pull below then takes ALL rows of whatever tables we discover here.
console.log('visiting each section to discover all content...');
const origin = new URL(site.startUrls[0]).origin;
const navPaths = await page.evaluate((origin) => {
  const set = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/') && !/(logout|sign-?out|settings|account|billing|profile)/i.test(href)) {
      set.add(href.split('#')[0].split('?')[0]);
    }
  }
  return [...set];
}, origin);

const routes = [site.startUrls[0], ...navPaths.map(p => origin + p)].slice(0, 25);
for (const url of routes) {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(700);
}
console.log(`  visited ${routes.length} pages\n`);

// Count the useful records in a response body, whatever shape it takes.
function countRecords(body) {
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return j.length;
    for (const k of ['data', 'records', 'prompts', 'items', 'results', 'rows']) {
      if (Array.isArray(j?.[k])) return j[k].length;
    }
    return j && typeof j === 'object' ? 1 : 0;
  } catch { return 0; }
}

function nameFor(url, method, n) {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/(rest|functions|graphql)\/v1\//, '').replace(/[^\w.-]+/g, '-');
  return `${String(n).padStart(3, '0')}-${method}-${path || 'root'}`.slice(0, 90);
}

// Save every response the app loaded.
const index = [];
let n = 0, totalRecords = 0;
for (const c of captured) {
  n += 1;
  const recs = countRecords(c.body);
  totalRecords += recs;
  const file = nameFor(c.url, c.method, n) + '.json';
  await writeFile(join(dataDir, file), c.body, 'utf8');
  index.push({
    n, method: c.method, url: c.url, status: c.status,
    postData: c.postData, records: recs, bytes: c.body.length, file
  });
  const short = c.url.replace(/^https:\/\/[^/]+/, '');
  console.log(`  ${c.method.padEnd(4)} ${String(recs).padStart(5)} recs  ${short.slice(0, 62)}`);
}

// DEEP PULL — the dashboard only loads a preview (e.g. limit=6) and its list
// query leaves out the body columns. For every content table the app touched,
// re-fetch EVERY row with EVERY column, in your session, paginating fully. This
// is what actually gets all the prompts, with their text.
const PAGE = 1000;

// distinct REST tables the app read, minus per-user / housekeeping ones
const originalSelect = new Map();
const restTables = new Set();
for (const c of captured) {
  const m = c.method === 'GET' && c.url.match(/\/rest\/v1\/([a-zA-Z0-9_]+)\?/);
  if (!m) continue;
  restTables.add(m[1]);
  if (!originalSelect.has(m[1])) {
    const q = new URL(c.url).searchParams.get('select');
    if (q) originalSelect.set(m[1], q);
  }
}
const SKIP = /^(profiles|user_roles|favorites|favorites_counts|user_notification_reads|notification_broadcasts|user_)/;
const contentTables = [...restTables].filter(t => !SKIP.test(t));

if (contentTables.length) {
  console.log(`\ndeep pull — every row, every column:`);
}
const deepIndex = [];
const allRows = {};
for (const table of contentTables) {
  const tryFetch = async (select) => {
    let from = 0, all = [];
    while (true) {
      const url = `${conf.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
      const r = await apiGet(url, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' });
      if (r.status >= 400) return { status: r.status, rows: all };
      let rows; try { rows = JSON.parse(r.text); } catch { break; }
      if (!Array.isArray(rows) || rows.length === 0) break;
      all = all.concat(rows);
      if (rows.length < PAGE) break;
      from += PAGE;
      if (all.length > 200000) break;
    }
    return { status: 200, rows: all };
  };

  // all columns first; if the row-level rules block that, fall back to the
  // exact columns the app itself requested (at least gets the full list)
  let res = await tryFetch('*');
  if (res.status >= 400 && originalSelect.has(table)) res = await tryFetch(originalSelect.get(table));

  const rows = res.rows;
  allRows[table] = rows;
  await writeFile(join(dataDir, `${table}-full.json`), JSON.stringify(rows, null, 2), 'utf8');
  deepIndex.push({ table, rows: rows.length, columns: rows[0] ? Object.keys(rows[0]).length : 0 });
  const hasBody = rows[0] && Object.keys(rows[0]).some(k => /prompt|content|body|text|instructions/i.test(k));
  console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(5)} rows` +
              `${rows[0] ? `, ${Object.keys(rows[0]).length} cols` : ''}` +
              `${hasBody ? '  ✓ includes body' : ''}`);
}

await writeFile(join(outDir, 'deep-index.json'), JSON.stringify({
  site: siteKey, project: `${conf.ref}.supabase.co`,
  pulledAt: new Date().toISOString(), tables: deepIndex
}, null, 2), 'utf8');
totalRecords = deepIndex.reduce((n, t) => n + t.rows, 0);

// FILES & LINKS — rows often carry download links (Google Drive JSONs for the
// automations) and external references (ChatGPT GPT URLs). Pull the actual
// files down; record every external link so nothing is lost.
const URL_RE = /https?:\/\/[^\s"'<>()\\]+/g;
// downloadable content types — note .plugin and .skill (the Claude plugin/skill files)
const DOC_EXT = /\.(json|pdf|docx?|xlsx?|pptx?|csv|md|zip|txt|rtf|plugin|skill|xml|ya?ml)(\?|$)/i;
const IMG_VID_EXT = /\.(png|jpe?g|gif|webp|svg|ico|avif|mp4|webm|mov|m4v)(\?|$)/i;
const filesDir = join(outDir, 'files');
await mkdir(filesDir, { recursive: true });

const links = [];
const toGet = new Map(); // url -> { table, id }
for (const [table, rows] of Object.entries(allRows)) {
  for (const row of rows) {
    const id = row.id ?? '';
    for (const val of Object.values(row)) {
      if (typeof val !== 'string' || !val.includes('http')) continue;
      for (let u of (val.match(URL_RE) || [])) {
        u = u.replace(/[.,);]+$/, '');
        let host; try { host = new URL(u); } catch { continue; }
        const isDrive = /drive\.google\.com/.test(host.host) && /export=download|\/file\/d\//.test(u);
        const isDoc = DOC_EXT.test(host.pathname);
        const isStorage = /supabase\.co\/storage\//.test(u);
        const isImg = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(host.pathname);
        // Storage holds the platform's OWN files: product files (plugins, skills,
        // docs) and its design/content images (card thumbnails, example images).
        // Take those; skip only storage VIDEOS (large) and anything hotlinked from
        // an external host (e.g. news-feed thumbnails belong to those publishers).
        const isStorageVideo = isStorage && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(host.pathname);
        const kind = ((isStorage && !isStorageVideo) || isDrive || isDoc) ? 'file' : 'link';
        const isImage = isStorage && isImg;
        links.push({ table, id, url: u, kind, field: undefined });
        if (kind === 'file' && !toGet.has(u)) toGet.set(u, { table, id, isImage });
      }
    }
  }
}

const imagesDir = join(filesDir, 'images');
await mkdir(imagesDir, { recursive: true });

let got = 0, gotImages = 0;
const urlToLocal = new Map(); // remote url -> local path (for the image map)
if (toGet.size) {
  console.log(`\nfiles & images linked from your content: ${toGet.size} — downloading:`);
  let i = 0;
  for (const [url, meta] of toGet) {
    if (++i > 2000) { console.log('  (stopping at 2000 — raise the cap if needed)'); break; }
    try {
      const res = await context.request.get(url, { timeout: 90000, maxRedirects: 5 });
      if (!res.ok()) { console.log(`  skip ${res.status()}  ${url.slice(0, 60)}`); continue; }
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      // a tiny HTML reply from Drive is its "file too big to scan" confirm page
      if (ct.includes('text/html') && /drive\.google/.test(url)) {
        links.push({ table: meta.table, id: meta.id, url, kind: 'link', note: 'drive-confirm-needed' });
        console.log(`  manual ${url.slice(0, 60)}  (large Drive file — link kept)`);
        continue;
      }
      const buf = Buffer.from(await res.body());
      const base = decodeURIComponent(host_basename(url)) || `${meta.table}-${meta.id}`;
      const safe = `${meta.table}__${(meta.id || '').toString().slice(0, 12)}__${base}`.replace(/[^\w.\-]+/g, '_').slice(0, 120);
      const dir = meta.isImage ? imagesDir : filesDir;
      await writeFile(join(dir, safe), buf);
      urlToLocal.set(url, `files/${meta.isImage ? 'images/' : ''}${safe}`);
      got += 1;
      if (meta.isImage) gotImages += 1;
      if (!meta.isImage || got % 25 === 0) {
        console.log(`  got  ${(buf.length / 1024).toFixed(0).padStart(5)} KB  ${safe.slice(0, 56)}`);
      }
    } catch (e) {
      console.log(`  fail ${url.slice(0, 55)}  ${String(e.message).split('\n')[0].slice(0, 40)}`);
    }
  }
}

function host_basename(u) {
  try {
    const p = new URL(u);
    const driveId = p.searchParams.get('id');
    if (driveId) return `${driveId}.json`;
    return p.pathname.split('/').filter(Boolean).pop() || '';
  } catch { return ''; }
}

// IMAGE MAP — ties each content item to its downloaded image, so the member
// area knows which picture belongs to which prompt / skill / video card.
const imageMap = [];
for (const [table, rows] of Object.entries(allRows)) {
  for (const row of rows) {
    for (const [field, val] of Object.entries(row)) {
      if (typeof val !== 'string') continue;
      const u = val.trim().replace(/[.,);]+$/, '');
      if (urlToLocal.has(u) && /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u)) {
        imageMap.push({
          table, id: row.id, title: row.title || row.name || '',
          field, remote_url: u, local_path: urlToLocal.get(u)
        });
      }
    }
  }
}
await writeFile(join(outDir, 'image-map.json'), JSON.stringify({
  note: "Render each item's card in the member area using local_path.",
  count: imageMap.length, images: imageMap
}, null, 2), 'utf8');

await writeFile(join(outDir, 'links.json'), JSON.stringify({
  site: siteKey, extractedAt: new Date().toISOString(),
  fileCount: got, imageCount: gotImages,
  linkCount: links.filter(l => l.kind === 'link').length, links
}, null, 2), 'utf8');

await writeFile(join(outDir, 'data-index.json'), JSON.stringify({
  site: siteKey, project: `${conf.ref}.supabase.co`,
  pulledAt: new Date().toISOString(), endpoints: index
}, null, 2), 'utf8');

console.log(`\ndone`);
console.log(`  content types pulled : ${deepIndex.length} tables`);
console.log(`  total records        : ${totalRecords}  (full rows, all columns)`);
console.log(`  files downloaded     : ${got - gotImages}`);
console.log(`  images downloaded    : ${gotImages}  (mapped in image-map.json)`);
console.log(`  external links kept  : ${links.filter(l => l.kind === 'link').length}  (see links.json)`);
console.log(`  output               : ${outDir}`);
if (!captured.length) {
  console.log(`\n  Nothing was fetched. The dashboard may need a click to show content —`);
  console.log(`  use the browse-and-record option (menu 7 / 8) for this one.`);
}
console.log('');

await browser.close();
