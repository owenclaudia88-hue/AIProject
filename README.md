# 70 AI Specialists For Claude — Landing Page

A single-file, dependency-free sales landing page for a "70 AI Specialists for Claude" digital product.

## What's here

- `index.html` — the entire page: markup, CSS and JS inlined. No build step, no framework.
- `assets/laptop-mockup.avif`, `assets/ipad-mockup.avif`, `assets/phone-mockup.avif` — the three product mockups.

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

## Notes

The page is responsive down to ~380px and dark-themed throughout.

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
