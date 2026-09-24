# Cancellation Debrief

What people actually left over, as opposed to what they ticked on the way out.

| | |
|---|---|
| **Runs** | Mondays, 09:00 |
| **Cron** | `0 9 * * 1` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a week |

---

## The reason on the form is never the reason

Cancellation forms collect politeness. "Too expensive" is what people say when they mean "I never got it working". "No longer needed" is what they say when they mean "I forgot it existed". Nobody writes "I got confused in week one and was too embarrassed to ask".

So the summary of cancellation reasons — the one every tool produces — is a summary of the most socially comfortable option on a dropdown.

The real reason is in the history: when they stopped writing, what went unresolved, what they asked in week two, when the payment first failed. This routine reconstructs that history for everybody who left last week, and reports what it actually sees.

## Set it up

1. **New routine**, name it `Cancellation Debrief`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it.
4. **Schedule** → **Weekly** → Monday, 09:00
5. **Connectors**: Stripe and Gmail
6. **Create**

## Instructions

```
Reconstruct what happened to everybody who left last week.

From Stripe, find every subscription cancelled, or every customer who
stopped paying, in the last 7 days. For each, build a history.

Go back through their whole relationship with us and lay out a timeline:
- when they first paid, what they paid, and how long they stayed
- every email in either direction, with the date and a phrase from each
- every payment event: successes, failures, recoveries, downgrades
- the last time they made contact of any kind
- the gap between that last contact and the cancellation

Then answer four questions for each person.

1. WHEN DID THIS ACTUALLY END? Not the cancellation date — the date
   after which nothing good happened. Usually it is months earlier, and
   it is usually a specific event: an unresolved problem, a failed
   payment, a question that went unanswered, a change of contact person.
   Name the date and the event.

2. WHAT WAS THE LAST THING WE COULD HAVE DONE, and when? Be specific
   about both. "Better onboarding" is not an answer. "Answered the
   export question on 3 September" is.

3. WAS THIS PREVENTABLE? Three options only: yes with a specific action,
   no because their circumstances changed, or unclear. Do not be
   generous here. Some customers leave because their business changed
   and there was nothing to do, and pretending otherwise sends you
   chasing ghosts.

4. WHAT DID THEY SAY, AND WHAT DOES THE HISTORY SAY? If they gave a
   reason, quote it. Then say whether the timeline supports it. Where
   the two disagree, say so plainly — that gap is the most useful thing
   in this report.

Then across everybody who left this week, and compared with the last
three months:

- the churn count, and how it compares
- how long people stayed, median
- anything that appears in more than one timeline. Two customers who
  both went quiet after the same kind of problem is a pattern worth
  acting on this week
- the single most common "actually ended" event across the quarter

Then draft one short message per person, for anyone marked preventable.
Not a save attempt — they have gone. Under 60 words, asking one honest
question about what happened. No offer, no discount, no attempt to win
them back. People answer these surprisingly often, and what they say is
worth more than the subscription was.

Never send anything. Draft only.

If nobody left this week, say so in one line, and say how many weeks it
has been since the last one.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Ignore these addresses and domains: [e.g. @yourcompany.com, noreply@, your
  accountant, your suppliers]
What we currently believe is the main reason people leave: [e.g. we think
  they stop needing it — let the report tell you whether that is true]
```

## Before your first run

**Question 1 is the whole routine.** The cancellation date tells you nothing — by then it is bookkeeping. The date it actually ended is the one you can do something about, and it is almost always a specific, small, fixable event several months earlier.

**Fill in what you currently believe.** It lets the report contradict you, which is the only reason to run it.

**"No, not preventable" is a real answer.** Businesses close, people change jobs, projects end. A report that finds a preventable cause every single time is flattering you into fixing things that were not broken.

**Do not try to win them back.** The draft asks a question, and that is all. Somebody who just cancelled and immediately receives an offer learns that they should have cancelled sooner.

## What a good run looks like

> **2 cancellations. 6 in the last 90 days, against 9 in the previous 90. Median tenure 8 months.**
>
> **Reilly & Co — £149/mo, 11 months**
> *Timeline:* first paid 2 Nov. Active and writing regularly until 14 Mar. Asked on 14 Mar how to export historical data — no reply in the thread. Nothing from them after that. Payment failed 1 Jun, recovered 3 Jun. Downgraded 5 seats to 3 on 20 Jul. Cancelled 30 Sep.
> *Actually ended:* **14 March**, when the export question went unanswered. Everything after that is six months of a direct debit.
> *Last thing we could have done:* answered on 14 March. One email.
> *Preventable:* yes.
> *They said:* "we're consolidating tools". *The history says:* they stopped engaging six months before any consolidation. The stated reason is true and it is not the cause.
> > Subject: One question
> > Tom — you have gone, and that is fine, I am not trying to talk you out of it. But I think we lost you back in March when a question about exports never got answered. Was that it, or was it something else? Genuinely useful to know either way.
>
> **Brightwell Studios — £49/mo, 3 months**
> *Actually ended:* day 6. Never got past the connection step, never got in touch.
> *Preventable:* yes — the Onboarding Checkpoint routine would have flagged this on day 9.
>
> **Across the quarter:** the most common "actually ended" event is an unanswered support question, in 4 of 6 cases. You believed it was price. Price is the stated reason in 3 of 6 and the timeline does not support it in any of them.

## When it goes wrong

**It has no history for somebody.** They bought and never wrote. That is itself the finding: they left without ever speaking to you, which is what a failed onboarding looks like from the outside.

**Everything is "preventable with better support".** Push back in the instructions: "Name the specific message, on a specific date, that would have changed the outcome. If you cannot, mark it unclear."

**Churn numbers do not match Stripe's dashboard.** Stripe counts cancellations on the date the subscription ends; this counts the week it was requested. Neither is wrong, but do not put them side by side in a board pack.

**Nobody replies to the drafts.** Some weeks nobody will. The ones who do reply tend to tell you something nobody else would, which is why the message asks a question and sells nothing.
