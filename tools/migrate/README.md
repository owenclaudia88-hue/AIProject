# Content migration tool

Exports **your own** content out of a platform you're logged into, so it can be
re-hosted in the member area. Runs locally on your machine — it is not part of
the deployed site.

## Why it never asks for your password

You log in yourself, in a real browser window. The tool then reuses that
browser session. Nothing types your password, nothing stores it, and no
credential ends up in this repo. It also means 2FA, captchas and SSO all just
work, because a human is doing the bit that requires a human.

## Setup

```bash
cd tools/migrate
npm install
npx playwright install chromium     # one-off, downloads the browser
```

Then create `sites.json`, one entry per platform. Easiest way — let the helper
write it:

```bash
node init-site.mjs course https://app.kajabi.com/login https://app.kajabi.com/admin/products
```

It derives the crawl fence from the start URL and prints what it chose. Run it
once per platform; existing entries are kept.

Or copy `sites.example.json` to `sites.json` and write it by hand. Either way
`sites.json` is gitignored. The fields:

| key | meaning |
|---|---|
| `loginUrl` | where the login form lives |
| `startUrls` | where crawling begins — usually your course/product index |
| `includePatterns` | regexes; a link is only followed if it matches one |
| `excludePatterns` | regexes; checked first, so `/logout` and `/billing` stay untouched |
| `contentSelector` | CSS selector for the main content region (`main`, `#content`, …) |
| `maxPages` | hard cap, so a bad pattern can't crawl forever |
| `delayMs` | pause between pages — be kind to a platform you pay for |
| `downloadExtensions` | which linked files to pull down |

Get `excludePatterns` right before the first real run. `/logout` especially —
a crawler that follows it kills its own session on page three.

## Running it

```bash
node auth.mjs course              # log in by hand, press Enter
node crawl.mjs course --dry       # see what it would do, writes nothing
node crawl.mjs course --limit 10  # small real run to check the output
node crawl.mjs course             # the full export
```

Start with `--dry`, then `--limit 10`. Check the output actually looks like
your content before letting it loose on 300 pages.

## When the crawler isn't enough

`crawl.mjs` follows `<a href>` links. That's fine for page-based platforms, but
app-style ones — Circle, GoHighLevel, anything React or Vue — render from JSON
and navigate by click handler. There are often no crawlable links at all, and
lists load on scroll.

For those, use `capture.mjs`:

```bash
node capture.mjs community
```

It opens a browser with your session and then gets out of the way. **You** browse
— open every space, every lesson, scroll lists to the bottom — and it records
every JSON response the app receives. You get the platform's own structured
data rather than scraped text, and because a human is navigating, SPAs, modals
and infinite scroll all just work. Press Enter to stop.

    export/<siteKey>/api/<n>-<slug>.json   one file per response
    export/<siteKey>/api-index.json        url, method, status, size, shape

Narrow it with `--filter '<regex>'` if the app is chatty (analytics, websockets,
presence pings). By default it takes JSON from the host you started on.

Tip: anything you don't click, it doesn't capture. Be systematic.

## Output

```
export/<siteKey>/
  pages/<slug>.html     content region, raw HTML
  pages/<slug>.txt      visible text, for reading and re-writing
  files/…               PDFs, ZIPs etc. pulled through your session
  manifest.json         every page, its videos and its files
```

It is **resumable** — pages already on disk are skipped, so stopping and
re-running picks up where it left off.

## Videos are listed, not downloaded

`manifest.json` records every embed it finds with its type (`youtube`,
`vimeo`, `wistia`, `bunny`, `loom`, `mux`) and the lesson it belongs to.

They're deliberately not scraped. Those URLs are signed and expire, so a
downloaded copy rots; and video belongs on a real video host with proper
streaming rather than in Vercel Blob. Re-upload to Bunny or Mux, then use the
manifest to map each new video back to the right lesson.

## A caution

This is for content **you own or have a licence to move**. Pointing it at
someone else's paid product is copyright infringement, and the same clause in
your own `terms.html` forbids buyers from doing it to you.
