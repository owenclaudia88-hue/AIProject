# Content Performance Digest

Which posts actually worked last week, and what they had in common.

| | |
|---|---|
| **Runs** | Tuesdays, 09:00 |
| **Cron** | `0 9 * * 2` |
| **Connectors** | Google Drive or Zapier, Gmail |
| **Takes** | One run a week |

---

## The number that matters is not the biggest number

Everyone knows which post did best last week. You saw the notifications. What almost nobody knows is *why*, and that is the only part that changes what you do next.

This routine does the comparison you would do if you had an hour: it lines the week's posts up against your own recent average, ignores the ones that are just noise, and looks for what the winners share. Format, hook, length, day, topic. Then it says what to do more of.

It is deliberately unimpressed by big numbers with no lesson in them.

## Set it up

1. Decide where the numbers come from — see the next section. A Google Sheet is the usual answer
2. **New routine**, name it `Content Performance Digest`
3. Paste the instructions and **name your sheet at the bottom**
4. **Schedule** → **Weekly** → Tuesday, 09:00
5. **Connectors**: Google Drive (or Zapier) and Gmail
6. **Create**

Tuesday, not Monday: weekend posts need a day to finish performing.

## Instructions

```
Report on what worked in last week's content, and why.

Read the performance sheet named below. Take every post published in the
last 7 days, and the 8 weeks before that as the baseline.

For each of last week's posts, work out how it did against your own
recent average for the same platform and format — not against an
absolute number. A post with 400 views is a success on an account that
usually gets 200 and a failure on one that usually gets 4,000.

Report:

1. THE TOP THREE, by performance against baseline, not by raw number.
   For each: the platform, the format, the opening line, the numbers,
   and the multiple of baseline.
2. THE BOTTOM TWO, the same way. Ignore anything published in the last
   48 hours — it has not finished.
3. WHAT THE WINNERS SHARE. Look at format, length, the type of opening
   (question, claim, story, number, disagreement), the subject, the day
   and the time. Name only patterns that hold across at least two of the
   three. Say plainly if there is no pattern this week — one good post is
   not a trend, and pretending otherwise sends me in the wrong direction.
4. WHAT THE LOSERS SHARE, the same way and with the same honesty.
5. THE ONE THING TO DO MORE OF NEXT WEEK. One, specific enough to act on
   today. "Post more video" is not specific. "Open with the objection
   rather than the promise, the way Thursday's post did" is.

Then track the trend: is the 4-week average moving up or down, per
platform? One line each, with the numbers.

Email the result to the connected account, subject "Content performance —
week of [date]".

If a post did unusually well for an obvious reason unrelated to the
content — it was shared by a large account, it was a reply to something
that went around — say so and exclude it from the patterns. Those are
luck, and treating luck as a lesson is how people end up chasing the
wrong thing for a month.

--- EDIT BELOW THIS LINE ---

Performance sheet: Content performance
Platforms I publish on:
```

## Getting the numbers into a sheet

There is no universal analytics connector, so the numbers have to land somewhere Claude can read. Three ways, easiest first.

**Export by hand, once a week.** Most platforms will export a CSV of the last 30 days from their analytics screen. Drop it in Drive. Five minutes a week, works everywhere, no setup.

**Zapier.** If your platform has a Zapier trigger for new posts and stats, have it append a row to a Google Sheet. Set up once, then it runs itself.

**Whatever your scheduler already gives you.** If you post through a scheduling tool, it almost certainly already keeps these numbers and will export them. Check there before building anything.

The sheet only needs: date, platform, format, the opening line, and one or two numbers. Views and engagement are plenty. More columns do not make the report better.

## Before your first run

**It needs history to be useful.** With one week of data it can rank last week's posts but not tell you anything about patterns. Eight weeks is where it starts being worth reading; four is the minimum.

**Include the opening line in the sheet.** This is the column people leave out, and it is the one that carries most of the insight. Patterns in hooks are the patterns that transfer.

**It is allowed to say there is no pattern.** Most weeks there is not. A report that manufactures a lesson every single week is worse than one that shrugs, because you will act on the manufactured ones.

## What a good run looks like

> **Top three, against your own baseline**
> 1. Thursday, long post — 3.4× baseline. Opened with *"Your best-selling product is probably your least profitable one."*
> 2. Tuesday, short post — 2.1×. Opened with a number.
> 3. Sunday, email — 1.8× your usual open rate.
>
> **Bottom two**
> Monday's short post, 0.3×, opened with *"Excited to share..."*. Wednesday's carousel, 0.4×, nine slides.
>
> **What the winners share**: all three open by contradicting something the reader believes. Two of three are text, not visual. None of them mention the product in the first half.
>
> **What the losers share**: both open by describing what the post is about rather than making a claim.
>
> **Do more of**: open with the contradiction. Thursday's line is the template — take a thing your audience assumes, and say the opposite in under twelve words.
>
> **Trend**: LinkedIn 4-week average up 22%. Instagram flat. Email opens down from 41% to 36% — worth watching, not yet worth acting on.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #content channel in Slack.

Change `#content` to your channel, then swap the **Gmail** connector for
**Slack**. Keep Drive — that is where the numbers live.

## When it goes wrong

**Every week has a confident pattern.** It is over-reading. Add: "Do not name a pattern unless it holds across all three top posts. If it holds across two, say so and call it weak."

**It ranks by raw views anyway.** The sheet is probably missing older rows, so it has no baseline to compare against. Check that the eight weeks of history are actually in there.

**The recommendation is always the same.** That may be correct — if opening with a contradiction works every week, keep doing it. If it is genuinely stale, add: "Do not repeat last week's recommendation. If the same pattern holds, say so in one line and give the next most useful thing instead."
