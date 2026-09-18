import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const SESSION_DIR = join(HERE, '.sessions');
export const EXPORT_DIR = join(HERE, '..', '..', 'export');

export const sessionPath = (key) => join(SESSION_DIR, `${key}.json`);

export async function loadSites() {
  try {
    return JSON.parse(await readFile(join(HERE, 'sites.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('No sites.json found. Copy sites.example.json to sites.json and edit it.');
      process.exit(1);
    }
    throw err;
  }
}

/** Filesystem-safe name derived from a URL path, stable across runs. */
export function slugFor(url) {
  const u = new URL(url);
  let s = (u.pathname + u.search)
    // drop a page extension so slugs don't end up as "lesson-1.html.html"
    .replace(/\.(html?|php|aspx?)(?=$|\?)/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return s || 'index';
}

export function matchesAny(url, patterns) {
  return patterns.some((p) => new RegExp(p).test(url));
}

/** Things that are never a page. Navigating to these just triggers a download. */
const ASSET_EXT = new Set([
  '.pdf', '.zip', '.rar', '.7z', '.gz', '.dmg', '.exe', '.pkg',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.mp3', '.wav', '.mp4', '.webm', '.mov', '.m3u8',
  '.css', '.js', '.json', '.xml', '.woff', '.woff2', '.ttf'
]);

/**
 * Decides whether a discovered link is worth visiting: in the allow-list, not
 * excluded, not an asset, not already seen. Assets are still collected — they
 * are fetched directly rather than navigated to.
 */
export function shouldVisit(url, site, seen) {
  if (seen.has(url)) return false;
  if (!/^https?:/i.test(url)) return false;

  let ext = '';
  try { ext = extname(new URL(url).pathname).toLowerCase(); } catch { return false; }
  if (ext && ASSET_EXT.has(ext)) return false;
  if (ext && (site.downloadExtensions ?? []).map(e => e.toLowerCase()).includes(ext)) return false;

  if (site.excludePatterns?.length && matchesAny(url, site.excludePatterns)) return false;
  if (site.includePatterns?.length && !matchesAny(url, site.includePatterns)) return false;
  return true;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Video embeds worth noting so they can be re-hosted rather than scraped. */
export function classifyEmbed(src) {
  if (/youtube\.com|youtu\.be/i.test(src)) return 'youtube';
  if (/vimeo\.com/i.test(src)) return 'vimeo';
  if (/wistia/i.test(src)) return 'wistia';
  if (/mediadelivery\.net|bunnycdn|b-cdn\.net/i.test(src)) return 'bunny';
  if (/loom\.com/i.test(src)) return 'loom';
  if (/mux\.com|stream\.mux/i.test(src)) return 'mux';
  return 'other';
}
