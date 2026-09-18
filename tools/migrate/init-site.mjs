/**
 * Writes a sites.json entry for you, so you don't have to hand-write regexes.
 *
 *   node init-site.mjs <key> <loginUrl> <startUrl>
 *
 * e.g.
 *   node init-site.mjs course https://app.kajabi.com/login https://app.kajabi.com/admin/products
 *
 * It derives the include pattern from the start URL by keeping everything up to
 * the last path segment, which is almost always the right fence. It prints what
 * it chose so you can widen or narrow it before crawling.
 *
 * Existing entries are preserved — run it once per platform.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HERE } from './lib.mjs';

const [key, loginUrl, startUrl] = process.argv.slice(2);

if (!key || !loginUrl || !startUrl) {
  console.error(`
Usage: node init-site.mjs <key> <loginUrl> <startUrl>

  key       short name for this platform, e.g. course
  loginUrl  the page you normally log in on
  startUrl  the page listing your courses/products, once logged in

Example:
  node init-site.mjs course https://app.kajabi.com/login https://app.kajabi.com/admin/products
`);
  process.exit(1);
}

for (const [label, value] of [['loginUrl', loginUrl], ['startUrl', startUrl]]) {
  try { new URL(value); } catch {
    console.error(`${label} is not a valid URL: ${value}`);
    process.exit(1);
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const u = new URL(startUrl);
const segments = u.pathname.split('/').filter(Boolean);
// keep everything above the last segment — "/admin/products" fences to "/admin",
// "/v2/location/ABC/memberships/courses" fences to "/v2/location/ABC/memberships"
const fence = segments.slice(0, -1);
const prefix = u.origin + (fence.length ? '/' + fence.join('/') : '');

const entry = {
  loginUrl,
  startUrls: [startUrl],
  includePatterns: ['^' + escapeRe(prefix)],
  excludePatterns: [
    '/logout', '/log-out', '/sign-out', '/signout',
    '/billing', '/settings', '/account', '/profile',
    '/delete', '/remove', '/cancel'
  ],
  contentSelector: 'main',
  maxPages: 300,
  delayMs: 800,
  downloadExtensions: ['.pdf', '.zip', '.docx', '.xlsx', '.pptx', '.csv', '.mp3']
};

const path = join(HERE, 'sites.json');
let sites = {};
try { sites = JSON.parse(await readFile(path, 'utf8')); } catch { /* first run */ }

const existed = Boolean(sites[key]);
sites[key] = entry;
await writeFile(path, JSON.stringify(sites, null, 2) + '\n', 'utf8');

console.log(`\n${existed ? 'Updated' : 'Added'} "${key}" in sites.json\n`);
console.log(`  login   : ${loginUrl}`);
console.log(`  start   : ${startUrl}`);
console.log(`  crawls  : anything under ${prefix}`);
console.log(`  skips   : logout, billing, settings, account, delete…`);
console.log(`\n  entries now in sites.json: ${Object.keys(sites).join(', ')}`);
console.log(`\nIf "crawls" looks too narrow or too wide, edit includePatterns in sites.json.`);
console.log(`\nNext:\n  node auth.mjs ${key}\n  node crawl.mjs ${key} --dry\n`);
