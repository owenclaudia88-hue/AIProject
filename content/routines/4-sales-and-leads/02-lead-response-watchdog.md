# Lead Response Watchdog

Nobody who asked you a question is still waiting tomorrow.

| | |
|---|---|
| **Runs** | Three times a day — 10:00, 14:00, 18:00 |
| **Cron** | `0 10,14,18 * * *` |
| **Connectors** | Gmail. Slack optional |
| **Takes** | Three runs a day |

---

## The cheapest sale you will ever lose

Nobody decides to ignore a prospect. What happens is that an enquiry arrives on a Thursday while you are in the middle of something, you read it, you think "I'll do that properly later", and it slides up the inbox behind eleven other things.

Two weeks later you find it. By then they have bought from someone who answered on Thursday.

This is the most expensive failure in small business sales and it has nothing to do with skill. It is a memory problem. This routine is the memory: three times a day it finds every message where somebody asked you something and nobody replied, and it will keep finding them until you do.

## Set it up

1. **New routine**, name it `Lead Response Watchdog`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** set your thresholds.
4. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 10,14,18 * * *`
5. **Connectors**: Gmail
6. **Create**, then **Run now** — the first run usually finds something uncomfortable

## Instructions

```
Find everybody who is waiting on a reply from us.

Look at email threads from the last 30 days, excluding the senders,
domains and labels listed at the bottom.

A thread needs a reply if all of these are true:
- the last message in it came from outside our organisation
- it contains a question, a request, or a clear expectation of an answer
- nobody from our side has replied since

Ignore automated mail, receipts, newsletters, calendar notifications,
delivery notices and anything where the last message is purely a
courtesy — "thanks", "great, speak then", "no problem". Those do not
need answers, and a watchdog that flags them gets muted within a week.

Group what you find by how long they have been waiting:

OVER THE URGENT THRESHOLD — these come first, longest wait at the top.
OVER THE NORMAL THRESHOLD.
APPROACHING THE NORMAL THRESHOLD — a warning, so nothing crosses it.

For each, give: who, how long they have waited in hours or days, the
subject, the one sentence that needs answering quoted directly, and
whether they look like a prospect, a customer or something else.

Mark anything that is plainly about buying — asking a price, asking how
to start, asking whether it does something — with MONEY at the front of
the line, whatever bucket it is in.

Then give me one number: how many people are currently waiting. That
number is the point of the whole report.

If a thread has been flagged in three consecutive runs, say so. Either it
needs a decision rather than a reply, or it needs to be let go — both are
fine, neither happens by itself.

If nobody is waiting, send one line saying so. That line is worth
sending: it is the only way to know the routine ran.

Never reply to anybody.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Urgent threshold: 24 hours
Normal threshold: 48 hours
Ignore these senders, domains and labels: [e.g. @yourcompany.com,
  noreply@, newsletters, label:Receipts]
Our own email addresses and domains: [e.g. @yourcompany.com, you@gmail.com
  if you use it for work]
```

## Before your first run

**Fill in your own domain.** Without it, internal threads where a colleague asked you something will fill the report. That may be a useful report, but it is not this one.

**The first run will find things from three weeks ago.** Everybody's does. Reply to what still matters, close the rest, and treat the number it gives you as the starting point rather than a judgement.

**Three times a day is deliberate.** Claude allows 5 runs a day on Pro, 15 on Max. Three gives you a morning, an afternoon and an end-of-day check without eating the allowance. On Pro, `0 10,17 * * *` is the sensible version.

**Set the thresholds to what you can actually honour.** A 4-hour urgent threshold that you miss every day teaches you to ignore the report. 24 and 48 are defaults, not standards.

## What a good run looks like

> **7 people are waiting on you.**
>
> **Over 24 hours — urgent**
> **MONEY** — Priya Shah, 3 days. *"can you send over pricing for a team of four?"*
> **MONEY** — Tom Reilly, 2 days. *"is there any reason I can't start this week?"* — flagged in 3 consecutive runs.
> Northfield Makes, 4 days. *"could you confirm what happens to our data if we stop?"*
>
> **Over 48 hours**
> Alex M., 5 days. *"did you get a chance to look at the file I sent?"*
> Dan W., 6 days — asked for an intro to someone.
>
> **Approaching**
> Marta K., 19 hours. Sarah L., 22 hours.
>
> Tom Reilly has now appeared three runs in a row and is asking to buy. That is not a reply problem.

## Prefer Slack instead of email?

Strongly worth it for this one. A watchdog report in the inbox it is warning you about has a way of getting buried by the same problem it exists to solve.

In the instructions, replace the sending instruction with:

> Post the result as a single message to the #sales channel in Slack.

Change `#sales` to your channel and add the **Slack** connector. Keep
Gmail — it is still what gets read.

## When it goes wrong

**It flags threads that are genuinely finished.** Usually courtesy messages. Add the specific phrases your customers use to the ignore instruction — "cheers", "sounds good", "will do" — and it settles quickly.

**It flags your own team constantly.** Your domain is not in the bottom section.

**It misses things.** Check the 30-day window: an enquiry from five weeks ago is outside it. Widen it to 60 days if you need to, at the cost of a slower run.

**The number is always terrifying.** That is often just what an inbox looks like. Tighten the definition to prospects only if you want it to be a sales tool rather than an inbox audit: add "Ignore anyone who is not a prospect or a paying customer."

**It keeps flagging one thread forever.** That is the routine working correctly. Something you have been avoiding is in there.
