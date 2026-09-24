# Subscription Spend Audit

The software you are still paying for and stopped opening in March.

| | |
|---|---|
| **Runs** | 1st of each month, 09:00 |
| **Cron** | `0 9 1 * *` |
| **Connectors** | Gmail |
| **Takes** | One run a month |

---

## How it works without access to your bank

It reads your inbox. Every subscription you pay for sends receipts, and those receipts are a more complete record of your recurring spend than most people's expense tracking.

That also means it only sees what lands in the connected mailbox. Anything billed to a card whose receipts go elsewhere is invisible to it.

## Set it up

1. **New routine**, name it `Subscription Spend Audit`
2. Paste the instructions and **fill in the settings at the bottom**
3. **Schedule** → **Monthly** → 1st, 09:00 (or weekly, then `/schedule update` to `0 9 1 * *`)
4. **Connectors**: Gmail
5. **Create**

## Instructions

```
Audit recurring software spend from receipts in the connected mailbox.

Search the look-back window set at the bottom for receipts, invoices and
payment confirmations from software and service providers. Ignore anything
from the domains listed at the bottom as our own — you are looking at
money going out, not coming in.

For each provider, work out:
- what they charge and how often
- when the most recent charge was
- the annual cost at the current rate

Produce three lists.

PAYING MONTHLY, COULD BE ANNUAL — where the receipt or the provider's
pricing suggests an annual plan would be cheaper. Give the saving.

CHARGED BUT QUIET — any provider charging you where nothing else in the
mailbox from the last 90 days suggests you have used it. Product update
emails do not count as use; a login alert, an export, a shared document or
a reply from their support does.

EVERYTHING ELSE — the rest, with monthly and annual cost.

End with total monthly and total annual recurring spend.

Email to the connected account, subject "Subscription audit — [month]".

Be careful with "charged but quiet". Absence of email is weak evidence.
Phrase these as "worth checking", never as "cancel this".

Leave anything on the keep list below out of "charged but quiet"
entirely. Some things are paid for precisely so that nobody has to think
about them.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Look back over: 90 days
Our own domains — money coming in, ignore these: [e.g. @yourcompany.com]
Ignore anything under: $5 a month
Keep list — never flag these as quiet: [e.g. backups, domain renewals,
  insurance, anything for compliance]
```

## Before your first run

**The "charged but quiet" list is a prompt, not a verdict.** Plenty of tools you rely on daily never email you. The instruction tells it to hedge — leave that in.

**It only sees one mailbox.** If receipts go to a separate billing address, connect that one instead, or you will audit a fraction of your spend and believe it was all of it.

**Ninety days catches quarterly billing.** Drop it to 30 and you will miss anything not billed monthly.

## What a good run looks like

> Total recurring: $487/month, $5,844/year.
>
> **Could be annual**
> - Figma, $15/mo → $144/year saves $36
> - Notion, $10/mo → $96/year saves $24
>
> **Worth checking**
> - Loom, $12.50/mo — charged three times, nothing else from them in 90 days
> - Webflow, $23/mo — same
>
> **Everything else**
> Anthropic $20, Vercel $20, Resend $20, Stripe (usage) …

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**It lists your own customers' payments.** The instruction to ignore incoming money is there but a busy mailbox can confuse it. Add the name of your own product so it knows what to exclude.

**It misses things you know you pay for.** Those receipts are going to another address, or straight to a folder the search does not reach. This routine is only ever as good as the mailbox it can see.
