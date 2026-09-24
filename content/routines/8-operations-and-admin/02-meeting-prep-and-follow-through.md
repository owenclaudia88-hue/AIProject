# Meeting Prep & Follow-Through

Walks into every meeting knowing what was decided last time, and out of it with the actions written down.

| | |
|---|---|
| **Runs** | Twice a day — 07:30 and 18:00 |
| **Cron** | `30 7,18 * * *` |
| **Connectors** | Google Calendar, Gmail, Google Drive |
| **Takes** | Two runs a day |

---

## Meetings leak

Every recurring meeting has the same failure. Something gets decided, everybody agrees, and three weeks later it comes up again because nobody wrote it down and everybody remembers it slightly differently.

The same thing happens with actions. "I'll look into that" is said four times an hour and survives about ninety minutes.

This routine runs twice: in the morning it prepares you for the day's meetings, including what was decided in the last one. In the evening it reads the day's notes and pulls out what was decided and who owes what. Together they close the loop that otherwise leaks all week.

## Set it up

1. In Google Drive, make a folder called `Meeting notes`
2. **New routine**, name it `Meeting Prep & Follow-Through`
3. Paste the instructions and **fill in the bottom section**
4. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `30 7,18 * * *`
5. **Connectors**: Google Calendar, Gmail, Google Drive
6. **Create**

## Instructions

```
Do one of two jobs depending on the time of day. Check the current time
and choose.

=== IF IT IS BEFORE MIDDAY: PREPARE ===

Read today's calendar. For each meeting with more than one attendee that
is not on the ignore list at the bottom, give me:

1. When it is, how long, and who is coming. Flag anybody new since the
   invitation was sent.

2. WHAT HAPPENED LAST TIME. Find the most recent notes for this meeting
   in the Drive folder below, or the last email thread about it. Give:
   what was decided, what was left open, and who owed what. If anything
   owed is still not done, say so — this is the single most useful line
   in the whole routine.

3. WHAT IS NEW SINCE. Anything in email between the attendees since the
   last meeting that is relevant.

4. THREE THINGS TO GET OUT OF IT. What would make this meeting worth the
   time. If the honest answer is that there is nothing, say so. A
   recurring meeting with no purpose this week is a meeting to cancel,
   and nobody ever says it out loud.

5. ANYTHING I OWE, due at this meeting, from last time.

=== IF IT IS AFTER MIDDAY: FOLLOW THROUGH ===

Read every document in the Drive folder below created or edited today,
and today's calendar for context. If there is nothing new, send nothing
and stop.

For each meeting:

1. DECISIONS. Everything decided, in one line each, written so somebody
   who was not there understands it. Quote the wording if it was
   specific. If something was discussed and not decided, say so
   explicitly and say what it is waiting on — undecided things that look
   decided are how the same conversation happens three times.

2. ACTIONS. Every commitment: what, who, by when. Include the vague ones
   — "I'll look into that" is an action with no date, and it should
   appear as exactly that rather than being dropped.

3. WHAT WAS RAISED AND NOT RESOLVED. Anything brought up that went
   nowhere. These become next meeting's agenda.

4. WHAT I OWE, due when.

Then, across the day, one combined list of every action from every
meeting, grouped by owner, with anything undated flagged as "no date —
decide one".

Email it to the connected account, subject "Meeting prep — [date]" in
the morning, "Meeting follow-up — [date]" in the evening.

Never send anything to anybody else.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Drive folder for notes: Meeting notes
Ignore meetings with these titles or attendees: [e.g. Standup, 1:1, Lunch,
  Dentist, anything with only me in it]
My own email address: [e.g. you@yourcompany.com]
```

## How to take the notes

The evening half needs something to read. A document per meeting in the folder, named with the meeting and the date, is enough. Type during it — fragments are fine.

Two habits make the output much better:

- put a `>` in front of anything anybody commits to
- write the exact words when a decision is made, rather than your summary of it

If nobody takes notes at all, the morning half still works on its own — it reads email and calendar. You lose the closing of the loop, which is the better half.

## Before your first run

**The "still not done from last time" line is the point.** Most recurring meetings spend their first ten minutes rediscovering what was agreed a fortnight ago. Having it in front of you changes the meeting.

**Let it tell you a meeting has no purpose.** Section 4 is allowed to say there is nothing to get out of today's recurring call. That is worth hearing once a month.

**Two runs a day, not more.** Claude allows 5 a day on Pro, 15 on Max. This takes two and covers the whole loop. On Pro that still leaves three for everything else.

**Nothing is sent to attendees.** The follow-up list is yours. Sending automated minutes to other people is a different decision and should be a deliberate one.

## What a good run looks like

> **Morning — 2 meetings today.**
>
> **10:00 — Supplier review (30m). Marcus, Jen, and Ana, who is new since the invite went out.**
>
> *Last time, 10 September:* decided to move to fortnightly ordering from October. Left open: whether the minimum order value changes. Marcus owed the revised price list **and it has not arrived** — nothing in email since.
>
> *New since:* Jen emailed on the 18th asking whether fortnightly starts on the 1st or the 15th. Nobody replied.
>
> *Three things to get out of it:* the price list, an answer to Jen's question, and a decision on the minimum order.
>
> *You owe:* the forecast volumes, promised on the 10th. Not done.
>
> ---
>
> **Evening — 2 meetings, 6 actions, 3 decisions.**
>
> **Supplier review**
> *Decisions:* fortnightly ordering starts 15 October, not 1 October. Minimum order stays at £400.
> *Discussed and NOT decided:* whether to add the second product line. Waiting on Ana's stock figures.
> *Actions:*
> > Marcus — revised price list — **Friday**
> > You — forecast volumes — **Thursday**
> > Ana — stock figures for the second line — *no date given*
> *Raised, unresolved:* delivery windows on Mondays. Mentioned twice, dropped both times. Agenda for next time.
>
> **Everything you owe today**
> **Thu** — forecast volumes → Marcus
> **Fri** — the two references → Tom Reilly
> **No date, decide one** — whether to reply to Jen's fortnightly question directly

## When it goes wrong

**It prepares for your dentist appointment.** Add single-attendee and personal events to the ignore list.

**"What happened last time" is always empty.** It cannot find the previous notes. Name the documents consistently — the meeting name and the date — and keep them all in one folder.

**It runs the wrong half.** The time check is doing the switching. If it misbehaves, split it into two separate routines with one instruction each; it costs the same two runs a day and removes the ambiguity.

**It misses casual commitments.** The `>` habit is the fix, and it is worth building.

**It reprocesses old notes.** It reads by edit date, so opening an old document makes it today's. Move processed notes into a `Done` subfolder.
