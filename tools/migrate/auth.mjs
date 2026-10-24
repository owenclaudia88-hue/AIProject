/**
 * Step 1 of 2 — capture a logged-in session.
 *
 *   node auth.mjs <siteKey>
 *
 * Opens a real Chrome window at the site's login page. You log in by hand —
 * password manager, 2FA, captcha, SSO, whatever it takes. When you're through
 * and looking at the content, come back to the terminal and press Enter.
 *
 * The browser's cookies and localStorage are written to .sessions/<siteKey>.json
 * so crawl.mjs can reuse them. That file is gitignored and is the only place
 * credentials-derived state lives — no password is ever typed into this tool,
 * stored by it, or committed.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { loadSites, SESSION_DIR, sessionPath } from './lib.mjs';

const siteKey = process.argv[2];
if (!siteKey) {
  console.error('Usage: node auth.mjs <siteKey>');
  process.exit(1);
}

const sites = await loadSites();
const site = sites[siteKey];
if (!site) {
  console.error(`No site "${siteKey}" in sites.json. Found: ${Object.keys(sites).join(', ') || '(none)'}`);
  process.exit(1);
}

console.log(`\nOpening ${site.loginUrl}`);
console.log('Log in as normal, navigate to the content area, then press Enter here.\n');

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
await page.goto(site.loginUrl, { waitUntil: 'domcontentloaded' });

/* --auto saves on its own once the window has left the login page and stayed
   away for a few seconds, for when the terminal is not somewhere the person
   can easily press Enter - or the sign-in is a magic link pasted into the
   window. Up to thirty minutes. */
if (process.argv.includes('--auto')) {
  console.log('Waiting for you to finish signing in in that window (saves by itself)...');
  const onLogin = () => { const u = page.url(); return u.startsWith(site.loginUrl) || /\/(auth|login|sign-?in)\b/i.test(u); };
  let away = 0;
  for (let i = 0; i < 900 && away < 4; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    away = page.isClosed() ? 0 : (onLogin() ? 0 : away + 1);
  }
  if (away < 4) { console.error('Still on the sign-in page after 30 minutes. Nothing saved.'); await browser.close(); process.exit(1); }
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Press Enter once you are logged in... ');
  rl.close();
}

const url = page.url();
await mkdir(SESSION_DIR, { recursive: true });
const state = await context.storageState();
await writeFile(sessionPath(siteKey), JSON.stringify(state, null, 2));

console.log(`\nSaved session for "${siteKey}"`);
console.log(`  cookies      : ${state.cookies.length}`);
console.log(`  origins      : ${state.origins.length}`);
console.log(`  last page    : ${url}`);
console.log(`  written to   : ${sessionPath(siteKey)}`);
console.log(`\nIf that last URL is a good starting point, put it in startUrls.`);
console.log(`Then run:  node crawl.mjs ${siteKey}\n`);

await browser.close();
