# Trial Ending Watch

Everyone on a trial that converts to a paid plan this week, and whether they have actually used the thing yet.

| | |
|---|---|
| **Runs** | Daily, 09:00 |
| **Cron** | `0 9 * * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a day |

---

## Why this one earns its place

A customer who is charged at the end of a trial they never used is the most expensive kind of customer you can have. They refund, they dispute, and they tell people.

This routine finds them before the charge, not after.

## Set it up

1. **New routine**, name it `Trial Ending Watch`
2. Paste the instructions
3. **Schedule** → **Daily** → 09:00
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Find trials converting to paid in the next 48 hours.

From Stripe, list every subscription with status "trialing" whose trial
ends within the next two days. For each one report:
- customer name and email
- the amount they will be charged
- the exact date and time of the charge
- how long ago they signed up

Email the list to the connected account with the subject "Trials
converting: [count]".

For each person on the list, draft a short email to them — do not send it,
put the drafts in the same summary email for review. Each draft should:
- say their trial ends on [date] and what they will be charged
- say how to cancel, in one sentence, without making cancelling sound like
  the expected choice
- offer one specific thing to try before then

If no trials end in the next 48 hours, send nothing.
```

## Before your first run

**Note that it drafts rather than sends.** That is deliberate for this one. A trial-ending email is the last thing a customer reads before money leaves their account, and it is worth twenty seconds of your attention.

Once you trust the drafts, change "do not send it, put the drafts in the same summary email" to "send it to the customer" and it becomes fully automatic.

**"One specific thing to try"** needs your product in the prompt to be any good. Add two lines describing what a new customer should do first, or the suggestion will be generic.

## What a good run looks like

> Trials converting: 2
>
> **Dana Ruiz** — dana@example.com — $39 on 26 September at 14:12 — signed up 19 September
> **Tomas Lind** — tomas@example.com — $39 on 27 September at 09:03 — signed up 20 September
>
> Draft for Dana:
> Your trial ends on Thursday and your card will be charged $39...

## When it goes wrong

**It finds nothing and you know you have trials.** Check that your subscriptions actually use Stripe's trial period rather than a free plan you switch manually. Only the former has status "trialing".

**The drafts all say the same thing.** They will, unless the prompt knows what your product does. This is the routine that most rewards a few sentences of context.

## The honest version of this

If you would rather not email people before charging them, do not install this routine and tell yourself you will check manually. You will not. Either install it, or change the trial so it does not auto-charge.
