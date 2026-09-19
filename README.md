# 70 AI Specialists For Claude — Landing Page

A single-file, dependency-free sales landing page for a "70 AI Specialists for Claude" digital product.

## What's here

- `index.html` — the landing page: markup, CSS and JS inlined. No build step, no framework.
- `checkout.html`, `success.html` + `assets/checkout.css` — Stripe checkout and its result page.
- `api/` — Vercel serverless functions for Stripe (PaymentIntent + webhook).
- `privacy.html`, `terms.html`, `earnings.html` — legal pages, linked from the footer.
- `assets/legal.css` — shared styling for those three pages.
- `assets/laptop-mockup.avif`, `assets/ipad-mockup.avif`, `assets/phone-mockup.avif` — the three product mockups.
- `vercel.json` — rewrites that serve the site at the `/70-ai-specialists-for-claude` subpath as well as the root.

## Checkout (Stripe)

`checkout.html` is a two-column checkout: the form on the left, sticky order summary on the
right. Under 900px the summary moves **above** the form so the price is seen before any
typing. The landing page's pricing CTA links here.

The form is a single box with two tabbed steps — **Login Info** (name, email) and **Billing
Info** (address, card) — rather than separate stacked panels, which keeps it compact. Step 2
is gated: the tab and the *Continue To Step #2* button both refuse to advance until step 1
validates, though you can always tab back. Card brand badges and a "100% Secure & Safe
Payments" line sit under the box.

Payment uses **Stripe Payment Element**. Card details are entered inside Stripe's iframe and
never touch this site or its server, which keeps you out of PCI scope. There are no card
inputs in the markup on purpose — don't add any.

### Files

| File | Role |
|---|---|
| `checkout.html` | Form, validation, mounts the Payment Element, calls `confirmPayment` |
| `success.html` | Where Stripe redirects after payment; reports the real status |
| `api/create-payment-intent.js` | Creates the PaymentIntent, returns `clientSecret` + publishable key |
| `api/stripe-webhook.js` | Verifies Stripe signatures; **where fulfilment belongs** |

### Setup

1. `npm install`.
2. Create `.env.local` (already gitignored — **never commit it**) from `.env.example`:
   `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `PRICE_AMOUNT=100`, `PRICE_CURRENCY=usd`.
3. Set the same variables in **Vercel → Settings → Environment Variables**. The deployed
   site reads them from there, not from the repo.
4. Add a webhook in the Stripe dashboard pointing at
   `https://yourdomain.com/api/stripe-webhook`, subscribed to `payment_intent.succeeded`,
   `payment_intent.payment_failed` and `charge.refunded`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.

### Running it locally

    npm run dev        # http://localhost:3000

`scripts/dev-server.mjs` serves the static pages and runs `/api` the way Vercel does, so the
whole flow works locally. Stripe.js allows `localhost` over plain HTTP; anywhere else needs
HTTPS. For webhooks, run `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

### Two things that matter

**The price is server-side.** `PRICE_AMOUNT` is read from env inside
`create-payment-intent.js` and never accepted from the request body, so the amount can't be
edited in the browser. If you change the price, change the env var *and* the figures shown in
`checkout.html` and the landing page.

**Fulfilment belongs in the webhook, not on the success page.** A browser redirect can be
closed, blocked or replayed, so it isn't proof of payment. The `payment_intent.succeeded`
branch of `api/stripe-webhook.js` has a marked TODO — send the product email there, and make
it idempotent (Stripe retries on failure, so check whether that PaymentIntent was already
fulfilled).

## Refunds

Refunds are deliberately friction-free: one email to **support@aifounderuniversity.com**, no
forms and no reason required. The policy lives in `terms.html#refunds` and covers one-off
purchases (14-day money-back) and recurring memberships (cancel any time, refund on the
first payment or on a surprise renewal). It is linked from the footer of every page and
spelled out in the FAQ, so a customer never has to hunt for it.

## Branding

The logo is **AI Founder University** on its own, with no product attached, so it carries
over unchanged to any other product built under the same business. The product name
("70 AI Specialists for Claude") sits in the header's right-hand cluster alongside the
price and CTA, where it identifies the page rather than the company. It is hidden on
phones, where the fixed bottom bar already names the product next to the price.

The legal pages carry the same standalone logo and no product CTA, since they apply to the
whole site rather than this one landing page. Their logo and footer "Home" link point at
`/` so they stay correct wherever the site root ends up.

## Legal pages

Written to be **general**: they cover any product, course or membership sold under
**AI Founder University** at aifounderuniversity.com, rather than being scoped to this one
landing page. Contact point throughout is **support@aifounderuniversity.com**.

There are no bracketed placeholders and no template notice left — nothing needs filling in
to publish them. Deliberately kept out, so there is nothing to maintain until the business
needs it:

