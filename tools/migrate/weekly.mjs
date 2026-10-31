/**
 * The week's new AI Black Magic items, fetched, checked and published.
 *
 *   node weekly.mjs                 # do it
 *   node weekly.mjs --dry           # show what would happen, write nothing
 *   node weekly.mjs --since 2026-10-01
 *
 * It runs on your machine because the login does. You logged in once with
 * auth.mjs; this opens the app headless in that session, which also refreshes
 * the token, and asks each content table for rows created since the newest one
 * we already have. Nothing types a password and nothing is stored anywhere but
 * your own disk.
 *
 * Nobody reviews the result, so the checking has to be the review. Every row is
 * measured against the one on the source site: if it offers a picture, a
 * download or a body in a separate file, we must have got it, or the item waits
 * rather than going live half-made. What passes is written as a small export
 * and handed to the existing ingest, which is upsert-by-id and unchanged.
 *
 * Then it asks the database the same question again, because the only view that
 * matters is the one a member gets. Anything that looks wrong there is hidden
 * again immediately.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadSites, sessionPath, EXPORT_DIR } from './lib.mjs';

const SITE = 'blackmagic';
const DRY = process.argv.includes('--dry');
const sinceArg = (() => {
  const i = process.argv.indexOf('--since');
  return i > -1 ? process.argv[i + 1] : null;
})();

/* The tables that hold things a member would browse. news_feed and
   weekly_highlights are the source site's own front page, not library items.
   custom_gpts is left out since 2026-10-30: the AI Assistants section is our
   own now, and a GPT of theirs links to their ChatGPT account, which is the
   dependency the rebuild removed. automation_templates since 2026-10-31, for
   the same reason: the AI Automation Vault's blueprints are ours, cleaned of
   their accounts and ids, and a new one of theirs would not be. */
const TABLES = ['prompts', 'image_prompts', 'claude_skills', 'guides', 'videos'];

const say = (s = '') => console.log(s);
const OUT = join(EXPORT_DIR, 'blackmagic-weekly');

/* ---------------- where we got to last time ---------------- */

/**
 * Asked of our own library rather than kept in a state file, because a state
 * file can disagree with reality and this cannot: the newest item we hold is
 * the newest item we hold. Twelve hours of overlap, so a row created while last
 * week's run was mid-flight is not skipped forever; the ingest upserts, so
 * seeing one twice costs nothing.
 */
async function lastSeen() {
  if (sinceArg) return new Date(sinceArg).toISOString();
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    select max(source_created_at) as newest from library
     where source_created_at is not null
       and id ~ '^(prompt|image_prompt|skill|gpt|automation|guide|video):'`;
  const newest = rows[0]?.newest;
  if (!newest) {
    say('No AI Black Magic items on file, so taking the last 30 days.');
    return new Date(Date.now() - 30 * 864e5).toISOString();
  }
  return new Date(new Date(newest).getTime() - 12 * 3600e3).toISOString();
}

/* ---------------- the session, and the keys the app itself uses ---------------- */

async function openApp() {
  const sites = await loadSites();
  const site = sites[SITE];
  if (!site) throw new Error(`No "${SITE}" in sites.json.`);

  let storageState;
  try { storageState = JSON.parse(await readFile(sessionPath(SITE), 'utf8')); }
  catch { throw new Error(`No saved session. Run:  node auth.mjs ${SITE}`); }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  const conf = { url: null, anon: null, token: null };
  page.on('request', (req) => {
    const m = req.url().match(/^https:\/\/([a-z0-9]+)\.supabase\.co\//);
    if (!m) return;
    const h = req.headers();
    if (h.apikey && !conf.anon) {
      conf.url = `https://${m[1]}.supabase.co`;
      conf.anon = h.apikey;
      if (/^Bearer\s+/i.test(h.authorization || '')) {
        conf.token = h.authorization.replace(/^Bearer\s+/i, '');
      }
    }
  });

  await page.goto(site.startUrls[0], { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let i = 0; i < 15 && (!conf.anon || !conf.token); i++) {
    await page.waitForTimeout(1000);
    if (i === 5) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  if (!conf.url || !conf.anon || !conf.token) {
    await browser.close();
    throw new Error(`Could not pick up a logged-in session. Run:  node auth.mjs ${SITE}`);
  }

  // Saving it back keeps the refreshed token, so next week starts from a live
  // session rather than one that has aged a week on disk.
  await context.storageState({ path: sessionPath(SITE) });
  return { browser, page, conf };
}

/** A query run from inside the page, as the app itself would run it. */
const fromPage = (page, conf, path) => page.evaluate(async ([url, anon, token, p]) => {
  const r = await fetch(url + p, { headers: { apikey: anon, Authorization: 'Bearer ' + token } });
  if (!r.ok) return { error: r.status + ' ' + (await r.text()).slice(0, 180) };
  return { rows: await r.json() };
}, [conf.url, conf.anon, conf.token, path]);

/**
 * Pull a file down, straight if it is public and through the session if not.
 *
 * Most of what these rows point at sits in public storage, which plain fetch
 * reads happily. Asking the page to do it instead fails on CORS and looks
 * exactly like a missing file — which is what held three perfectly good
 * skills on the first run, each one a published .md anybody can download.
 * So: direct first, the session only as the fallback it is for.
 */
async function grab(page, url) {
  try {
    const r = await fetch(url);
    if (r.ok) {
      return {
        buf: Buffer.from(await r.arrayBuffer()),
        type: r.headers.get('content-type') || ''
      };
    }
  } catch { /* not public, or no route from here — try as the member */ }

  const d = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u);
      if (!r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      return { bytes: Array.from(b), type: r.headers.get('content-type') || '' };
    } catch { return null; }
  }, url).catch(() => null);
  return d ? { buf: Buffer.from(d.bytes), type: d.type } : null;
}

