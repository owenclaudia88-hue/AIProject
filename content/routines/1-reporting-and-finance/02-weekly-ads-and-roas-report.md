# Weekly Ads & ROAS Report

What the ads actually returned, measured against what the bank says — not against what the ad platform claims.

| | |
|---|---|
| **Runs** | Mondays, 08:30 |
| **Cron** | `30 8 * * 1` |
| **Connectors** | Meta Ads (or your ad platform), Stripe, Gmail |
| **Takes** | One run a week |

---

## Why this one is worth having

Ad platforms report the conversions they can attribute. Stripe reports the money that arrived. Those two numbers are never the same, and the gap between them is the single most useful figure in your advertising.

This routine puts them side by side every Monday so you stop making decisions on one of them alone.

## Set it up

1. **New routine**, name it `Weekly Ads & ROAS Report`
2. Paste the instructions and **fill in the settings at the bottom**
3. **Schedule** → **Weekly** → Monday, 08:30
4. **Connectors**: your ad platform, Stripe, Gmail
5. **Create**

## Instructions

```
Report last week's advertising against actual revenue.

From the ad platform, for the seven days ending yesterday, per campaign:
- amount spent
- impressions, clicks, and click-through rate
- conversions the platform claims, and its reported cost per result

From Stripe, for the same seven days:
- total revenue
- number of first-time customers

Then put them together:

1. Total spend against total revenue. Give the ratio as revenue divided by
   spend, to one decimal place.
2. Spend divided by first-time customers — what a new customer actually
   cost, regardless of what the platform attributes.
3. The gap between platform-reported conversions and Stripe's first-time
   customers. Say which is higher and by how much.

Ignore any campaign that spent less than the floor below — a campaign with
$4 behind it has not earned a place in this report.

Name the best campaign and the worst by spend-per-new-customer. For the
worst, say what you would need to believe for it to be worth keeping.

If the overall ratio of revenue to spend is below the floor set below, say
so in the first line rather than at the end.

Email to the connected account, subject "Ads week ending [date]".

Do not describe the gap between platform and Stripe numbers as tracking
being broken. Some of it always is attribution windows and organic
traffic. Report the size of it and leave the diagnosis to a person.

--- EDIT BELOW THIS LINE ---

Ignore campaigns that spent under: $50 last week
Flag the week if revenue divided by spend falls below: 1.5
Currency: $
```

## Before your first run

**If you run more than one platform**, name them all in the prompt or you will get a partial picture presented as a whole one.

**The "what would you need to believe" question** is doing real work. It turns "this campaign is bad" into something you can actually argue with — a long sales cycle, a high repeat rate — rather than a verdict.

**First-time customers, not all customers.** Counting renewals as ad conversions flatters every campaign you run.

## What a good run looks like

> Spend $310, revenue $1,240 — 4.0x.
>
> 22 first-time customers, so $14.09 each. Meta claims 31 conversions, 9 more than Stripe shows new customers. Some of that is the 7-day click window catching people who were coming anyway.
>
> Best: "Core offer — broad" at $9.40 per new customer.
> Worst: "Lookalike 3%" at $41 per new customer on $164 spent. Worth keeping only if those buyers renew at roughly three times the rate of the others, which nothing in this week's data supports.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**The platform connector isn't there.** Meta Ads is not a default Claude connector for every account. Check it appears at `claude.ai/customize/connectors` before you rely on this one, and if it isn't available, route it through Zapier instead.

**Revenue includes renewals and the ratio looks wonderful.** Add "exclude payments from customers who existed before this week" to the Stripe section.