- no registered postal address (email is the stated contact)
- no named jurisdiction — the governing-law clause refers to where the business is
  established and preserves local consumer rights
- no named currency, payment processor, analytics, hosting or delivery vendor — the privacy
  policy lists provider *categories* instead

Worth doing before taking significant revenue: have a lawyer read them, and add a
registered address and jurisdiction if the business is incorporated somewhere specific.

## The content library

Everything in the member area outside the course player comes from `export/blackmagic/data/*-full.json`
— complete table dumps, one file per content type. The paginated `NNN-GET-*.json`
captures next to them are partial (whatever the page happened to fetch while browsing)
and are **not** what the ingest reads. If something looks missing, check the `-full`
file first; it has almost certainly been there all along.

### What lands where

```
prompts-full.json         901 → kind 'prompt'        content → body, instructions → meta.howTo
image_prompts-full.json   171 → kind 'image_prompt'  gallery_prompts → library_gallery (44 collections)
claude_skills-full.json    67 → kind 'skill'         instructions → body, skill_url → downloadable .md
videos-full.json           64 → kind 'video'         video_url/duration/instructor → meta
automation_templates       20 → kind 'automation'    template_content → body
custom_gpts-full.json      15 → kind 'gpt'           instructions → body, starters → meta
guides-full.json            9 → kind 'guide'         content → body
```

The fixed columns (`title`, `description`, `body_html`, `category`, `thumb_key`) hold what
every kind has. Everything else goes in two places:

- **`library.tags`** — `tags`, `categories` and `search_keywords` merged and de-duplicated.
  This is what draws the chips under an item's title. A prompt typically carries its
  `category` plus its `categories`, which is why SWOT Analysis Strategist shows both
  *Business Strategy* and *Sales & E-commerce*.
- **`library.meta`** (jsonb) — whatever is specific to a kind: `howTo`, `promptItems`,
  `promptType`, `difficulty`, `useCases`, `modelCompatibility`, `videoUrl`, `duration`,
  `instructor`, `starters`, `capabilities`, `fileKey`. A new field needs no migration.

### body_html never falls back to the description

`bodyOf()` deliberately returns null rather than the description. A video has no body; a
gallery collection's content is its tiles. Falling back made those items render their
description twice and hid the fact that something was missing — the reader now asks
"is there a body?" and gets an honest answer.

### Long-form guides

16 skills and 42 videos do not keep their content in a text column at all — they
point at `html_file_url`, a complete standalone web page with its own `<head>`, its
own light-theme stylesheet and its own hero banner. Missing this is why Brand Kit and
YouTube Video Factory showed a title, some chips and nothing else.

`scripts/ingest-guides.mjs` takes those documents apart rather than framing them, so
the content lives on this platform instead of inside someone else's page:

- keeps the `<body>`, drops `<style>`, `<script>` and the document shell
- drops the hero — the reader already renders the title, blurb and download button
  natively from the item's own fields, so keeping it would duplicate all three
- mirrors all 294 images into Blob as WebP and rewrites `src` to the gated URL
- repoints the guide's own download link at our copy of the file
- keeps the class names. All 58 guides share one markup vocabulary (`section-label`,
  `callout`, `feature-card`, `instruction-block`, `step`, `table-wrap`…), so the member
  area styles them under `.guide` and they come out in our own dark theme.

It is parsed with `node-html-parser`, not regex — the hero and container nest several
levels and string surgery leaves orphaned fragments behind. Output goes to
`library_guides`, kept out of `library.meta` so the catalog queries stay light.

### Where a download comes from

Most skills name their file in `skill_url`. Four do not, and keep it only as a link
inside their guide — so the ingest looks there too, which takes downloads from 61 to
65 of 67. Two genuinely have none anywhere. Storage filenames carry an upload stamp
(`1778487590258-c4uoswxow5o-brand-kit.skill`), which is stripped for display.

### Run them in this order

```bash
npm run ingest:all      # ingest -> guides -> fundamentals -> galleries
```

They are separate because they take wildly different amounts of time, but they
are not independent: `guides` lifts the read time and level out of an article's
hero and merges them onto the item, and `fundamentals` clears the body of the
guides whose article it inlines. Both write into rows `ingest` owns.

`upsertLibraryItem` therefore **merges** `meta` rather than replacing it. It used
to assign, which meant every run of the main ingest silently deleted the hero
facts all 56 articles had — nothing errored, the pills just quietly vanished.
Keys the main ingest sets still win; keys it knows nothing about survive.

### Two jobs, on purpose

```bash
npm run ingest      # metadata: ~1250 rows, a couple of minutes
npm run galleries   # the 2,060 gallery images, much slower
npm run guides      # the 58 long-form guides and their 294 images
```

