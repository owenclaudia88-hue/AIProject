# Competitor Ad Monitor

What your competitors started running this week, and what changed in how they are selling.

| | |
|---|---|
| **Runs** | Mondays, 11:00 |
| **Cron** | `0 11 * * 1` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a week |

---

## The one routine that needs no connector

Meta's Ad Library is public. So is every competitor's pricing page. This routine reads them the way you would, but every week without fail, and it remembers what they looked like last time.

That last part is the value. Nobody notices a competitor quietly dropping their price; everybody notices three months later when it has cost them something.

## Set it up

1. **New routine**, name it `Competitor Ad Monitor`
2. Paste the instructions and **list your competitors at the bottom**
3. **Schedule** → **Weekly** → Monday, 11:00
4. **Connectors**: none needed. Remove them all — this routine touches no accounts and should have access to none
5. **Environment**: the default environment blocks most outbound traffic. Edit it to **Custom** and allow `facebook.com` and your competitors' domains, or set **Full**. Without this the routine will report nothing and look broken
6. **Create**

## Instructions

```
Report on what the competitors listed below are running and saying.

For each competitor:

1. Open their Meta Ad Library page and record every ad currently running:
   the hook in the first line, the offer, the format, and how long it has
   been active. Note which ones are new since last week.
2. Open their main sales page and record the headline, the price, the
   guarantee, and any countdown or scarcity claim.
3. Note what has changed since your last run. If this is the first run,
   say so and record a baseline instead.

Then answer two questions:
- What is the most common angle across everything they are running right
  now? Quote the actual lines, do not paraphrase into marketing language.
- Is anyone running an ad that has been live materially longer than the
  rest? A long-running ad is one that is working, and it is the single
  most useful thing on this page.

Email to the connected account, subject "Competitor watch — [date]".

Record what you can see and what changed. Do not speculate about their
revenue, their spend, or why they made a change.

--- EDIT BELOW THIS LINE ---

Competitors:
  Name — sales page URL — Meta Ad Library URL
  Name — sales page URL — Meta Ad Library URL
```

## Finding a Meta Ad Library URL

Go to `facebook.com/ads/library`, set the country, choose **All ads**, search the brand name, and copy the URL from the address bar. It is public and needs no login.

## Before your first run

**The network setting is the thing that catches people.** The default cloud environment allows only a package-registry allowlist, so a routine that browses the open web silently fails. Set the environment to **Full** network access, or **Custom** with the domains you need.

**The first run is a baseline**, not a report. It has nothing to compare against. The second run is where this starts earning its place.

**Long-running ads are the signal.** Anyone can launch an ad. An ad still running after 60 days is one somebody is choosing to keep paying for.

## What a good run looks like

> **Competitor A** — 14 ads running, 3 new this week.
> New: all three lead on a deadline ("ends Sunday"). Previously they led on the price.
> Longest-running: "Stop starting from scratch", live 74 days. Nothing else is close.
> Sales page unchanged. Price still $27.
>
> **Competitor B** — 4 ads, none new.
> Sales page changed: headline was "The complete system", now "Built for people who ship". Guarantee went from 30 days to 14.
>
> **Across both**, the common angle is time rather than capability. Quoted: "before your first coffee", "in about 90 seconds", "without learning anything new".

## When it goes wrong

**It reports nothing and the run is green.** Network access. This is the routine that hits it, every time.

**It says the Ad Library page is empty.** Either they genuinely have nothing running, or the URL is missing the country filter. Rebuild the URL from the address bar rather than typing it.

**It starts guessing at their strategy.** The last instruction exists to prevent this. If it drifts, add: "Report only what is visible on the page. If you did not read it, do not write it."
