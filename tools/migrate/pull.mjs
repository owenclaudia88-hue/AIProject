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

console.log(`\nOpening ${site.startUrls[0]} in your session...`);
await page.goto(site.startUrls[0], { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500); // let the app boot and settle its client

// Find the Supabase project + token the app is already using, from localStorage.
const conf = await page.evaluate(() => {
  const out = { url: null, anon: null, token: null, ref: null };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const m = k && k.match(/^sb-([a-z0-9]+)-auth-token$/);
    if (m) {
      out.ref = m[1];
      out.url = `https://${m[1]}.supabase.co`;
      let raw = localStorage.getItem(k);
      try {
        if (raw.startsWith('base64-')) raw = atob(raw.slice(7));
        const parsed = JSON.parse(raw);
        out.token = parsed.access_token || parsed?.currentSession?.access_token || null;
      } catch {}
    }
  }
  // the anon key is a global in most supabase apps; fall back to scanning scripts
  const scan = (s) => {
    const jwt = s && s.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[\w-]+\.[\w-]+/);
    return jwt ? jwt[0] : null;
  };
  out.anon = scan(document.documentElement.innerHTML)
    || (window.__supabase_anon_key ?? null);
  return out;
});

if (!conf.url || !conf.token) {
  console.error('\nCould not find a Supabase session in this page.');
  console.error('Either the login did not stick (re-run auth.mjs), or this platform');
  console.error('is not Supabase-backed — try capture.mjs instead.\n');
  await browser.close();
  process.exit(1);
}
if (!conf.anon) {
  // the app can't work without it, so it's somewhere; ask the page's fetch to reveal it
  conf.anon = await page.evaluate(async () => {
    // supabase-js stores headers on the client; try the common globals
    return window.supabase?.rest?.headers?.apikey
        || window.supabase?.supabaseKey
        || null;
  });
}
if (!conf.anon) {
  console.error('Found your session but not the public API key. Add it to sites.json as');
  console.error(`"${siteKey}".supabaseAnonKey and re-run.\n`);
  await browser.close();
  process.exit(1);
}

console.log(`  project : ${conf.ref}.supabase.co`);
console.log(`  session : found (logged in)\n`);

// All fetches below run INSIDE the page, so they carry the app's own origin,
// cookies and token — identical to what the app does when you click.
async function apiGet(pathAndQuery, extraHeaders = {}) {
  return page.evaluate(async ({ base, anon, token, pathAndQuery, extraHeaders }) => {
    const res = await fetch(base + pathAndQuery, {
      headers: { apikey: anon, Authorization: `Bearer ${token}`, ...extraHeaders }
    });
    const text = await res.text();
    return { status: res.status, contentRange: res.headers.get('content-range'), text };
  }, { base: conf.url + '/rest/v1', anon: conf.anon, token: conf.token, pathAndQuery, extraHeaders });
}

// 1. enumerate tables from the PostgREST OpenAPI description
const root = await apiGet('/');
let tables = [];
try {
  const spec = JSON.parse(root.text);
  tables = Object.keys(spec.paths || {}).filter(p => p !== '/').map(p => p.replace(/^\//, ''));
} catch {
  console.error('Could not read the table list. Raw response:', root.text.slice(0, 200));
  await browser.close();
  process.exit(1);
}
// prefer content-ish tables first; skip obvious noise
const NOISE = /^(schema_migrations|_|pg_|auth\.|storage\.)/i;
tables = tables.filter(t => !NOISE.test(t));
console.log(`tables readable in your session: ${tables.length}`);

// 2. page through each table
const PAGE = 1000;
const index = [];
for (const table of tables) {
  let from = 0, all = [], truncated = false;
  while (true) {
    const to = from + PAGE - 1;
    const r = await apiGet(`/${encodeURIComponent(table)}?select=*`, {
      Range: `${from}-${to}`, 'Range-Unit': 'items', Prefer: 'count=exact'
    });
    if (r.status >= 400) { truncated = r.status === 401 || r.status === 403; break; }
    let rows;
    try { rows = JSON.parse(r.text); } catch { break; }
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < PAGE) break;
    from += PAGE;
    if (all.length > 100000) break; // safety
  }
  if (all.length || !truncated) {
    await writeFile(join(dataDir, `${table.replace(/[^\w.-]/g, '_')}.json`), JSON.stringify(all, null, 2), 'utf8');
  }
  index.push({ table, rows: all.length, access: truncated ? 'restricted' : 'ok' });
  const tag = truncated ? '  (no read access)' : '';
  console.log(`  ${table.padEnd(34)} ${String(all.length).padStart(6)} rows${tag}`);
}

await writeFile(join(outDir, 'data-index.json'), JSON.stringify({
  site: siteKey, project: `${conf.ref}.supabase.co`,
  pulledAt: new Date().toISOString(), tables: index
}, null, 2), 'utf8');

const totalRows = index.reduce((n, t) => n + t.rows, 0);
console.log(`\ndone`);
console.log(`  tables with data : ${index.filter(t => t.rows).length}`);
console.log(`  total rows       : ${totalRows}`);
console.log(`  output           : ${dataDir}\n`);

await browser.close();
