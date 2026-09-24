# Offer Profitability

Which of the things you sell actually makes money once refunds, fees and churn have had their turn.

| | |
|---|---|
| **Runs** | 1st of each month, 10:00 |
| **Cron** | `0 10 1 * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a month |

---

## The number this replaces

Most people rank their products by revenue. Revenue is the number before anything is taken away from it — and the offer that sells best is very often the one that refunds most, costs most to acquire, and churns fastest.

This ranks them by what is left.

## Set it up

1. **New routine**, name it `Offer Profitability`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** fill in the settings.
4. **Schedule** → **Monthly** → 1st, 10:00 (or weekly, then `/schedule update` to `0 10 1 * *`)
5. **Connectors**: Stripe and Gmail
6. **Create**

## Instructions

```
Rank every product by what it actually keeps.

From Stripe, for the look-back window set at the bottom, group every
payment by product or price. For each one work out:

- gross revenue
- refunds, as an amount and as a percentage of gross
- Stripe fees
- net revenue after both
- number of buyers, and how many of those bought anything else afterwards

For subscription products, also give:
- how many of the subscriptions started in this window are still active
- the average number of payments made before cancelling

Rank by net revenue, not gross. Where the two orders differ, say so
explicitly — an offer that sells well and refunds hard is the thing this
report exists to surface.

Then answer one question: if you could only keep selling the shortlist
size below, which ones, and what does the data say about each? If fewer
than that have enough buyers to say anything meaningful, say that instead
of ranking noise.

Email to the connected account, subject "Offer profitability — [month]".

Never present a product with fewer buyers than the confidence floor below
as a trend. Report its numbers and mark it as too early to judge.

Flag any product whose refund rate is above the threshold below, whatever
its ranking. An offer that sells well and refunds hard is the thing this
report exists to surface.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Look back over: 90 days
Confidence floor — too few buyers to judge: 10
Shortlist size for the final question: 3
Flag any product refunding more than: 10%
Products to always report separately: [e.g. anything sold through a
  partner, or a one-off launch]
```

## Before your first run

**It needs 90 days and real volume.** With a handful of sales per product this will produce confident-sounding rankings from nothing, which is worse than no report. The last instruction guards against it — leave it in.

**Your products need to be distinguishable in Stripe.** If everything comes through as one price with a description, this cannot group anything. Fix the products in Stripe first.

**Subscription cohorts are the useful half.** The average number of payments before cancelling is the single most predictive number here, and it is the one nobody looks at.

## What a good run looks like

> Ranked by net, last 90 days:
>
> 1. **Starter course** — gross $4,180, refunds 3.1%, fees $146, **net $3,904** from 214 buyers. 19 went on to buy something else.
> 2. **Membership** — gross $2,340, refunds 1.2%, fees $81, **net $2,231** from 60 subscriptions. 41 still active; those that cancelled averaged 2.3 payments.
> 3. **Template pack** — gross $890, refunds 14.6%, fees $31, **net $729** from 38 buyers.
>
> Ranked by gross the template pack sits second. Its refund rate is nearly five times the others and that is the whole difference.
>
> Keep all three. Nothing else has enough buyers to judge.

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**Everything is grouped as one product.** Stripe has no price objects set up, or all payments share one. Fix it upstream; the routine cannot invent a split that is not in the data.

**Refund percentages look impossibly low.** A refund issued outside the 90-day window against a payment inside it will not be counted. That is usually fine, but be aware of it if you have a long guarantee.
