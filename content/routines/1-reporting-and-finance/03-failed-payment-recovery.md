# Failed-Payment Recovery

Most failed subscription payments are expired cards, not decisions. This catches them while the customer still wants the thing.

| | |
|---|---|
| **Runs** | Every 4 hours |
| **Cron** | `0 */4 * * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | Six runs a day — more than a Pro plan allows alongside anything else |

> **Plan note.** Six runs a day fills a Pro allowance on its own. On Pro, change the schedule to daily (`0 10 * * *`). On Max it sits comfortably alongside four or five other routines.

---

## Set it up

1. **New routine**, name it `Failed-Payment Recovery`
2. Paste the instructions below
3. **Schedule** → **Hourly** → then edit the cron to `0 */4 * * *` (the form's presets don't offer four-hourly; see the note at the bottom)
4. **Connectors**: Stripe and Gmail only
5. **Create**, then **Run now** and read what it drafted before you trust it

## Instructions

```
Recover failed subscription payments.

From Stripe, find every invoice that moved to past_due, or whose payment
failed, in the last 4 hours.

Skip any customer you have already emailed about that same invoice. Keep
track by searching the connected mailbox for a previous message to that
address mentioning the same invoice number.

For each remaining one, send a short email from the connected account:
- subject line naming the product, not the word "payment"
- say plainly that the card was declined and the most common cause is an
  expired or replaced card
- include the Stripe hosted invoice URL so they can update it in one click
- no apology, and no threat to cut off access

If the same customer has now failed three or more times on the same
invoice, do not email them. Instead flag them in your summary as needing a
person.

End your run with one line: how many failed, how many you emailed, how many
you escalated. If nothing failed, say "No failed payments." and stop.
```

## Before your first run

**Read the first drafts.** This routine sends email as you, to real customers, without asking. Press **Run now** at a quiet moment and read the transcript before you leave it on a schedule.

**Check your from address.** It sends from whichever account the Gmail connector is attached to. If that is a personal address, fix it before the first run, not after.

**Three strikes is a guess.** If your product is high-value, lower it to two. The point is that a human intervenes before an automated email does for the fourth time.

## What a good run looks like

> 3 invoices failed since the last run.
> Emailed: alice@example.com ($39), bob@example.com ($39).
> Escalated: carol@example.com — fourth failure on invoice INV-2841, needs a person.

## When it goes wrong

**It emails the same person twice.** The deduplication relies on searching your sent mail, which is fuzzy. If it happens more than once, add the invoice ID to the subject line so the search has something exact to match.

**It emails someone who already paid.** Widen the window in the prompt from "last 4 hours" to "still past_due right now" — a customer who failed and then paid within the window is otherwise still in the list.

**Nothing happens and the run is green.** Check the Stripe connector is present on the routine. A green run with no connector does nothing quietly.

## Setting a four-hourly schedule

The form only offers hourly, daily, weekdays and weekly. For anything else, create the routine with the nearest preset, then in the Claude Code CLI run:

```
/schedule update
```

and ask for `0 */4 * * *`. The minimum interval anywhere is one hour — anything more frequent is rejected.