`ingest` also mirrors each skill's `.md` into Blob so it can be served through the gated
download endpoint rather than linking to someone else's storage.

`galleries` fetches every tile's original PNG (~2 MB), re-encodes it to 800px WebP and
stores that. Full-size originals are not mirrored on purpose: a 41-tile gallery of 2 MB
PNGs is ~86 MB per page view. The prompt text is the product; the picture illustrates it.
Pass `--width=` to change the size or `--limit=` to do a few collections first.

Both are re-runnable and resumable — a tile whose asset already exists is skipped, so an
interrupted run picks up where it stopped. Both retry transient Neon errors; over
thousands of single-statement HTTP calls an occasional `ECONNRESET` is normal and is not
a reason to lose the run.

### How an item is laid out

`/api/library/item` returns the item plus its `tags`, `meta`, `gallery` tiles, a gated
`download` link and a few `related` items. The reader assembles from that:

- chips from category + tags
- a *How to use this* panel from `meta.howTo` (the item's own wording — there are 56
  distinct variants, so it is real content, not boilerplate)
- the body in a titled panel with its own copy button, named per kind (*The Prompt*,
  *The Skill*, *The Template*…)
- a **stack** (`meta.promptType === 'stack'`, 15 of them) renders one panel per part,
  each separately copyable, instead of one wall of text
- a gallery grid where each tile reveals its own prompt and copies it
- a Download button when the item ships a file
- a player when the item has a video

## Lesson toolbar: comments, wide mode, bookmarks

Three icons sit at the top right of the lesson player, left to right:

| Icon | What it does | Where it lives |
|---|---|---|
| 💬 Comments | Opens the course discussion in a column between the lesson and the lesson rail | `comments` table |
| ▤ Widen lesson | Hides the lesson rail so the lesson gets the full width | `localStorage` (`afu_wide`) |
| 🔖 Bookmark | Saves the lesson to the **Bookmarks** view in the sidebar | `bookmarks` table |

### Comments

One thread per **course**, not per lesson — every member sees every comment, and each one is
labelled with the lesson it was posted from. Replies hang off `parent_id`, so an admin answer
sits under the question it answers.

- `GET  /api/comments/list?course=<slug>` → `{ comments, isAdmin }`
- `POST /api/comments/create` → `{ course, lessonId?, lessonTitle?, parentId?, body, displayName? }`
- `POST /api/comments/delete` → `{ id }`

Things worth knowing:

- **Emails never reach the browser.** The list endpoint returns a display name only, plus
  `canDelete` so the UI knows which delete buttons to draw. Ownership is re-checked on the
  server for every delete — the flag is a hint, not the permission.
- **Display names.** A member sets theirs the first time they post (the name box above the
  composer); it is stored on `customers.name`. Until then they show as their email
  local-part, prettified — `dan.p@…` becomes "Dan P".
- **Admins** are whoever is listed in `ADMIN_EMAILS` (comma-separated). They get the orange
  *Admin* badge and can delete any comment.
- **Deletes are soft.** A comment that already has replies stays in the thread as "This
  comment was removed", so an answer never loses its question. One with no replies vanishes.
- Bodies are stored and rendered as **plain text** — never HTML — and are capped at 4000
  characters server-side.

### Bookmarks

Per member, stored server-side, so they follow someone between devices. (Favorites and
lesson progress are still `localStorage` — they do not.)

- `GET  /api/bookmarks/list` → `{ bookmarks }`
- `POST /api/bookmarks/toggle` → `{ lessonId, course, title? }` → `{ bookmarked }`

The toggle returns the state the lesson ended up in and the button settles on that answer
rather than its own guess, so a double-tap cannot desync it. Saved lessons appear under
**Bookmarks** in the sidebar, grouped by course; clicking one opens the player at that lesson.

### Schema

`schema.sql` is the readable source of truth, but nothing needs running by hand —
`ensureSchema()` in `lib/db.js` creates `comments`, `bookmarks` and the `customers.name`
column on the first request after deploy, the same way it does for every other table.

## Deployment path

`vercel.json` makes this project serve the site at **both**:

- `aifounderuniversity.com/` (the root), and
- `aifounderuniversity.com/70-ai-specialists-for-claude`

via three rewrites. That works because every internal link and asset path in the HTML is
relative (`assets/…`, `privacy.html`, `#pricing`) and never starts with `/`, so the page
resolves correctly whether or not the URL has a trailing slash:

| URL | Rewrite that fires | `assets/x.avif` resolves to |
|---|---|---|
| `/70-ai-specialists-for-claude` | rule 1 → `/index.html` | `/assets/x.avif` (direct) |
| `/70-ai-specialists-for-claude/` | rule 2 → `/index.html` | `/70-…/assets/x.avif` → rule 3 → `/assets/x.avif` |

