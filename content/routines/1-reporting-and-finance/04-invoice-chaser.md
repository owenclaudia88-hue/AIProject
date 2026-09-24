# Invoice Chaser

The job nobody does until the money is properly late.

| | |
|---|---|
| **Runs** | Weekdays, 10:00 |
| **Cron** | `0 10 * * 1-5` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a day |

---

## Set it up

1. **New routine**, name it `Invoice Chaser`
2. Paste the instructions and **fill in the settings at the bottom**
3. **Schedule** → **Weekdays** → 10:00
4. **Connectors**: Stripe and Gmail
5. **Create**, then **Run now** and read the drafts

> Mid-morning on a weekday is deliberate. An invoice chase that lands at 3am, or on a Sunday, reads as automated and gets ignored.

## Instructions

```
Chase unpaid invoices, escalating in tone as they age.

From Stripe, list every invoice that is open, sent, and past its due date.
For each one work out how many days late it is.

Before emailing, search the connected mailbox for a previous chase on the
same invoice number, and skip it if one went out within the quiet period
set at the bottom.

Match the tone to the age, using the stages at the bottom:

GENTLE — assume they missed it. One short paragraph, friendly, the amount,
the due date, the payment link. No mention of lateness beyond the date.

DIRECT — state the amount, how many days overdue, the payment link, and
ask them to reply with a date if there is a problem.

HAND OVER — do not send anything. Add it to your summary under "needs a
person" with the customer name, amount and age.

Always include the Stripe hosted invoice URL. Never attach anything.

Never email anybody on the do-not-contact list below.

End with a summary: how many chased at each stage, total outstanding, and
anything past the hand-over age.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Gentle stage — from this many days late: 1
Direct stage — from this many days late: 8
Hand over to a person — from this many days late: 22
Quiet period — do not chase the same invoice more often than every: 7 days
Never email these customers, addresses or domains: [e.g. anyone you
  invoice
  on agreed terms, anyone you would rather phone]
```

## Before your first run

**This one sends email as you.** Same warning as Failed Payment Rescue — run it manually once and read what it wrote.

**Check your invoices actually have due dates.** Stripe invoices without a due date will never appear as past due, and the routine will report nothing forever while you assume it is working.

**The 22-day cutoff is a judgement call.** Past three weeks, a template email is not the thing that gets you paid, and a fourth automated chase damages the relationship you still need in order to collect. Change the number, but keep a cutoff.

## What a good run looks like

> Chased 4 invoices.
> Gentle (1–7 days): Acme Ltd $450, Bright Co $180.
> Direct (8–21 days): Halberd $1,200, Tin Roof $340.
> Needs a person: Weald & Sons, $2,100, 31 days late. No response to two previous chases.
> Total outstanding: $4,270.

## When it goes wrong

**Nothing is ever found.** Either the invoices have no due date, or they are being paid automatically by card and never sit in the open state. This routine is for manually paid invoices.

**The tone is wrong at the first stage.** Models tend to over-apologise. Add: "Do not apologise, and do not thank them for their patience. They are late; you are not."

**It chases the same invoice daily.** The weekly deduplication depends on searching sent mail. Put the invoice number in the subject line so the search has an exact string to find.
