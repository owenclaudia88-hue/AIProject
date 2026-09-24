# Ad Account Watchdog

Catches a campaign burning money hours after it starts, not when you next log in.

| | |
|---|---|
| **Runs** | Three times a day — 09:00, 14:00, 19:00 |
| **Cron** | `0 9,14,19 * * *` |
| **Connectors** | Meta Ads, or any ad platform via Zapier. Slack for the alert |
| **Takes** | Three runs a day |

---

## About the word "hourly"

You will see this kind of routine sold as an hourly watchdog. It cannot be, on any normal plan.

Claude's daily run cap is **5 runs on Pro** and **15 on Max**. Hourly is 24. An hourly watchdog would exhaust a Max account before lunch and do nothing else all day.

Three checks a day is what actually fits, and for ad spend it is enough — the thing you are protecting against is a campaign quietly eating a day's budget, not a five-minute blip. If you are on Pro, drop it to once a day at `0 9 * * *` and spend the rest of your allowance elsewhere.

## Set it up

1. **New routine**, name it `Ad Account Watchdog`
2. Paste the instructions and **fill in the thresholds at the bottom**
3. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 9,14,19 * * *`
4. **Connectors**: your ad platform and Slack
5. **Create**

## Instructions

```
Check the ad account for anything going wrong right now.

For every campaign and ad set that is currently active, pull today's
spend, impressions, clicks, click-through rate, and cost per result.
Compare each against the same figures for the last 7 days.

Raise an alert for any of the following, using the thresholds at the end
of these instructions:

- spend today already past the daily budget
- cost per result more than the multiple given below of its 7-day average
- an active ad set that has spent money today and produced no results
- click-through rate less than half its 7-day average
- a campaign that has stopped delivering entirely — spend today is zero
  but it is still switched on
- an ad rejected or in review

Post one Slack message to the channel named below. One message per run,
listing everything found. Put the biggest money at the top.

For each alert, say the numbers and what changed. Do not recommend pausing
anything: you can see today, not the sales that arrive next week.

If nothing crosses a threshold, post nothing at all. Do not post "all
clear" — a channel that only ever contains real problems is one people
keep reading.

--- EDIT BELOW THIS LINE ---

Slack channel: #ads
Cost-per-result alert multiple: 2
Ignore ad sets that have spent under: $10 today
```

## If you don't have an ad-platform connector

Check `claude.ai/customize/connectors` first — the list changes.

If yours isn't there, **Zapier** covers it. Add the Zapier connector, then build a Zap that exposes your ad account's daily figures to it. Everything else in the routine stays the same; only the first line changes, from "pull from the ad account" to "pull today's figures through Zapier".

The same applies to Google Ads, TikTok Ads, LinkedIn and the rest. The routine is about the thresholds, not the platform.

## Before your first run

**The $10 floor matters.** Without it, every ad set that has spent $1.40 and made no sale yet will alert, three times a day, and you will mute the channel inside a week.

**Two times the average is a starting point.** If your cost per result is naturally spiky, use three. If it is stable, 1.5 will catch things earlier.

**Nothing gets paused automatically, by design.** Today's cost per result is not today's return — a campaign that looks terrible on Tuesday can be your best on Friday once the delayed conversions land. This routine tells you; you decide.

## What a good run looks like

Most runs, nothing at all.

> **Lookalike 3%** — $84 spent today, 0 results. 7-day average is 3 results by this hour.
> **70 Specialists — broad** — cost per result $38.20, against a 7-day average of $14.60.
> **Retargeting — 30d** — still active, $0 spent today. It was averaging $22 a day.

## When it goes wrong

**It alerts on everything, every run.** Your thresholds are too tight, or the $10 floor is missing.

**It never alerts and you know something broke.** Check the run history for green runs with empty output — that is it working and finding nothing. If the thresholds are the problem, the fastest test is to set the multiple to 1 for one run and see whether it finds anything at all.
