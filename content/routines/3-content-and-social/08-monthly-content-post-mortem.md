# Monthly Content Post-Mortem

Once a month, an honest answer to whether any of this is working.

| | |
|---|---|
| **Runs** | 1st of the month, 09:00 |
| **Cron** | `0 9 1 * *` |
| **Connectors** | Google Drive, Stripe, Gmail |
| **Takes** | One run a month |

---

## The question weekly reports cannot answer

A weekly content report tells you which post did best. It cannot tell you whether posting is worth doing, because a month is the shortest window in which content and revenue are visibly related at all.

This is the routine that asks the uncomfortable question once a month, with the numbers in front of it: did any of this produce anything? Which platform is actually carrying it? And is there something you have been doing every week for a year out of habit rather than evidence?

It is allowed to tell you to stop doing something. Most reports are not, which is why most reports never save anybody any time.

## Set it up

1. **New routine**, name it `Monthly Content Post-Mortem`
2. Paste the instructions and **fill in the bottom section**
3. **Schedule** → **Monthly** → 1st, 09:00
4. **Connectors**: Google Drive (for the performance sheet), Stripe, Gmail
5. **Create**

This shares its performance sheet with the Content Performance Digest. If you already run that one, you are already set up.

## Instructions

```
Review last month's content honestly, including whether it was worth
doing.

Read the performance sheet named below for last calendar month, and for
the five months before it as context. Read Stripe for the same periods.

Report six things.

1. THE VOLUME. How many pieces, by platform and format. Compare with the
   previous month and with the monthly average. If output dropped, say
   so plainly rather than softening it.

2. THE REACH. Total and average per piece, by platform. Say whether each
   platform is trending up, flat or down across the six months. Six
   months, not one — a single bad month is weather.

3. THE MONEY, as far as it can honestly be established. Number of
   Stripe payments and total revenue last month, and whether it moved
   with the content or independently of it. Be careful and be honest
   here: unless the sheet records where customers came from, you cannot
   attribute revenue to content, and you should say that outright rather
   than implying a connection that the data does not support.

4. THE TOP FIVE PIECES OF THE MONTH, against baseline, with their
   opening lines. And whether anything from previous months is still
   getting meaningful reach — evergreen pieces are the highest-value
   thing in content and nobody notices them, because everyone looks at
   this week.

5. WHAT TO STOP. Name any platform or format that, over six months, has
   taken consistent effort and produced reach well below the others with
   no upward trend. Say how many pieces went into it. This is the most
   useful section in the report and the one most likely to be wrong, so
   give the numbers and let me decide.

6. THE ONE EXPERIMENT FOR NEXT MONTH. One. Something not tried in the
   last six months, with a specific description and a specific way to
   tell whether it worked.

Email the result to the connected account, subject "Content post-mortem —
[month]".

Two things to avoid. Do not claim content caused a revenue change unless
the sheet actually records attribution. And do not recommend stopping
something with fewer than ten pieces behind it — that is not evidence,
that is a small sample.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Performance sheet: Content performance
Platforms and formats I use: [e.g. LinkedIn short and long posts, Instagram carousels, a weekly email]
How much time a month I am willing to spend on content: [e.g. about 8 hours]
What content is for, in one sentence — sales, trust, recruiting,
reputation, or something else: [e.g. trust — people buy months later, so measuring it on this month’s sales is wrong]
```

## Before your first run

**It needs six months of history to do the interesting half.** With one month it produces a competent summary. The "what to stop" section is the reason to run it, and that section needs enough history to distinguish a trend from a bad month. If you are starting the sheet now, run this monthly anyway and expect it to get sharp around month four.

**Answer "what content is for" honestly.** If content exists to build trust rather than to sell, a report measuring it on revenue will tell you to stop everything. This one line changes the whole tone of the output.

**The stop recommendation will sting at some point.** That is the routine doing its job. It gives you the figures alongside it precisely so you can overrule it — there are good reasons to keep doing something that does not perform, and it does not know them.

## What a good run looks like

> **Volume** — 31 pieces, down from 44. LinkedIn steady at 12, Instagram down from 20 to 9, email unchanged at 4.
>
> **Reach** — LinkedIn averaging 2,400 a post, up 31% across six months. Instagram averaging 180, flat for six months. Email open rate 38%, down from 44% in April.
>
> **Money** — 112 payments, £4,480, up 9% on last month. Your sheet does not record where customers came from, so this cannot be attributed to content. What can be said is that revenue rose in a month when output fell by a quarter, which at minimum means content volume is not the thing driving it.
>
> **Top five** — all LinkedIn. Four of five opened with a contradiction. And a March post is still picking up 400 views a month with no promotion, which makes it the best thing you have published all year.
>
> **What to stop** — Instagram. 61 pieces across six months, averaging 180 reach, no upward trend at any point. That is the largest effort for the smallest return of anything you do. Worth noting before you act: if Instagram is where your customers are, reach is the wrong measure and you should ignore this.
>
> **Experiment for next month** — one long written piece on the March topic, since it keeps finding readers. Success looks like 500 views in the first fortnight without promotion.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to your channel and swap **Gmail** for **Slack**. Keep
Drive and Stripe.

## When it goes wrong

**It claims content drove revenue.** Add a `source` column to your sheet, or harden the instruction: "State explicitly that attribution is not available, in its own sentence, before giving any revenue figure."

**It never recommends stopping anything.** Either everything genuinely works, or you have fewer than ten pieces per platform. Check the volume figures first.

**It recommends stopping the thing you care most about.** Look at what you wrote for "what content is for". A report told that content is for sales will judge everything on sales.

**Nothing arrives on the 1st.** Monthly schedules run on the 1st at the hour you set. If the 1st is a Sunday it still runs — routines do not observe weekends. If it genuinely did not fire, check the run history before assuming the schedule is wrong.
