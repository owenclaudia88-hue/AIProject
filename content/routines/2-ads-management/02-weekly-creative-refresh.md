# Weekly Creative Refresh

Tells you which ads are tiring, then writes the replacements.

| | |
|---|---|
| **Runs** | Thursdays, 10:00 |
| **Cron** | `0 10 * * 4` |
| **Connectors** | Meta Ads or Zapier, Gmail |
| **Takes** | One run a week |

---

## Why Thursday

New creative needs to be approved, uploaded and live before the weekend, when most consumer spend happens. A Monday report means you act on Wednesday and lose the week.

## Set it up

1. **New routine**, name it `Weekly Creative Refresh`
2. Paste the instructions and **describe your offer at the bottom** — the copy it writes is only as good as what it knows you sell
3. **Schedule** → **Weekly** → Thursday, 10:00
4. **Connectors**: your ad platform and Gmail
5. **Create**

## Instructions

```
Find the ads that are wearing out and write replacements.

For every active ad with meaningful spend in the last 14 days, pull:
- spend, impressions, clicks, click-through rate, cost per result
- frequency, if the platform reports it
- how long the ad has been running

An ad is tiring if any of these is true:
- click-through rate has fallen by a third or more against its first week
- frequency is above 2.5
- cost per result has risen steadily across the two weeks rather than
  bouncing around
- it has been running more than 21 days

List the tiring ads worst first, with the numbers that make the case.

Then, for the three worst, write two replacement variations each. For
every variation give:
- a primary text of 50 to 90 words
- a headline under 40 characters
- one line describing the image or video it needs

Base the new angles on what the surviving ads have in common, not on
generic best practice. If the winning ads all lead with a problem, say so
and write to that.

Email everything to the connected account, subject "Creative refresh —
week of [date]".

Do not write new copy for an ad that is simply new and has not gathered
data yet. Say it needs another week.

--- EDIT BELOW THIS LINE ---

What we sell:
Who it is for:
The one thing that makes it different:
Tone to avoid:
```

## If you don't have an ad-platform connector

Use **Zapier** to expose the ad report, or — if that's more work than it's worth — export the last 14 days as a CSV, drop it in Google Drive, and change the first line to read from that file instead. The copywriting half of this routine works either way, and that is the half that saves the time.

## Before your first run

**Fill in the bottom section.** Without it you get competent, generic ad copy that could sell anything, which is the same as copy that sells nothing.

**Frequency above 2.5 is a rule of thumb**, and it depends on your audience size. A small retargeting pool runs hot naturally. Raise it to 4 for those.

**It won't upload anything.** Deliberately. Ad copy going live without a human reading it is how a bad week becomes an expensive one.

## What a good run looks like

> **Tiring**
> 1. "Blank box" — CTR down from 1.9% to 1.1% over 14 days, frequency 3.4, running 26 days. $340 spent.
> 2. "10x productivity" — cost per result up from $11 to $19, steadily. Frequency 2.1.
>
> The three ads still performing all open on a specific frustration rather than a promise. Both new angles below do the same.
>
> **Replacement A for "Blank box"**
> Primary: You open Claude and it asks what you want. That's the problem...
> Headline: Stop briefing. Start working.
> Image: split screen, empty chat box beside a list of named specialists.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**Every ad is called tiring.** Your account is small enough that two weeks of data is noise. Lengthen the window to 28 days.

**The copy sounds like every other ad.** The bottom section is empty, or too vague. "Who it is for" doing the heavy lifting here — "solopreneurs" is not an answer, "people who bought Claude Pro and still use it like a search engine" is.
