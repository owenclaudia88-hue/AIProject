# Weekly Revenue Review

The daily pulse tells you what happened. This tells you what's changing.

| | |
|---|---|
| **Runs** | Mondays, 08:00 |
| **Cron** | `0 8 * * 1` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a week |

---

## Set it up

1. **New routine**, name it `Weekly Revenue Review`
2. Paste the instructions
3. **Schedule** → **Weekly** → Monday, 08:00
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Write the weekly revenue review.

From Stripe, for the seven days ending yesterday:
- total revenue, and the same figure for the previous seven days
- new customers, and how many of those were their first ever purchase
- cancellations, and how long each of those customers had been paying
- refunds, with the reason where Stripe records one
- the single largest payment, and the single largest refund

Then answer three questions in plain sentences, not bullet points:

1. Did revenue move, and what actually caused it? Name the specific
   customers or days that account for the change. "Revenue was up" is not
   an answer; "revenue was up because three annual plans renewed on
   Tuesday" is.
2. Is anything trending the wrong way that would not show up in a single
   day's numbers?
3. What is the one thing worth doing about it this week?

Email the result to the connected account with the subject "Revenue week
ending [date]".

Do not recommend anything you cannot support with a number from this
week's data. If the honest answer to question 3 is "nothing, keep going",
say that.
```

## Before your first run

**It needs two weeks of history** to say anything useful about direction. If you are in your first fortnight, expect a thin first report and don't read much into it.

**The third question is where the value is.** If the answers come back generic, the fix is almost always to add context about your business to the prompt — what you sell, what a normal week looks like, what you are currently trying to move.

## What a good run looks like

> Revenue week ending 21 September: $4,180, up from $3,240.
>
> The rise is almost entirely two annual renewals on Tuesday ($1,400 between them). Strip those out and the week was flat on the one before.
>
> Worth watching: four of the seven cancellations this week were customers who had been paying for under 30 days. That is double the usual rate, and all four cancelled within a day of their first renewal charge.
>
> This week: look at what those four saw between signing up and being charged.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**It reports totals and nothing else.** The three questions are doing the work. If it skips them, they are probably buried — move them to the top of the prompt, above the data list.

**It invents a recommendation.** The last paragraph of the prompt exists to prevent this. If it still happens, make it harsher: "If you cannot cite a specific number from this week to support a recommendation, do not make one."
