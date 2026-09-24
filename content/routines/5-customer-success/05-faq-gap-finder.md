# FAQ Gap Finder

The questions you answer over and over, and the page that would stop them being asked.

| | |
|---|---|
| **Runs** | Fridays, 16:00 |
| **Cron** | `0 16 * * 5` |
| **Connectors** | Gmail. Google Drive optional |
| **Takes** | One run a week |

---

## Every repeated question is a bill

If four people a week ask you the same thing, that is not four support emails. It is four support emails every week, forever, plus an unknown number of people who wondered the same thing, did not ask, and left.

The second group is always larger than the first, and it never shows up anywhere you can see it.

This routine reads the week's questions, groups the ones that are really the same question, ranks them by how much they are costing you, and writes the answer for whichever is worst. Not a list of things to do — one finished answer, every week, ready to paste onto your site.

## Set it up

1. **New routine**, name it `FAQ Gap Finder`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** tell it where your documentation is.
4. **Schedule** → **Weekly** → Friday, 16:00
5. **Connectors**: Gmail. Add Google Drive if you keep your documentation there
6. **Environment**: **Full** or **Custom** with your own domain, so it can check whether your site already answers something
7. **Create**

## Instructions

```
Find the questions we keep answering, and write the answer to the worst
one.

Read the last 7 days of email — both what came in and what we sent —
excluding the senders and labels at the bottom.

Pull out every question a customer or prospect asked. Then group them by
what they actually mean, not by how they were worded. "Does this work on
my phone", "is there an app", and "can I use this when I'm out" are one
question, and treating them as three is how this analysis usually fails.

For each group, give:
- the question, phrased the way a customer would search for it
- how many times it came up this week
- two or three of the actual wordings people used, quoted. These are
  worth more than the summary, because they are the words to use in the
  answer
- whether it is already answered somewhere — check the documentation
  location at the bottom, and check the public site. Say where, or say
  "not answered anywhere"
- whether the people asking are customers or prospects. A prospect
  asking is a sale at risk; a customer asking is time at risk

Rank the groups by cost: how many times, multiplied by whether it is
prospects asking.

Then three things:

1. THE WORST ONE. The single highest-cost unanswered question. Write the
   answer in full, ready to publish: a heading phrased as the question,
   and 80 to 150 words. Use the customers' own words. Answer it directly
   in the first sentence — do not build up to it.

2. ANSWERED BUT NOT FINDABLE. Any question that is documented and still
   being asked repeatedly. That is not a content gap, it is a navigation
   problem, and the fix is different. Say where it lives and where it
   probably should be.

3. THE QUESTION THAT IS NOT REALLY A QUESTION. Anything where the real
   issue is that the product is confusing rather than undocumented. Say
   plainly that documentation will not fix it. This is the one worth
   reading twice.

Email the result to the connected account, subject "FAQ gaps — week of
[date]".

Do not write answers for more than one question a week. One finished,
publishable answer beats five outlines, because the five outlines will
still be outlines next month.

Do not invent an answer. If you do not know how the product handles
something, write the heading and put [NEEDS YOUR ANSWER] underneath.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Where our documentation lives: [e.g. the Help folder in Drive, or
  https://help.yourcompany.com]
Our public site: [e.g. https://yourcompany.com]
Ignore these senders, domains and labels: [e.g. @yourcompany.com,
  noreply@, newsletters, label:Receipts]
Questions we have already answered this quarter: [add each one here after
  you publish it, so it stops being suggested]
```

## Before your first run

**One answer a week is the design.** Fifty-two published answers in a year, written in the customers' own words, is a genuinely good help section. A weekly list of twelve things to write is a list nobody reads by March.

**Section 3 is the valuable one.** Some questions are asked repeatedly because the product is confusing at that point. No amount of documentation fixes that, and a routine that only ever suggests writing more documentation would hide it.

**Watch the customer-versus-prospect split.** A question asked mostly by prospects belongs on your sales page, not in your help centre, and the routine will tell you which is which.

**Set the environment to Full or Custom** so it can actually check your site before declaring something undocumented.

## What a good run looks like

> **7 distinct questions this week. 23 questions asked in total.**
>
> **Ranked by cost**
> 1. Does it work on a phone — **5 times, 4 of them prospects.** Not answered anywhere.
> 2. What happens to my data if I cancel — 3 times, all customers. Answered, buried in the terms.
> 3. Can two people use one account — 3 times, mixed. Not answered.
>
> **The worst one, written and ready**
>
> > **Does this work on a phone?**
> >
> > Yes — everything works in a phone browser, and there is no app to install. Most people set it up on a laptop, because the initial connection step involves a lot of copying and pasting, and then do everything afterwards on their phone. If you only have a phone, that works too; the setup just takes a few minutes longer.
> >
> > *Their words, for the search terms: "an app", "on my phone", "when I'm out and about".*
>
> **Answered but not findable**
> "What happens to my data if I cancel" is answered in section 7 of the terms. Three customers asked anyway. Nobody reads terms. It belongs in the help centre and on the pricing page.
>
> **Not really a question**
> Four people this week asked some version of "did it work?" after finishing setup. That is not a documentation gap. There is no confirmation at the end of your setup flow, so people finish and cannot tell whether they finished. Writing a help page about it will not fix it.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #support channel in Slack.

Add the **Slack** connector and keep Gmail as the source.

## When it goes wrong

**It splits one question into five.** The grouping instruction is losing. Harden it: "Group by the underlying thing the person wants to know. Two questions with different wording and the same answer are one question."

**It says everything is undocumented.** It cannot read your documentation. Check the environment setting and the location you gave it. If your help centre is behind a login, paste the list of existing page titles into the bottom section instead.

**It writes the same answer every week.** Keep the "already answered this quarter" list updated, or connect Drive and have it read your actual help folder.

**It invents how the product works.** The [NEEDS YOUR ANSWER] instruction is the guard. If it still guesses, harden it: "You do not have access to the product. Only state behaviour that is described in an email or in the documentation."
