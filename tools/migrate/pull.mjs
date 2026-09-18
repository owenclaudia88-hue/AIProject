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

// Nudge the app into loading everything: reload once, then scroll a few times so
// any lazy / infinite-scroll lists fire their requests. All captured passively.
console.log('loading your content...');
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
for (let s = 0; s < 8; s++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(1200);
}
await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);

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

// Auto-paginate any REST GET list that came back exactly full — the app may only
// have loaded the first page.
const PAGE = 1000;
for (const c of captured.filter(c => c.method === 'GET' && /\/rest\/v1\//.test(c.url))) {
  let first;
  try { first = JSON.parse(c.body); } catch { continue; }
  if (!Array.isArray(first) || first.length < PAGE) continue;

  let all = first.slice(), from = PAGE;
  while (true) {
    const r = await apiGet(c.url, { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' });
    let rows; try { rows = JSON.parse(r.text); } catch { break; }
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (all.length > 200000) break;
  }
  if (all.length > first.length) {
    const file = 'paged-' + nameFor(c.url, 'GET', 0).replace(/^\d+-/, '') + '.json';
    await writeFile(join(dataDir, file), JSON.stringify(all, null, 2), 'utf8');
    totalRecords += all.length - first.length;
    console.log(`  ...paginated ${new URL(c.url).pathname.split('/').pop()} to ${all.length} records`);
    index.push({ method: 'GET', url: c.url, records: all.length, file, paginated: true });
  }
}

await writeFile(join(outDir, 'data-index.json'), JSON.stringify({
  site: siteKey, project: `${conf.ref}.supabase.co`,
  pulledAt: new Date().toISOString(), endpoints: index
}, null, 2), 'utf8');

console.log(`\ndone`);
console.log(`  data responses saved : ${captured.length}`);
console.log(`  total records        : ${totalRecords}`);
console.log(`  output               : ${dataDir}`);
if (!captured.length) {
  console.log(`\n  Nothing was fetched. The dashboard may need a click to show content —`);
  console.log(`  use the browse-and-record option (menu 7 / 8) for this one.`);
}
console.log('');

await browser.close();
