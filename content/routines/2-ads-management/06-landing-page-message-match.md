# Landing Page Message Match

Checks that the page your ads point at still promises what the ads promise.

| | |
|---|---|
| **Runs** | Mondays, 12:00 |
| **Cron** | `0 12 * * 1` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a week |

---

## The quietest way to waste ad money

Somebody clicks your ad because of a specific sentence in it. They land on a page that says something slightly different. They do not consciously notice the gap — they just feel a small "hm, this isn't quite it" and leave.

That gap is called message match, and it is almost always created by accident. You edit the landing page headline and forget the ads. You launch a new ad angle and never update the page. Nothing breaks, nothing errors, and your conversion rate quietly drops by a fifth.

This routine reads both sides every Monday and tells you where they have drifted apart. It needs no connector at all, because both your ads and your page are public.

## Set it up

1. **New routine**, name it `Landing Page Message Match`
2. Paste the instructions and **put your own URLs at the bottom**
3. **Schedule** → **Weekly** → Monday, 12:00
4. **Connectors**: none. Remove them all — this routine reads public web pages and should have access to nothing else
5. **Environment**: the default cloud environment blocks most outbound traffic. Edit it to **Custom** and allow `facebook.com` plus your own domain, or set **Full**. Without this the routine reads nothing and looks broken
6. **Create**

## Instructions

```
Compare the promises in the running ads against the promises on the
landing page they point to.

For each pairing listed at the bottom:

1. Open the Meta Ad Library URL and list every ad currently running.
   For each, record the first line of the primary text, the headline,
   and the call to action.
2. Open the landing page and record, in order: the headline, the
   subheadline, the first thing asked of the visitor, the price as
   displayed, any guarantee, and any deadline or scarcity claim.

Then report on four things:

1. PROMISE GAPS. Anything an ad claims that the page does not repeat in
   the first screen of content. Quote the ad line and say what the page
   says instead.
2. PRICE AND OFFER MISMATCHES. Any ad that names a price, a discount, a
   bonus or a guarantee that the page does not show. These are the
   expensive ones — someone arriving expecting $29 and seeing $49 is
   gone, and they are gone after you paid for the click.
3. VOCABULARY DRIFT. Words that carry the ads but never appear on the
   page. If three ads lead on "in under an hour" and the page never
   mentions time, that is the gap.
4. DEAD OR REDIRECTED LINKS. Any ad destination that does not load, or
   that redirects somewhere other than where it claims to go.

Rank the findings by how much money is behind them: an issue on the ad
with the most spend, or the longest run time, comes first.

Then write one suggested headline for the page that would match what the
ads are actually promising. One, not five. Say which ad line it is
matching.

Email the result to the connected account, subject "Message match —
[date]".

Report only what you can read on the pages. If you could not load a page,
say so rather than working from memory of what it used to say.

--- EDIT BELOW THIS LINE ---

Pairings:
  Meta Ad Library URL — the landing page URL those ads point to
  Meta Ad Library URL — the landing page URL those ads point to
```

## Finding your own Ad Library URL

Go to `facebook.com/ads/library`, set the country, choose **All ads**, search your own page name, and copy the URL from the address bar. Your own ads are public the same way everyone else's are, and this is the quickest way to see exactly what a stranger sees.

## Before your first run

**The network setting is what catches people.** The default environment allows only a package-registry allowlist, so a routine that browses the open web silently returns nothing. Set **Full**, or **Custom** with `facebook.com` and your domain.

**Run it the day after you change the page.** That is the moment the gap gets created, and the moment it is cheapest to close.

**Expect the first run to find something.** Almost every account has at least one ad still running against a page that moved on. That first finding usually pays for the whole suite.

## What a good run looks like

> **Price mismatch — highest spend.** The ad "Everything you need for $29" has been running 31 days and is your top spender. The page shows $49 with a $29 first-month line further down, below the fold. Somebody clicking that ad sees $49 first.
>
> **Promise gap.** Two ads promise "cancel any time". The page does not use the word cancel anywhere above the fold.
>
> **Vocabulary drift.** Four of your six ads lead on speed — "before your first coffee", "in about twenty minutes". The page headline is about completeness, not speed.
>
> **Suggested headline**, matching the strongest-performing ad line: *Set it up before your first coffee. Cancel any time.*

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then add the **Slack**
connector. Nothing else changes.

## When it goes wrong

**It reports nothing and the run is green.** Network access, every time. Check the environment setting before anything else.

**It says your Ad Library page is empty.** Either the ads genuinely stopped, or the URL is missing the country filter. Rebuild it from the address bar rather than typing it by hand.

**It flags a gap that is not really a gap.** Some drift is deliberate — ads are short, pages are long. Add a line to the bottom section: "The following differences are intentional and should not be reported:" and list them.

**It starts rewriting your whole page.** It is asked for one headline for a reason. If it drifts, add: "Suggest exactly one headline. Do not rewrite any other part of the page."
