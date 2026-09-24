# Abandoned Checkout Recovery

The people who got as far as the payment page and stopped, and what to send them.

| | |
|---|---|
| **Runs** | Daily, 11:00 |
| **Cron** | `0 11 * * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a day |

---

## The warmest audience you have

Somebody who reached your checkout and left is not a stranger. They found you, read enough to be convinced, chose a product, and started typing their card in. Something stopped them in the last thirty seconds.

That is the closest anybody gets to buying without buying, and the recovery rate on a decent follow-up is high enough that this is usually the single most profitable routine in the set.

The hard part is not the email. It is knowing who they were, because an abandoned checkout is not a record anybody keeps by default.

## What Stripe can and cannot tell you

Worth understanding before you set this up, because it decides how well this works.

Stripe only knows an email address if the person typed one in. Many checkouts create the payment record on page load, before any details are entered — in which case an abandonment leaves a record with no email attached, and there is nobody to write to.

So:

- **If your checkout collects the email before the card**, this routine works well and finds most abandonments.
- **If it collects everything on one screen at the end**, it will only find the people who got furthest.

If you are seeing far fewer abandonments than you expect, that is why, and the fix is in your checkout rather than in this routine. Collecting the email on its own step, before payment details, is worth doing for exactly this reason.

## Set it up

1. **New routine**, name it `Abandoned Checkout Recovery`
2. Paste the instructions and **fill in the bottom section**
3. **Schedule** → **Daily** → 11:00
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Find yesterday's abandoned checkouts and draft the follow-ups.

In Stripe, find every payment attempt from the last 48 hours that has an
email address attached and did not result in a successful payment. For
each, establish which of these it is, because they need completely
different messages:

CARD DECLINED — a payment was attempted and the bank refused it. These
people tried to buy. They are the most recoverable of the three and the
most commonly ignored.

NEVER ATTEMPTED — details were started but no payment was submitted.
Something interrupted them, or something put them off.

ALREADY BOUGHT — they abandoned once and completed later, or they are an
existing customer. Exclude these entirely and count them separately. An
email chasing somebody who already paid is worse than sending nothing.

For each recoverable person, give me: name if known, email, what they
were buying, the amount, when it happened, which of the two categories,
and the decline reason if there is one.

Then draft one email each, under 120 words, no subject line longer than
six words.

For a DECLINED: say plainly that the payment did not go through, that
this is usually the bank rather than the card, and give them a direct
way to try again. Do not apologise repeatedly and do not imply they did
something wrong.

For a NEVER ATTEMPTED: do not mention that you watched them abandon a
checkout, which is unsettling. Ask one useful question instead — what
stopped them, whether something was unclear. One question, and make it
easy to answer in a sentence.

Neither email offers a discount. A discount on a first follow-up trains
people to abandon checkouts, and it gives away margin on people who
would have finished anyway.

Do not include anybody in the suppression list at the bottom, anybody
who has asked not to be contacted, or any address that has bounced.

Email the whole thing to the connected account, subject "Abandoned
checkouts — [date]", drafts included, ready to copy.

Never send anything to a customer. Draft only.

If there were none, say so in one line.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Do not contact these addresses or domains: [e.g. @yourcompany.com, anyone who has unsubscribed]
Link to send people back to: [e.g. https://yourcompany.com/checkout]
How we refer to the product: [e.g. "your plan", not "your subscription"]
```

## Before your first run

**It drafts, it does not send.** On purpose. An automated email to somebody whose card was declined is the one message you least want to get wrong, and the difference between a good and a bad one is a single sentence of tone.

**Declines are the ones to act on first.** Somebody whose card failed usually does not know it failed. They think they bought it. A plain factual email recovers a meaningful share of these, and it is the closest thing to free money in the whole suite.

**Never discount on the first contact.** It is in the instructions for a reason. If you discount abandonments and people notice, you have taught your most engaged visitors that leaving is worth money.

**Check the exclusion count.** If lots of people show up as ALREADY BOUGHT, your window is too wide or your checkout retries a lot — either is worth knowing.

## What a good run looks like

> **4 recoverable. 2 excluded — already purchased.**
>
> **Declined — 2**
>
> **Tom Reilly**, tom@..., £49, yesterday 19:40. Reason: `insufficient_funds`.
> > Subject: Your payment didn't go through
> > Tom — your card was declined when you tried to check out yesterday. Nine times out of ten that is the bank rather than the card, and a second attempt goes through. Here is the link to pick up where you left off: [link]. If it fails again, tell me and I will sort it another way.
>
> **Priya Shah**, priya@..., £49, yesterday 08:12. Reason: `do_not_honor`.
>
> **Never attempted — 2**
>
> **Marta K.**, marta@..., £49, yesterday 14:03.
> > Subject: Quick question
> > Marta — you started signing up yesterday and stopped. No problem at all, but if something was unclear I would rather know: what put you off? One line is plenty.

## When it goes wrong

**It finds almost nobody.** Your checkout is collecting the email at the same time as the card. See the section above — this is a checkout design issue, not a routine issue, and it is worth fixing because it also breaks every other kind of follow-up.

**It chases people who already paid.** The exclusion is there, so check whether those payments are under a different email address. Some people abandon with one address and buy with another, and nothing can catch that reliably.

**The declined email sounds like an accusation.** Tone is the whole game here. Add to the instructions: "Write as though reporting a fact about our system, never about their card."

**It keeps drafting for the same person every day.** The window is 48 hours and runs daily, so there is one day of overlap. Narrow to 24 hours, or add "Ignore anybody drafted for in the last 7 days."