### Switching it off the root later

Right now the root and the subpath both show this landing page. When the main site is ready
to take over `aifounderuniversity.com/`, pick one:

1. **Main site becomes a different Vercel project (most common).** In the Vercel dashboard,
   move the `aifounderuniversity.com` domain onto that project, then in *its* `vercel.json`
   add a rewrite sending `/70-ai-specialists-for-claude/:path*` to this project's
   deployment URL. This repo then no longer needs its own domain.
2. **Keep everything in this project.** Replace `index.html` at the root with the main
   site's homepage and leave the rewrites as they are — the landing page keeps working at
   the subpath, served from the same files.
3. **Subpath only, no root landing page.** Keep the rewrites and point `/` at whatever
   should live there; nothing in this repo needs to change for the subpath to keep working.

Whichever you choose, the landing page itself needs no code changes — it is subpath-safe by
construction.

## Sections

1. Announcement bar + sticky header with price and CTA
2. Hero — two columns: copy left (rating pill, eyebrow, headline, sub, CTA), CSS 3D product box with orbiting chips and the 10x block right
3. "The Shocking Claude Gap" comparison table
4. Value proposition + CTA
5. Five key benefits
6. Testimonial carousel (3 slides, profile photos, arrows + dots, 7s autoplay)
7. System overview + two-series line chart (Jan-Jun growth) + CTA
8. 20-item capability list
9. Urgency / market-timing block
10. "What changes from day one" (6 cards)
11. 4 hands-on Sprints
12. Problem/solution + 7%/93% donut chart
14. Laptop mockup image ringed by six floating Specialist pills
14. Blank-window vs. system comparison
15. What's inside (70 / 10,000+ / 4 / $0-per-month) + phone mockup
16. Eight Specialist categories
17. Market-timing stats (42.3%, 2.5M)
18. Review wall
19. Three-step "this is all it takes"
20. Single-package pricing ($1 launch price, down from $285)
21. FAQ accordion
22. Final CTA + footer with legal disclaimers

## Running it

Open `index.html` in a browser. That's it.

For a local server:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Any static host works. For GitHub Pages: repo **Settings → Pages → Source: Deploy from a branch → `main` / root**.

## Customising

- **Colours** — the palette lives in the `:root` block at the top of the `<style>` tag (`--accent`, `--bg`, `--txt`, …).
- **Checkout links** — the `Get Instant Access For $1` button in the `#pricing` section points at `href="#"`. Swap in your Stripe/Gumroad/ThriveCart URL.
- **Copy** — all text is plain HTML in document order; edit in place.
- **Fonts** — Inter, loaded from Google Fonts. Remove the `<link>` tags to fall back to system fonts.

## Scroll reveals

Section copy, cards and media fade up as they enter the viewport, staggered
within each section. The `.reveal` class is added by JS at runtime, so with
JS disabled everything simply renders visible - nothing is hidden by default
in the markup. Honours `prefers-reduced-motion`.

## Notes

The page is responsive down to 360px and dark-themed throughout, verified with
no horizontal overflow at 360 / 390 / 414 / 768px.

On phones the sticky header is dropped in favour of a fixed bottom checkout
bar (price + CTA) that slides in once the hero has scrolled away and hides
again over the pricing section, and the hero reorders to text -> image -> button.

The hero composition is never taken apart on small screens: the stage stays
660x620 internally and is scaled as a single piece through `.hero_visual`, whose
height is set per breakpoint to match the scaled result.

Three other things change shape on phones (<= 560px) rather than just reflowing:

- **The gap table** becomes one card per task with each value labelled, so the
  "With 70 AI Specialists" column is on screen instead of scrolled past.
- **The line chart** drops its y-axis numbers (an illustrative index, not real
  units) and scales the remaining labels up, so the full Jan-Jun span fits.
- **The donut** hides its SVG callouts for an HTML legend, and JS crops its
  viewBox to the ring so there is no dead space.

**No image assets.** The product box, the laptop, both charts and the Claude
starburst are all CSS and hand-authored inline SVG, so everything is editable in
place and there is nothing to host.

**Two exceptions, both placeholders you should replace:**

- **Testimonial and review photos** load from `i.pravatar.cc`. They are stock faces, not
  your customers. Each `<img>` falls back to a gradient initials avatar if the
  request fails, so the page never breaks — but swap in real photos before
  launch.
- **Testimonial and review copy** is carried over from the reference page. A
  name plus a photo plus a quote reads as a real person's endorsement, so
  replace these with testimonials you actually collected.

### Chart colors

The two charts use violet `--violet` against a deliberately recessive gray
`--neutral-series`. Both series are direct-labeled, so the chart never relies on
color alone to tell them apart.
