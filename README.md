# 70 AI Specialists For Claude — Landing Page

A single-file, dependency-free sales landing page for a "70 AI Specialists for Claude" digital product.

## What's here

- `index.html` — the landing page: markup, CSS and JS inlined. No build step, no framework.
- `privacy.html`, `terms.html`, `earnings.html` — legal pages, linked from the footer.
- `assets/legal.css` — shared styling for those three pages.
- `assets/laptop-mockup.avif`, `assets/ipad-mockup.avif`, `assets/phone-mockup.avif` — the three product mockups.

## Legal pages

Business name, support email and copyright lines are filled in: **PURE COLLECTIVE LTD**,
**support@aifounderuniversity.com**. Payment-processor mentions were removed and replaced
with generic "third-party payment processor" wording, since no specific provider is named.

**Still templates, not legal advice.** A few `[BRACKETED]` placeholders remain because
they're facts only you can supply — registered address, jurisdiction, currency, analytics/
hosting/delivery providers, and data-retention periods. Fill those in and have a lawyer
review all three pages before you take real payments. Each page carries a visible notice
saying so — delete that box once the page is finalised.

## Deployment path

This is meant to live at **aifounderuniversity.com/70-ai-specialists-for-claude**, not at
the root of that domain. The site needs no code changes to support that: every internal
link and asset path in `index.html` and the legal pages is relative (`assets/…`,
`privacy.html`, `#pricing`, …), never a leading `/`, so it renders correctly at whatever
subpath it's served from.

Getting it onto that exact URL is a hosting decision this repo can't make on its own — it
depends on how `aifounderuniversity.com` itself is hosted:

- **If that domain is also a Vercel project:** add a rewrite in *that* project's
  `vercel.json` routing `/70-ai-specialists-for-claude/(.*)` to this deployment, or import
  this repo as a nested project and assign it the subpath via Vercel's dashboard.
- **If it's a traditional host (cPanel, Netlify, S3, etc.):** upload this repo's files into
  a `70-ai-specialists-for-claude/` folder under that site's web root.
- **If it's a different framework (WordPress, Webflow, Next.js, …):** these are plain
  static files — drop them into whatever that framework uses as its static/public asset
  folder for that path.

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
