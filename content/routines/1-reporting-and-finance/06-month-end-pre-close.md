# Month-End Pre-Close

Finds the things your accountant would email you about, three days before you send them the month.

| | |
|---|---|
| **Runs** | 28th of each month, 09:00 |
| **Cron** | `0 9 28 * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a month |

---

## Why the 28th

Late enough that the month is essentially known, early enough to fix something before you close. Running this on the 1st gives you a list of problems you can no longer do anything about.

## Set it up

1. **New routine**, name it `Month-End Pre-Close`
2. Paste the instructions
3. **Schedule** → **Monthly** → 28th, 09:00. If the form has no monthly preset, pick weekly and set `0 9 28 * *` with `/schedule update` in the CLI
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Run the month-end check for the current calendar month.

From Stripe, for the month so far, find anything that will make the books
untidy:

- payments that succeeded but have no customer email recorded
- refunds with no reason given
- disputes still open, with their evidence deadlines
- invoices issued this month and still unpaid
- subscriptions that failed payment and were never recovered
- payouts to the bank that have not arrived yet
- any payment in a currency other than your usual one

Then report the month's shape: gross revenue, refunds, net, fees, and the
number of transactions. Compare each to the previous month as a
percentage.

Sort your findings into two lists:

FIX BEFORE CLOSING — things that will be wrong in the accounts if left.
NOTE FOR LATER — things that are untidy but not wrong.

Email to the connected account, subject "Month-end check — [month]".

If both lists are empty, say "Nothing to fix" and still send the month's
figures. This one reports every month even when clean, because its absence
would be indistinguishable from a clean month.
```

## Before your first run

**This is the one watch routine that always reports.** Every other watcher in this set stays quiet when there's nothing wrong. This one doesn't, because you need the monthly figures regardless, and because silence at month end reads as "it didn't run" rather than "nothing was wrong."

**"Your usual currency" needs naming** if you sell internationally. Say which one.

**It is not a substitute for reconciliation.** It reads Stripe, not your bank. If money moves anywhere else, this sees none of it.

## What a good run looks like

> September: gross $8,420, refunds $310, net $8,110, fees $284. 214 transactions, up 12% on August.
>
> **Fix before closing**
> - Dispute still open: $39, evidence due 2 October. Four days.
> - Two payments totalling $78 have no customer email recorded.
>
> **Note for later**
> - One payment in EUR (€45) alongside your usual USD.
> - Payout of $2,100 initiated 26 September, not yet landed.

## When it goes wrong

**It runs on the 28th of February and you wanted the 28th of every month.** That is what it does — `0 9 28 * *` is the 28th of every month including February. If you would rather have the true last day, there is no cron expression for it; use the 28th and accept a short February.

**It reports nothing at all.** Check the run history rather than assuming. This routine should never be silent, so silence means a failed run, not a clean month.
