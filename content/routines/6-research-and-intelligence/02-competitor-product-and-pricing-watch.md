# Competitor Product & Pricing Watch

What your competitors changed this week, in a business where nobody announces anything.

| | |
|---|---|
| **Runs** | Mondays, 07:00 |
| **Cron** | `0 7 * * 1` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a week |

---

## Changes nobody tells you about

A competitor raises their price. Another adds the feature your customers keep asking you for. A third quietly removes their free tier and stops mentioning a market they used to serve.

None of these are announced. They appear on a page one Tuesday, and you find out months later when a prospect mentions it on a call and you have nothing to say.

This routine reads their pages every Monday and remembers what they said last week. The remembering is the valuable part — a single reading of a competitor's site tells you almost nothing, and the difference between two readings tells you what they are doing.

This is the product and pricing counterpart to the Competitor Ad Monitor. That one watches what they say in market. This one watches what they actually sell.

## Set it up

1. **New routine**, name it `Competitor Product & Pricing Watch`
2. Paste the instructions and **list your competitors' pages at the bottom**
3. **Schedule** → **Weekly** → Monday, 07:00
4. **Connectors**: none. Remove them all
5. **Environment**: **Full**, or **Custom** with your competitors' domains. The default blocks outbound traffic and this routine does nothing else
6. **Create**

## Instructions

```
Record what each competitor is currently selling, and what changed since
last week.

For each competitor listed at the bottom, read every page given and
record, factually:

PRICING
- every plan, its name, its price, and its billing period
- what each plan includes and what it excludes
- any free tier, trial, or money-back guarantee, with the terms
- anything priced per user, per seat, per usage, or as an add-on
- any minimum term or setup fee

PRODUCT
- the headline capability, as they describe it
- the feature list, as published
- anything described as new, beta, or coming soon
- any integration or connector they advertise
- who they say it is for, in their words

POSITIONING
- the main headline and subheadline
- who they name as the alternative, if anyone
- what they emphasise first, which is what they think their strongest
  argument is

Then the part that matters: WHAT CHANGED since your last run. Prices,
plan structure, features added or removed, wording, audience, anything
that disappeared. If this is the first run, say so and record a baseline
instead — a first run has nothing to compare against and should not
pretend otherwise.

Rank changes by significance: a price change first, then a change to
what is included, then features, then wording.

Then two things, kept short:

1. WHAT THIS MEANS FOR US. Only where a change actually affects us. Be
   specific and be sparing: most competitor changes do not matter, and a
   report that finds a strategic implication in every wording tweak is
   noise dressed as intelligence.

2. WHAT THEY HAVE THAT WE GET ASKED ABOUT. Anything on their list that
   is on the list at the bottom of things our own customers request.
   This is the most directly useful line in the report.

Record only what is published on the page. Do not speculate about their
revenue, their headcount, their strategy or their reasons. If a page did
not load, say so rather than working from memory of a previous run.

Email the result to the connected account, subject "Competitor watch —
[date]".

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Competitors — name, then their pricing page, product page, and changelog
if they have one: [e.g. Competitor A — /pricing — /features — /changelog]

Things our own customers keep asking us for: [e.g. scheduled exports, a
  phone view, multi-currency]
```

## Before your first run

**The network setting is the thing.** Default environments block this entirely.

**The first run is a baseline, not a report.** It has nothing to compare against. The second run is where this starts being worth reading, and the tenth is where it becomes genuinely valuable, because by then you can see direction rather than position.

**Include changelogs and release-note pages if they publish them.** Those are the highest-signal pages a competitor has, and most people never look at them.

**Fill in what your customers ask for.** It turns a competitor report into a product decision. When a competitor ships the third-most-requested thing on your own list, that is a fact worth having within a week.

## What a good run looks like

> **3 competitors. 4 changes.**
>
> **Competitor A — price change**
> Starter was £29/mo, now **£39/mo**. Annual went from £290 to £390. The Pro tier is unchanged at £99.
> Their free trial went from 30 days to 14.
> *What this means:* your £49 now sits between their Starter and Pro rather than above their Starter. That is a better position than you had last week and it is worth saying out loud on sales calls.
>
> **Competitor B — feature added**
> "Scheduled exports" appeared on the features page, not on their changelog.
> *What they have that we get asked about:* scheduled exports is second on your own request list. Eleven of your customers have asked for it this year.
>
> **Competitor B — audience change**
> Headline was "for growing teams", now "for finance teams". The words "small business" have been removed from the pricing page entirely.
> *What this means:* they may be moving upmarket. Worth watching for two or three weeks before concluding anything.
>
> **Competitor C — no change.** Pages identical to last week.
>
> *Note: Competitor A's changelog page did not load this week.*

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to your channel and add the **Slack** connector.

## When it goes wrong

**Everything is unchanged, every week.** That may be true — most companies do not change their pricing page often. But check that the pages are actually loading first, because "could not read it" and "nothing changed" look identical in the output unless the routine says which it was.

**It reports trivial wording changes as significant.** Tighten it: "Do not report a wording change unless it changes the meaning, the audience, or what is included."

**It speculates about their strategy.** The last instruction exists for this. If it drifts, harden it: "Every statement must be something you read on a page. If you are inferring, do not write it."

**Prices are wrong.** Many sites show different prices by country or currency. Add to the bottom section which country's prices you want, and expect some variation regardless.

**It cannot read a competitor's page at all.** Some sites block automated reading entirely. Nothing to be done about that one — note it and rely on the others.
