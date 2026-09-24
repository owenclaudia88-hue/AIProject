# 13-Week Cash-Flow Forecast

The only finance report that answers the question you actually lie awake about.

| | |
|---|---|
| **Runs** | Mondays, 07:30 |
| **Cron** | `30 7 * * 1` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a week |

---

## Why thirteen weeks

A quarter is far enough ahead to do something about a gap and close enough that the numbers still mean something. Twelve months of forecast from a small business is fiction with a spreadsheet wrapped round it.

## Set it up

1. **New routine**, name it `13-Week Cash-Flow Forecast`
2. Paste the instructions, then **add your fixed costs at the bottom** — this one does not work without them
3. **Schedule** → **Weekly** → Monday, 07:30
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Build a rolling 13-week cash forecast.

Money coming in, from Stripe:
- every active subscription and its next renewal date and amount, for the
  next 13 weeks
- the average weekly revenue from one-off payments over the last 8 weeks,
  used as the estimate for each week ahead
- any invoice already issued and unpaid, placed in the week of its due date

Money going out: use the fixed costs listed at the end of these
instructions.

Produce a week-by-week table: week beginning, money in, money out, net,
and running balance. Start the running balance from the figure given
below.

Then say in plain sentences:
- the lowest the balance gets, and which week
- whether it ever goes below zero, and by how much
- which single week is the most fragile, and what would have to happen to
  break it

Email to the connected account, subject "Cash forecast — [date]".

State clearly that one-off revenue is an estimate from the last 8 weeks
and not a commitment. Do not present estimated income with the same
certainty as a scheduled renewal.

--- EDIT BELOW THIS LINE ---

Starting balance: $0
Fixed costs per month:
  Software and tools: $0
  Contractors: $0
  Advertising: $0
  Everything else: $0
```

## Before your first run

**Fill in the bottom section.** Without it the forecast is just income and will always look healthy. This is the one routine in the set that is useless until you edit it.

**Update the starting balance monthly.** It drifts, and a forecast built on a stale opening figure is wrong by exactly that amount all the way down.

**It cannot see your bank.** Everything here comes from Stripe and the numbers you typed. If money arrives elsewhere — invoices paid by transfer, a second processor — say so in the prompt or the forecast will understate you.

## What a good run looks like

> Lowest point: $1,840 in the week beginning 17 November.
>
> It never goes below zero, but that week is the fragile one — two annual renewals worth $780 land on the 19th and the month's advertising leaves on the 18th. If either renewal fails, the week closes at about $1,060.
>
> One-off revenue is estimated at $310 a week from the last eight weeks. Three of those eight were above $500, so the estimate is conservative.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**Everything looks fine forever.** You did not fill in the fixed costs.

**The estimate swings wildly week to week.** Eight weeks is a short base if your sales are lumpy. Change it to twelve, or tell it to use the median rather than the average — one large week otherwise drags every future week up with it.
