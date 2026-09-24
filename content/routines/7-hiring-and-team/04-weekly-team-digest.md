# Weekly Team Digest

What the team actually did this week, without anybody writing a status update.

| | |
|---|---|
| **Runs** | Fridays, 16:00 |
| **Cron** | `0 16 * * 5` |
| **Connectors** | Slack or Gmail, Google Calendar. Google Drive optional |
| **Takes** | One run a week |

---

## Status meetings exist because nobody knows what happened

A small team spends a surprising amount of its week telling each other what it did. A Monday stand-up, a Friday round-up, a document somebody fills in on Thursday afternoon and nobody reads.

All of it is reporting on work that already left traces — in messages, in calendars, in documents. The information exists. It is just scattered, and nobody has the half hour to assemble it, so instead everybody spends fifteen minutes each reassembling it out loud.

This routine assembles it on Friday afternoon. It is not a surveillance tool and it should not be used as one: it reports on work, not on people, and the section that would make it a monitoring tool is deliberately absent.

## A note on using this well

This reads shared channels, shared calendars and shared documents — the places your team has already chosen to work in the open.

It should not be pointed at anybody's private messages or personal inbox, and the instructions below do not ask for per-person activity levels, response times, hours, or anything resembling productivity scoring. A digest that quietly became a monitoring report would change how people use the channels it reads, and within a month it would be reading a performance rather than a week.

Tell the team it exists, and what it reads. A weekly digest everybody knows about is a useful thing. The same digest discovered accidentally is a different thing entirely.

## Set it up

1. **New routine**, name it `Weekly Team Digest`
2. Paste the instructions and **list your channels and projects at the bottom**
3. **Schedule** → **Weekly** → Friday, 16:00
4. **Connectors**: Slack (or Gmail if you work by email), Google Calendar. Add Google Drive if project documents live there
5. **Create**

## Instructions

```
Summarise the team's week.

Read the shared channels listed at the bottom, the shared calendar, and
the project documents if Drive is connected, for the last 7 days.

Report six things. Organise everything by project or workstream, never
by person.

1. WHAT SHIPPED. Anything finished, launched, sent, published or
   delivered this week. Be concrete — the thing, and the day.

2. WHAT MOVED. Work that progressed without finishing, and where it
   got to. One line each.

3. WHAT IS BLOCKED. Anything where a message says something is waiting
   on a person, a decision, an approval, or an external party. For each:
   what it is, what it is waiting for, and how long it has been waiting.
   This is the section people should read first, and it is the section
   status meetings are worst at surfacing.

4. DECISIONS MADE. Anything decided in a channel or a meeting this week.
   Quote the message. Decisions made in chat are the ones that get
   forgotten and then relitigated in three weeks, and writing them down
   once a week is most of the fix.

5. QUESTIONS NOBODY ANSWERED. Anything asked in a shared channel that
   got no reply. Quote it and say when it was asked. An unanswered
   question in a busy channel is the most common cause of a quiet
   blocker.

6. NEXT WEEK. What is in the shared calendar: deadlines, launches,
   meetings that need preparation, anybody away.

Then two lines at the end:
- anything mentioned as a plan for this week that does not appear
  anywhere in sections 1 or 2
- anything that has appeared in the BLOCKED section for three weeks
  running

Do not report on individuals. Do not count messages, measure response
times, note who was quiet, or comment on anybody's activity, hours or
output. If something is attributable, attribute it to the work rather
than to the person, except where naming who is waiting on what is
necessary to unblock it.

Do not read direct messages or private channels.

Post the digest as a single message to the channel named at the bottom,
so the team sees what I see.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Shared channels to read: [e.g. #general, #ops, #projects]
Channel to post the digest to: [e.g. #general]
Current projects or workstreams: [e.g. Stock migration, Help centre, Card
  machine replacement]
Things that are not worth reporting: [e.g. routine admin, anything already
  in the weekly report]
```

## Before your first run

**Post it to the team, not to yourself.** That one decision is what makes this a shared record rather than a management report. Everybody sees the same digest, everybody can correct it, and nobody has to wonder what is in it.

**The blocked section justifies the routine on its own.** In a small team, the thing that has been waiting eleven days for a decision is usually invisible, because the person waiting mentioned it once, in a channel, on a Tuesday.

**It never reports on people.** Read the instruction again before you edit it. The first change anybody is tempted to make is "and tell me who did what", and that is the change that turns a useful digest into something the team starts working around.

**Fridays at four.** Late enough to include the week, early enough that somebody can unblock something before the weekend.

## What a good run looks like

> **Week of 22 September**
>
> **Shipped**
> — New pricing page live, Wednesday.
> — Supplier contract signed and filed, Thursday.
> — Twelve outstanding support threads cleared, across the week.
>
> **Moved**
> — Stock migration: 6 of 9 categories done, remaining three need the supplier's file.
> — Help centre: four pages drafted, none published.
>
> **Blocked**
> — **Stock migration** waiting on the supplier's product file. Asked 9 days ago, chased once.
> — **Card machine replacement** waiting on a decision about which provider. Raised 16 days ago. *Third week in this section.*
> — Help centre publishing waiting on access to the site, requested Monday.
>
> **Decisions made**
> — Moving month-end close to the 3rd rather than the 1st. *"let's just do the 3rd, the 1st never works when it's a weekend"* — Tuesday.
> — Not replacing the old reporting tool this quarter. Thursday.
>
> **Questions nobody answered**
> — *"do we need to tell customers about the pricing page change or just let it go live?"* — asked Monday, no reply. It went live Wednesday.
>
> **Next week**
> — Supplier call Tuesday 10:00.
> — Quarter end Friday.
> — Two people away Thursday and Friday.
>
> *Planned but not seen:* the customer survey was mentioned Monday and has not appeared anywhere since.
> *Blocked three weeks running:* the card machine decision.

## Working by email instead of Slack?

Change the first instruction to read a shared inbox or a label instead, swap the Slack connector for Gmail, and change the posting instruction to:

> Email the digest to the team distribution list.

It works less well — email threads are harder to read as a week of activity than channels are — but it works.

## When it goes wrong

**It reports on people despite the instruction.** Harden it: "Never use a person's name except in the BLOCKED section, and then only to say who a task is waiting on."

**The blocked section is empty and you know things are stuck.** Blockers are being raised in direct messages rather than in channels, which this deliberately does not read. That is a working-practice problem, and the digest has just told you about it.

**It is too long.** Add: "Maximum fifteen items in total. If there are more, keep the blockers and the decisions and cut from the top."

**Nothing is in "decisions made".** Decisions are happening in meetings that leave no written trace. Worth noticing — it is the same reason they get relitigated.
