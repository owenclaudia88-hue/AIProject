# At-Risk Customer Watch

The customers who are about to leave, while there is still time to do something.

| | |
|---|---|
| **Runs** | Daily, 09:00 |
| **Cron** | `0 9 * * *` |
| **Connectors** | Stripe, Gmail. Slack optional |
| **Takes** | One run a day |

---

## Nobody cancels suddenly

A cancellation looks sudden from where you are sitting, because the cancellation is the first thing you see. From the customer's side it was weeks — a failed payment they meant to fix, a problem they reported that never got properly resolved, a gradual drift from using it every day to not thinking about it.

Every one of those leaves a mark somewhere you already have access to. The signals are not subtle. They are just spread across Stripe and your inbox, and nobody has time to correlate two systems every morning.

This routine correlates them, every morning, and hands you a short list of people worth a personal message this week.

## Set it up

1. **New routine**, name it `At-Risk Customer Watch`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** set your signals and thresholds.
4. **Schedule** → **Daily** → 09:00
5. **Connectors**: Stripe and Gmail
6. **Create**

## Instructions

```
Find the customers who look like they are on their way out.

Go through active paying customers in Stripe and look for these signals,
using the thresholds at the bottom.

PAYMENT SIGNALS, from Stripe:
- a failed payment in the last 30 days, whether or not it later
  recovered. A recovered failure still means their card details are
  stale.
- a downgrade, or a reduction in quantity or seats
- a subscription switched from annual to monthly
- an upcoming renewal within the renewal window, for anyone who also
  shows any other signal on this list
- a card expiring before the next renewal

CONVERSATION SIGNALS, from email:
- a support problem in the last 60 days that has no clear resolution in
  the thread
- any message with frustration in it, however polite
- somebody who used to write regularly and has not written in a long
  time
- any question about cancelling, pausing, exporting data, or "how the
  contract works"
- a change of contact person — a new name writing from the same domain,
  or an auto-reply saying someone has left. This one is badly
  underrated: the person who championed you leaving is the single
  strongest predictor there is.

Score each customer: one point per signal, two points for anything about
cancelling, exporting data or a change of contact person.

Report anybody at or above the score threshold, highest first. For each:
- who they are, what they pay, how long they have been a customer
- every signal that fired, with the date and the evidence
- the single most important thing, in one sentence
- what you would do about it — a specific action, not "reach out"

Then draft a short message for the top three only. Under 70 words. It
must not mention that they look like they are leaving, which is
unsettling and puts the idea in their head. It should reference the
actual thing — the failed payment, the unresolved problem, the new
person — and offer something concrete.

Separately, list anybody who dropped off the list since your last run,
so I can see when something resolved.

Never send anything. Draft only.

If nobody is above the threshold, say so in one line. Quiet is the
expected state.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Score threshold to report: 2
Renewal window: 30 days
"Has not written in a long time" means: 90 days
Customers to always watch, whatever their score: [e.g. your five largest
  by revenue, named]
Ignore these addresses and domains: [e.g. @yourcompany.com, noreply@, your
  accountant, your suppliers]
```

## Before your first run

**A change of contact person outscores everything else for a reason.** In a business relationship, your product was usually someone's decision. When that someone leaves, the new person inherits a line item they did not choose and has no attachment to it. That is the most reliable churn signal available and almost nobody watches for it.

**A recovered failed payment is still a signal.** Most people filter these out because the money arrived. But a card that failed once is a card that will fail again, usually at renewal, and that is the failure that turns into a cancellation.

**Start the threshold at 2.** One signal is noise — everybody has an odd month. Two correlated signals is a conversation worth having.

**The drafts never mention churn.** Telling somebody they look like they are leaving is how you find out whether they were.

## What a good run looks like

> **3 customers above threshold.**
>
> **1. Northfield Makes — £149/mo, customer 14 months — score 5**
> — New contact: Daniel Okafor has been writing from their domain since 12 Sept. Priya Shah, who set the account up, has not written since. (2)
> — Support thread from 3 Sept about export formats, never resolved. (1)
> — Failed payment on 1 Sept, recovered on the 3rd. (1)
> — Renews 14 Oct, inside the window. (1)
> *The one thing:* the person who chose you has gone, and the person who replaced her has an unresolved problem and a renewal in three weeks.
> *Do:* call Daniel this week. Not email.
> > Daniel — I noticed the export question from earlier this month never got a proper answer, which is on us. I would rather sort it on a call than in writing. Are you around Thursday or Friday? It will take ten minutes and you should not be inheriting an open problem.
>
> **2. Reilly & Co — £49/mo, 8 months — score 3**
> Card expires 11/26, before the December renewal. Downgraded from 5 seats to 3 on 20 Sept. Has not been in touch in 104 days.
>
> **3. Brightwell Studios — £49/mo, 3 months — score 2**
> Asked on 18 Sept how data export works. Failed payment on 22 Sept, recovered.
>
> **Dropped off since yesterday:** Harlow & Sons — their support thread was resolved on Friday.

## Prefer Slack instead of email?

In the instructions, replace the sending instruction with:

> Post the result as a single message to the #customers channel in Slack.

Add the **Slack** connector. Keep Stripe and Gmail as the sources.

## When it goes wrong

**Everybody is at risk.** Threshold too low, or your customers simply do not email much, so "has not written in 90 days" fires constantly. Raise that to 180, or remove it if your product is one people use without ever writing to you.

**It never finds anybody and then somebody cancels.** Go back and look at what signals that customer actually gave. Whatever it was, add it to the list — this routine is meant to be edited after every churn.

**It flags the same customer for months.** Something is genuinely unresolved. That is the routine being right and uncomfortable.

**The drafts are too obviously a save attempt.** Tighten it: "Write as though this were a normal piece of account housekeeping. Do not ask how they are finding it, and do not ask for feedback."
