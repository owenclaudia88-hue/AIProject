# 70 AI Specialists For Claude — Landing Page

A single-file, dependency-free sales landing page for a "70 AI Specialists for Claude" digital product.

## What's here

- `index.html` — the landing page: markup, CSS and JS inlined. No build step, no framework.
- `checkout.html` + `assets/checkout.css` — the checkout page.
- `privacy.html`, `terms.html`, `earnings.html` — legal pages, linked from the footer.
- `assets/legal.css` — shared styling for those three pages.
- `assets/laptop-mockup.avif`, `assets/ipad-mockup.avif`, `assets/phone-mockup.avif` — the three product mockups.
- `vercel.json` — rewrites that serve the site at the `/70-ai-specialists-for-claude` subpath as well as the root.

## Checkout

`checkout.html` is a two-column checkout: contact and billing form on the left, sticky order
summary on the right (product, the 4 free Sprints, totals, guarantee, trust). Under 900px the
summary moves **above** the form so the price is seen before any typing. The pricing CTA on
the landing page links here.

**It does not take payments yet, by design.** Two things are deliberately missing:

1. `#payment-element` in step 3 is an empty mount point with a placeholder. Render your
   provider's own hosted card fields into it (Stripe Elements, a GoHighLevel embed, …) and
   delete the placeholder. **Do not replace it with plain `<input>` fields** — keeping card
   entry inside the provider's iframe is what keeps this site out of PCI scope.
2. The `submit` handler validates the contact and billing fields, then stops and shows a
   notice. Replace that branch with the real call — create a PaymentIntent, redirect to
   hosted checkout, or submit to your provider.

Until both are done the form can collect details but can never take money, which is the safe
failure mode if it goes live early. Validation, error states and the summary are all finished.

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