/* ---------------- the run ---------------- */

const { checkItem, downloadUrlFor } = await import('./check-item.mjs');

let browser;
try {
  const since = await lastSeen();
  say(`\nLooking for anything added since ${since.slice(0, 16).replace('T', ' ')}.\n`);

  const opened = await openApp();
  browser = opened.browser;
  const { page, conf } = opened;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'data'), { recursive: true });
  await mkdir(join(OUT, 'files'), { recursive: true });

  const images = [];
  const links = [];
  const held = [];
  let found = 0, passing = 0;

  for (const table of TABLES) {
    const q = `/rest/v1/${table}?select=*&is_published=eq.true`
      + `&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc`;
    const out = await fromPage(page, conf, q);
    if (out.error) { say(`  ${table}: could not read (${out.error})`); continue; }

    const rows = out.rows || [];
    if (!rows.length) {
      /* An empty answer is not proof of a quiet week.
         Supabase answers an unauthorised read with 200 and an empty array, not
         with 401 — row-level security simply returns nothing — so a lapsed
         token and a week with no new items look exactly alike. This run saw
         six videos on three dry runs and none on the real one, published
         everything else, and said "nothing new" with a straight face.

         So an empty result is checked rather than believed: ask the same
         table for one row with no date filter. Rows there mean the week really
         was quiet; nothing there means we are not being allowed to read it,
         and that is a stop rather than a shrug. */
      const probe = await fromPage(page, conf, `/rest/v1/${table}?select=id&limit=1`);
      if (probe.error || !(probe.rows || []).length) {
        throw new Error(
          `${table} came back empty and so did a plain one-row read of it, which means `
          + `this session is no longer allowed to read it rather than that there is `
          + `nothing new. Nothing has been published. Run:  node auth.mjs ${SITE}`);
      }
      say(`  ${table}: nothing new`);
      continue;
    }
    found += rows.length;

    const keep = [];
    for (const row of rows) {
      const got = { files: [] };
      const stem = `${table}__${String(row.id).slice(0, 12)}__`;

      // its picture
      for (const [field, slot] of [['thumbnail_url', 'thumb'], ['example_image_url', 'exampleImage']]) {
        if (!row[field]) continue;
        const f = await grab(page, row[field]);
        if (!f) continue;
        const name = stem + (row[field].split('/').pop().split('?')[0] || 'image');
        await writeFile(join(OUT, 'files', name), f.buf);
        got[slot] = name;
        if (slot === 'thumb') images.push({ table, id: row.id, local_path: `files/${name}` });
      }

      // its body, when it lives in a file of its own
      if (row.html_file_url) {
        const f = await grab(page, row.html_file_url);
        if (f) {
          const name = stem + 'body.html';
          await writeFile(join(OUT, 'files', name), f.buf);
          got.guideHtml = name;
          got.bodyHtml = f.buf.toString('utf8');
        }
      }

      /* Whatever it offers to download — asked for by the same function the
         check uses, so the two can never disagree about what this row has.
         They did once: the check knew a skill keeps its file in `skill_url`
         and this loop was still looking for `file_url`, so three good skills
         were reported as missing a download nothing had tried to fetch. */
      const dl = downloadUrlFor(row);
      if (dl) {
        const f = await grab(page, dl);
        if (f) {
          const name = stem + (dl.split('/').pop().split('?')[0] || 'download');
          await writeFile(join(OUT, 'files', name), f.buf);
          got.files.push(name);
          links.push({ table, id: row.id, kind: 'file', url: dl });
        }
      }

      // An automation's own setup page, which the ingest turns into its button.
      const tc = row.template_content;
      if (tc && typeof tc === 'object' && tc.setupUrl) {
        links.push({ table, id: row.id, kind: 'link', url: tc.setupUrl });
      }

      const problems = checkItem(table, row, got);
      if (problems.length) {
        held.push({ table, id: row.id, title: row.title, problems });
        say(`  ${table}: HELD "${String(row.title).slice(0, 48)}" — ${problems.join('; ')}`);
        continue;
      }
      keep.push(row);
      passing++;
    }

    if (keep.length) {
      await writeFile(join(OUT, 'data', `${table}-full.json`), JSON.stringify(keep, null, 2));
      say(`  ${table}: ${keep.length} ready${rows.length > keep.length ? `, ${rows.length - keep.length} held` : ''}`);
    }
  }

  await writeFile(join(OUT, 'image-map.json'), JSON.stringify({ images }, null, 2));
  await writeFile(join(OUT, 'links.json'), JSON.stringify({ links }, null, 2));

  say(`\n${found} new item(s) on the source site; ${passing} complete, ${held.length} held.`);

  if (!passing) { say('Nothing to publish.\n'); await browser.close(); process.exit(0); }
  if (DRY) {
    say(`\nDry run — written to ${OUT} and nothing published.\n`);
    await browser.close(); process.exit(0);
  }

  await browser.close();
  browser = null;

  /* ---- hand it to the ingests that already work ----

     All three of them, which is the lesson of the first real run. The main
     ingest puts the row on the shelf; it does not carry the long-form body,
     and it says so in its own output — "see ingest-guides" — because a skill's
     or a video's whole text lives in a separate document. Nor does it build
     the tiles for a gallery collection, whose prompts are its only content.

     Running only the first published seven items with a title, a picture and
     a blank page, and nothing in the checking noticed, because it was looking
     for a body in the one place these kinds never keep one. */
  const root = join(import.meta.dirname, '..', '..');
  const run = (args, label) => new Promise((ok, no) => {
    say(`\n${label}…\n`);
    const p = spawn(process.execPath, ['--env-file=.env.local', ...args],
      { cwd: root, stdio: 'inherit', env: { ...process.env, BM_DIR: OUT } });
    p.on('exit', (code) => (code === 0 ? ok() : no(new Error(`${label} exited ${code}`))));
  });

  await run(['scripts/ingest-library.mjs', '--blackmagic-only'], 'Publishing');
  await run(['scripts/ingest-guides.mjs'], 'Fetching the long-form bodies');
  await run(['scripts/ingest-galleries.mjs'], 'Building the gallery tiles');

  /* Everything that comes down carries their name — in a guide, in a README,
     in a plugin's author field. Taking it out once was a morning's work; not
     doing it here would put it back every week. Scoped to what just arrived,
     so it is a handful of files rather than ninety-six. */
  await run(['_rebrand-library.mjs'], 'Taking their name out of the text');
  await run(['_rebrand-files.mjs', '--recent=2'], 'Taking their name out of the downloads');

  /* ---- and check what a member would actually see ---- */
  const { verifyPublished } = await import('./verify-published.mjs');
  await verifyPublished({ since, held });
} catch (err) {
  console.error(`\n${err.message}\n`);
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
}
