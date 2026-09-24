# Win & Loss Pattern Report

Once a month, the honest reason people buy from you and the honest reason they do not.

| | |
|---|---|
| **Runs** | 1st of the month, 10:00 |
| **Cron** | `0 10 1 * *` |
| **Connectors** | Gmail, Stripe |
| **Takes** | One run a month |

---

## You already know, but only anecdotally

Ask anybody why they lose deals and you get the last one they lost. Ask why they win and you get the story they tell on their website.

Both are memory, and memory over-weights whatever happened most recently and whatever was most annoying. So businesses spend years fixing the loudest objection rather than the most common one, which are rarely the same thing.

This routine reads every conversation that closed last month, wins and losses together, and reports the patterns rather than the anecdotes. It is the least exciting routine here and it is the one most likely to change a decision.

## Set it up

1. **New routine**, name it `Win & Loss Pattern Report`
2. Paste the instructions and **fill in the bottom section**
3. **Schedule** → **Monthly** → 1st, 10:00
4. **Connectors**: Gmail and Stripe
5. **Create**

## Instructions

```
Analyse everything that closed last month, won or lost, and report the
patterns.

From Stripe, get every new customer who first paid last calendar month.
From email, find every sales conversation that ended last month without
a payment — a clear no, or silence for longer than the dead threshold
below.

That gives you two groups: WON and LOST. Say how many are in each, and
what proportion of everything that closed that represents.

Then, for each group, go through the actual conversations and find the
patterns.

For WON, report:
- what they said they wanted, in their own words, grouped by theme
- the objection that came up most often and how it was resolved
- how long from first contact to payment: median, shortest, longest
- where they came from, if it is anywhere in the thread
- what the wins have in common that the losses do not

For LOST, report:
- the stated reason, where there was one, grouped by theme
- how many gave no reason at all, and just stopped replying. This is
  usually the largest group, and it should be reported as its own
  category rather than distributed among the others by guesswork
- at which point in the conversation they went quiet — before a price,
  after a price, after a call, after a proposal. This is more useful
  than the stated reason, because the stated reason is often polite
  rather than true
- what the losses have in common that the wins do not

Then three things, and keep these short:

1. THE MOST COMMON REAL OBJECTION. Not the loudest one. The one that
   appears in the most conversations, whether or not it was ever
   resolved.
2. THE SENTENCE THAT KEEPS WORKING. Something we said, quoted exactly,
   that appears in several conversations shortly before they converted.
   If there is no such thing, say so.
3. THE ONE CHANGE WORTH TESTING NEXT MONTH, with what you would expect
   to see if it worked.

Compare against the previous two months where you can: is the win rate
moving, is the time to close moving, is the main objection changing?

Email the result to the connected account, subject "Win/loss — [month]".

Be careful with small numbers. If a group has fewer than five
conversations in it, say so and do not describe it as a pattern. A
confident conclusion from three data points is how people talk
themselves into the wrong change.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Consider a conversation dead after: 30 days of silence
Ignore these senders, domains and labels: [e.g. @yourcompany.com,
  noreply@, newsletters, label:Receipts]
Our own email addresses: [e.g. you@yourcompany.com, hello@yourcompany.com]
What we currently believe is the main reason people do not buy: [e.g. we
  think it is price — let the report tell you whether that is true]
```

## Before your first run

**Fill in what you currently believe.** The report gets much more useful when it can tell you that you are wrong about something. That line is what lets it say "you think it is price, and price appears in 3 of 19 conversations".

**"Where they went quiet" is the section to read first.** Stated reasons are social — people say "budget" because it is the polite way to end a conversation. Where somebody stopped replying is behaviour, and behaviour does not flatter anyone.

**Expect small numbers early on.** With eight closed conversations a month this is suggestive rather than conclusive, and it is instructed to say so. It gets genuinely reliable somewhere around thirty a month, or after six months of running it.

**Run it monthly, act quarterly.** One month of data is a hint. Three months of the same hint is a fact.

## What a good run looks like

> **Closed last month: 19. Won 6, lost 13. Win rate 32%, against 28% and 35% the two months before.**
>
> **Won — what they wanted**
> Four of six described a version of "the current way has stopped scaling", in their own words: *"falling over now there are four of us"*, *"I'm the bottleneck"*. Two were replacing a competitor.
> Most common objection: migration effort, raised by 4 of 6. Resolved every time by costing it honestly rather than minimising it.
> Time to close: median 12 days, range 3 to 41.
>
> **Lost — what happened**
> Gave a reason: 5. Of those, 3 said price and 2 said timing.
> **Gave no reason at all: 8.** This is the largest group and it is bigger than every stated reason combined.
> Went quiet: 2 before any price, **7 immediately after the price was sent**, 4 after a call.
>
> **Most common real objection** — not price. Migration effort appears in 11 of 19 conversations across both groups. It is the only thing that appears in almost every conversation you win *and* almost every one you lose.
>
> **The sentence that keeps working** — *"It is two days of somebody's attention, not two hours, and I would rather tell you that now."* Appears in 4 of 6 wins, usually within two messages of the yes.
>
> **Worth testing** — put the honest migration cost on the pricing page, before anyone has to ask. Expect fewer enquiries and a higher win rate. If enquiries drop and wins do not rise within two months, put it back.
>
> **Note:** 6 wins is a small group. Treat the WON patterns as a hint.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Add the **Slack** connector and keep Gmail and Stripe.

## When it goes wrong

**Everything is in "no reason given".** That is usually true and it is the finding, not a failure. The "where they went quiet" section is what you read instead.

**It reads internal threads as lost deals.** Your own domain is not in the bottom section.

**It is confident about three conversations.** The small-numbers instruction is there to prevent this. If it still overstates, harden it: "Do not use the words pattern, trend or usually for any group smaller than five."

**The win rate looks wrong.** It can only count losses it can see. Enquiries that never became conversations at all are invisible to it, so the real rate is lower. Treat the trend as meaningful and the absolute number as flattering.
