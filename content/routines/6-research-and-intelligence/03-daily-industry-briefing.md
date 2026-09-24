# Daily Industry Briefing

Your industry's news in five minutes, filtered to the things that actually touch your business.

| | |
|---|---|
| **Runs** | Daily, 06:30 |
| **Cron** | `30 6 * * *` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a day |

---

## Keeping up is a job nobody assigned you

You should know what is happening in your industry. Regulation changes, a supplier gets bought, a platform changes its rules, a competitor raises money. Any of it might matter.

So you subscribe to four newsletters, follow six accounts, and join two communities — and then you read none of it, because reading all of it properly takes an hour a day and the useful part is about four sentences.

This routine reads it instead, and sends you the four sentences. The filtering is the point: a briefing that summarises everything is the same problem in a different envelope.

## Set it up

1. **New routine**, name it `Daily Industry Briefing`
2. Paste the instructions and **list your sources and your filters at the bottom**
3. **Schedule** → **Daily** → 06:30
4. **Connectors**: none. Remove them all
5. **Environment**: **Full**, or **Custom** with your listed domains. Without it, nothing
6. **Create**

## Instructions

```
Brief me on anything from the last 24 hours that touches this business.

Read the sources listed at the bottom. Consider only items published or
substantially updated in the last 24 hours.

For every item, ask one question: does this change a decision somebody
running this business might make? If the honest answer is no, leave it
out. It does not matter how interesting it is.

Things that pass that test are usually:
- a rule, a law, a tax or a compliance change affecting us or our
  customers
- a platform we depend on changing its terms, its pricing, or its API
- a competitor raising money, being acquired, launching, or closing
- a supplier or partner changing something
- a price change in something we buy or sell
- a shift in what our customers are dealing with, which changes what
  they need from us

Things that almost never pass, and should be excluded by default:
- funding rounds in adjacent industries
- general technology news
- opinion pieces, predictions, and "the future of" articles
- anything that is really an advertisement
- restatements of something already reported

For each item that passes, give:
- one sentence on what happened
- one sentence on why it touches us specifically, naming the part of the
  business it touches
- what, if anything, to do about it, and by when. "Nothing, but know
  it" is a legitimate answer and should be used often
- the source and a link

Order by how much it matters, most first. Give me at most five. If more
than five pass, that is a busy day and you should say so, then still
give the five that matter most.

Then, in one line, say how many items you read and how many passed. That
ratio is useful: if you read 90 and 1 passed, my sources are wrong.

If nothing passed, say "nothing today" and nothing else. A briefing that
manufactures something every day trains me to stop reading it, and then
it is useless on the day it matters.

Do not summarise items that did not pass. Do not add a "also worth
noting" section.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

What this business does: [e.g. we sell and fit commercial kitchen equipment]
What we depend on — platforms, suppliers, payment providers,
marketplaces, regulators: [e.g. Stripe, Shopify, Royal Mail, HMRC, your main supplier by name]
Who our customers are, and what changes their world: [e.g. independent retailers — affected by card fees, business rates, supplier terms]
Sources — news sites, industry publications, regulator pages, platform
changelogs, competitor blogs: [e.g. your payment provider’s changelog, your regulator’s announcements page, two trade publications]
Topics I never need to hear about: [e.g. funding rounds, predictions, "the future of" articles, AI news in general]
```

## Choosing sources

Six to ten. Fewer and you miss things; more and everything becomes a summary of everything.

The highest-value sources are the boring ones: your payment provider's changelog, your platform's developer blog, the regulator's announcements page. Those publish rarely and everything they publish matters. News sites are the opposite — they publish constantly and most of it does not.

A good set is usually: two industry publications, three changelogs or status pages for things you depend on, one regulator, and one or two competitors' blogs.

## Before your first run

**Set the environment to Full or Custom.** Nothing works otherwise.

**"Nothing today" is a feature.** Most days genuinely have nothing. A briefing that always finds five things is padding, and you will stop reading it inside a month — which means you will also not read it on the day something real happens.

**The pass ratio tells you about your sources.** If it reads 80 items and passes none for a fortnight, your sources are publishing noise. Swap them for changelogs.

**Set it before you start work.** 06:30 is deliberate: read it with coffee, not at eleven when you are already into something.

## What a good run looks like

> **Read 47. Passed 2.**
>
> **1. Your payment provider is changing how disputes are handled from 1 December.**
> The response window goes from 21 days to 14, and evidence must be submitted through the dashboard rather than by email.
> *Touches us:* directly. Our dispute process assumes 21 days and assumes email.
> *Do:* update the internal process before December. Not urgent this week, but do not let it reach November.
> [link]
>
> **2. New reporting requirement for businesses over a turnover threshold, effective next tax year.**
> The threshold is above where you are now, but not by much.
> *Touches us:* not yet. It would if this year's growth continues.
> *Do:* nothing, but know it. Worth a conversation with your accountant at year end.
> [link]
>
> ---
>
> *Not included: 3 funding announcements, 11 opinion pieces, 2 restatements of last week's platform update, 29 items with no bearing on this business.*

## Prefer Slack instead of email?

Add a sending instruction to the prompt:

> Post the briefing as a single message to the #general channel in Slack.

Then add the **Slack** connector.

## When it goes wrong

**It finds nothing, every day, forever.** Two possible causes and they need opposite fixes: check the environment setting first, and only then consider whether your sources are too quiet.

**It passes five items every single day.** The filter is not biting. Harden it: "Only include an item if you can name the specific decision it changes. If you cannot name the decision, exclude it."

**It misses something you found elsewhere.** Add that source to the list. The routine only knows what you tell it to read.

**Everything is about your industry in general rather than your business.** The bottom section is too thin. "What we depend on" is the line that does most of the filtering — list the actual companies and platforms by name.
