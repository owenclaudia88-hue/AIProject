# Budget Pacing & Reallocation

Tells you on the 10th whether you are on course to overspend, instead of on the 30th.

| | |
|---|---|
| **Runs** | Mondays, 09:00 |
| **Cron** | `0 9 * * 1` |
| **Connectors** | Meta Ads or Zapier, Stripe, Gmail |
| **Takes** | One run a week |

---

## What pacing actually means

Pacing is the boring word for a simple question: at the rate you are currently spending, where will the month end up?

Most people answer it by looking at yesterday and guessing. That works until a weekend runs hot, or a campaign you forgot about starts delivering again, and the month closes 40% over. By the time you notice, the money is gone — you cannot un-spend it.

This routine answers the question every Monday, with the arithmetic done, and then does the harder part: it tells you which campaigns should be getting more of the remaining budget and which should be getting less.

## Set it up

1. **New routine**, name it `Budget Pacing & Reallocation`
2. Paste the instructions and **put your monthly budget at the bottom**
3. **Schedule** → **Weekly** → Monday, 09:00
4. **Connectors**: your ad platform, Stripe, and Gmail
5. **Create**, then **Run now** so you get this week's answer immediately

## Instructions

```
Report on ad budget pacing and where the remaining budget should go.

First, the pacing arithmetic:

- Total spend so far this calendar month, across all campaigns.
- Days elapsed this month, and days remaining.
- Average daily spend so far.
- Projected month-end total, if the current daily average continues.
- The difference between that projection and the monthly budget below,
  in money and as a percentage.
- What the daily spend would need to become, from tomorrow, to land
  exactly on budget.

Say this plainly in two or three sentences before any tables.

Second, where the money is working. For each active campaign this month:

- spend
- results, and cost per result
- revenue attributed, if the platform reports it
- number of Stripe payments in the same period, as a reality check on
  the platform's own numbers

Rank the campaigns by cost per result, cheapest first.

Third, a recommendation:

- Name the one or two campaigns that are clearly cheaper per result than
  the account average and are not limited by their own budget. These are
  where the remaining money should go.
- Name any campaign whose cost per result is more than double the account
  average and that has spent more than the floor below. These are where
  it should come from.
- Give a specific suggested daily budget for each one you name.

Do not suggest moving money out of a campaign that has spent less than
the floor below. It has not earned an opinion yet.

Email the whole thing to the connected account, subject "Budget pacing —
[date]".

Do not change any budget. Recommend only.

--- EDIT BELOW THIS LINE ---

Monthly ad budget: $3,000
Ignore campaigns that have spent under: $50 this month
```

## If you don't have an ad-platform connector

Check `claude.ai/customize/connectors` first, then fall back to **Zapier** — a Zap that pushes your daily campaign figures somewhere Claude can read is enough.

Failing both, the pacing half still works from a spreadsheet: keep a sheet in Google Drive with date and spend, connect Drive, and change the first section to read from it. You lose the reallocation half, which is the more valuable half, so it is worth the effort to connect properly.

## Before your first run

**Use your real budget, not a round number you wish were true.** The whole routine hangs off that one figure. If your budget genuinely varies, put in the number you would be unhappy to exceed.

**Expect the first week of the month to be noisy.** Three days of data projecting across 31 is not a forecast, it is a rumour. The projection gets meaningfully accurate around day 8.

**It will not move budgets for you.** That is on purpose. Budget changes reset the platform's learning, and a routine that quietly reset your learning every Monday morning would do more harm than an overspend.

## What a good run looks like

> You have spent $1,840 of $3,000 with 11 days left. At $167 a day you will finish the month at $3,676 — **$676 over, 23%**. To land on budget, daily spend needs to drop to $105 from tomorrow.
>
> **Cheapest per result**
> Retargeting — 30d: $9.40 per result, $310 spent. Not budget-limited.
> Core offer — broad: $16.10, $720 spent.
>
> **Most expensive**
> Lookalike 5%: $47.80 per result against an account average of $18.90. $480 spent.
>
> **Suggestion**: cut Lookalike 5% from $45/day to $15/day and raise Retargeting — 30d from $20/day to $35/day. That is a net reduction of $15/day and lands the month at roughly $2,950.
>
> Stripe recorded 96 payments this month against 103 platform conversions — close enough that the platform numbers can be trusted this week.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email" sentence with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**The projection swings wildly week to week.** Normal early in the month, a problem late in it. If it is still swinging on day 20, you have campaigns turning on and off — pacing cannot smooth that, and the fix is in the account, not the routine.

**It recommends moving money into a campaign that is already maxed out.** Add to the instructions: "Ignore campaigns whose spend has been within 10% of their daily budget every day this week — they are already taking everything they can."

**Stripe and the platform disagree badly.** That is not a pacing problem, that is a tracking problem, and the Funnel & Tracking Health Check routine is the one that diagnoses it.
