# Onboarding Checkpoint

Catches the new customers who paid and then stopped, in the first fortnight rather than the first renewal.

| | |
|---|---|
| **Runs** | Daily, 10:00 |
| **Cron** | `0 10 * * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a day |

---

## The two weeks that decide everything

Almost every cancellation is decided in the first fortnight and enacted months later. Somebody buys, starts setting it up, hits something confusing, puts it aside for the weekend, and never picks it back up. They keep paying for a while out of inertia, and then one day they do not.

By the time the cancellation arrives, the conversation is about a refund. In week one it would have been a two-minute answer.

This routine watches the first thirty days of every new customer and tells you which of them have gone quiet at exactly the point where a short message still works.

## Set it up

1. **New routine**, name it `Onboarding Checkpoint`
2. Paste the instructions and **define your checkpoints at the bottom**
3. **Schedule** → **Daily** → 10:00
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Check on everybody who bought in the last 30 days.

From Stripe, list every customer whose first payment was in the last 30
days. For each, work out what day of their onboarding they are on.

For each customer, establish what you can see:
- have they been in touch at all since paying?
- did they ask a question that was never properly answered?
- did they report a problem?
- is there any sign in the thread that they have actually started using
  it — a question that only somebody using it would ask, a screenshot,
  a mention of something they set up?

Then, against the checkpoints at the bottom, work out which ones each
customer should have reached by now and which you have any evidence for.

Report three groups.

SILENT AND OVERDUE. Past a checkpoint with no evidence they reached it,
and no contact at all since paying. These are the ones to act on. For
each, say which day they are on, which checkpoint they are past, and
what they paid.

STUCK. They got in touch, asked something or reported something, and the
thread has no clear resolution. These are worse than silent — they tried
and something stopped them. Quote the message.

GOING WELL. Evidence of use, or questions that show they are properly
into it. Count them and name them, nothing more. Do not write to these
people.

For SILENT AND OVERDUE and for STUCK, draft a message each. Rules:

- Under 60 words.
- Ask about one specific thing — the checkpoint they are behind on, or
  the problem they raised. Never "how are you getting on?", which is a
  question that requires the reader to do the work of answering it.
- Do not say you noticed they have not logged in or have not done
  something. It reads as surveillance, and it makes people defensive
  rather than responsive.
- Offer to do the thing for them, or to do it with them on a call. The
  offer is what gets the reply, not the question.
- Never mention their money, their plan, or their renewal.

Never send anything. Draft only.

If everybody is fine, say so in one line.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Checkpoints — what should have happened, and by which day:
  Day 2 —
  Day 7 —
  Day 14 —
  Day 30 —

Ignore these addresses and domains: [e.g. @yourcompany.com, noreply@, your accountant, your suppliers]
```

## Writing your checkpoints

Be concrete and observable. "Engaged with the product" is not a checkpoint. "Has connected their account", "has invited a second person", "has run it once for real" are.

If you are not sure what yours should be, look at your five longest-standing customers and ask what all of them did in the first fortnight that the people who left did not. That is your checkpoint list, and it is usually two or three things rather than four.

## Before your first run

**It can only see what reaches your inbox.** Unless your product tells you what people are doing, "silent" means "has not emailed", which is not the same as "has not used it". Plenty of happy customers never write. Treat the list as a prompt to check, not as a verdict — and if your product can email you activity summaries, point this routine at those too.

**The drafts never mention monitoring.** "I noticed you haven't logged in" is the single most counterproductive sentence in customer success. It tells somebody they are being watched and that they are behind, and the common response to both is silence.

**Offer to do it for them.** The instruction is there because it is the thing that works. "Want me to set it up with you on a call?" gets replies that "let us know if you need anything" never will.

**Do not write to the GOING WELL group.** They are fine. A check-in email to somebody who is happily using your product is an interruption dressed as care.

## What a good run looks like

> **9 new customers in the last 30 days. 2 need you.**
>
> **Silent and overdue — 1**
> **Marta K.** — day 9, £49/mo, paid 15 Sept. No contact since. Past the Day 2 checkpoint (account connected) and the Day 7 checkpoint (first real run) with no evidence of either.
> > Subject: The connection step
> > Marta — the account connection is the one step people get stuck on, and it is genuinely fiddly. If you have not done it yet, send me a time this week and I will do it with you in ten minutes. If you have already sorted it, ignore me entirely.
>
> **Stuck — 1**
> **Tom Reilly** — day 4, £149/mo. Wrote on the 19th: *"getting an error when I try to add the second user, says the invite expired"* — no reply in the thread since.
> > Subject: That expired invite
> > Tom — sorry, your message about the expired invite slipped. That is a known thing when the invite sits for more than 24 hours. I have reset it and sent a fresh one. If it does that again, tell me and I will add the user from my side instead.
>
> **Going well — 7.** Priya Shah, Dan W., Alex M., Sarah L., Harlow & Sons, Brightwell Studios, Jo T.

## When it goes wrong

**Everybody is silent.** Your customers do not email, which is normal for self-serve products. Either point the routine at whatever activity notifications you get, or accept that this is a list to spot-check rather than a churn signal.

**It writes to people who are fine.** Someone in GOING WELL got misread. Tighten the evidence definition, or add "If in doubt, put them in GOING WELL."

**The drafts sound like marketing automation.** Usually because they are asking rather than offering. Add: "Every message must contain an offer to do something specific, not a question about how it is going."

**It nags the same person daily.** Add: "Do not include anybody drafted for in the last 7 days unless something new has happened."
