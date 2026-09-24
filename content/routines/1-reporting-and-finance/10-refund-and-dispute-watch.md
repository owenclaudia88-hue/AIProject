# Refund and Dispute Watch

Disputes have deadlines. This one exists so you never find out about one after the window closed.

| | |
|---|---|
| **Runs** | Every 6 hours |
| **Cron** | `0 */6 * * *` |
| **Connectors** | Stripe, Slack |
| **Takes** | Four runs a day |

> **Plan note.** On Pro, run it daily at `0 9 * * *` instead. A dispute window is measured in days, so daily is enough to be safe.

---

## Set it up

1. **New routine**, name it `Refund and Dispute Watch`
2. Paste the instructions and **fill in the settings at the bottom**
3. **Schedule** → **Hourly**, then `/schedule update` in the CLI to set `0 */6 * * *`
4. **Connectors**: Stripe and Slack
5. **Create**

## Instructions

```
Watch for refunds and disputes that need a decision.

From Stripe, find anything within the look-back window below that is:
- a new dispute or chargeback
- a refund over the refund threshold below
- a refund on a payment made within the fast-refund window below
- a customer who has now had the repeat-refund count below, or more, ever

For each dispute, report the amount, the reason Stripe gives, the evidence
deadline as a date, and how many days away that is. Disputes have hard
deadlines and missing one loses the money automatically.

Post to the Slack channel named below. One message per run, not one per
event. Put disputes first, refunds second.

If a dispute's evidence deadline is closer than the deadline warning
below, say so on its own line at the very top. A missed deadline loses
the money automatically and there is no appeal.

If none of the above happened, post nothing at all. Do not post "all
clear" — this channel should only ever contain things that need a
decision, so that a message in it always means something.

--- EDIT BELOW THIS LINE ---

Slack channel to post to: #alerts
Look back over: 6 hours
Refund threshold — alert on any single refund over: $100
Fast-refund window — a refund this soon after the payment: 48 hours
Repeat-refund count — one customer having had this many, ever: 3
Deadline warning — shout if an evidence deadline is within: 3 days
```

## Before your first run

**Change `#alerts`** to a channel with notifications on. The whole point of this routine is that it interrupts you.

**"Post nothing at all" is the important line.** A watch routine that posts "all clear" four times a day trains you to ignore the channel, which defeats it entirely. Keep that instruction.

## What a good run looks like

Most runs: nothing. That is correct behaviour.

When it does fire:

> **Dispute** — $39 from j.mills@example.com, reason "product not received". Evidence due 3 October, 9 days away.
> **Refund** — $240 to Harrow Ltd, on a payment made yesterday.

## Prefer email instead of Slack?

Plenty of people do not live in Slack. This one sends there by default, but the
swap takes one line.

In the instructions, replace the Slack sentence with:

> Email the result to the connected account with the subject "[name of this
> automation] — [date]".

Then swap the **Slack** connector for **Gmail** on the routine. Everything else
stays exactly the same.

## When it goes wrong

**It posts every run, including empty ones.** Move "If none of the above happened, post nothing at all" to the very top of the prompt. Instructions at the end get less weight than instructions at the start.

**You never see anything and suspect it's broken.** Open the routine and check the run history — green runs with an empty transcript summary mean it ran and found nothing. That is the routine working. If you want reassurance, add a weekly digest routine rather than loosening this one.

**Disputes arrive without an evidence deadline.** Not every dispute type has one. Have it say "no deadline given" rather than inventing a date.
