# Discovery Call Prep

A one-page brief on everybody you are speaking to today, waiting for you at breakfast.

| | |
|---|---|
| **Runs** | Daily, 07:00 |
| **Cron** | `0 7 * * *` |
| **Connectors** | Google Calendar, Gmail |
| **Takes** | One run a day |

---

## Preparing is not the problem, remembering to is

You know that you should read the thread before the call. You intend to. Then the call before it overruns, and you join at 14:01 having read the subject line, and you spend the first six minutes asking things they already told you in writing.

They notice. Everybody notices.

This routine reads your calendar the night before you need it, finds out who everybody is, digs their history out of your own inbox, and hands you a single page per call. It runs at seven in the morning so that the preparation has already happened by the time your day starts going wrong.

## Set it up

1. **New routine**, name it `Discovery Call Prep`
2. Paste the instructions and **fill in the bottom section**
3. **Schedule** → **Daily** → 07:00
4. **Connectors**: Google Calendar and Gmail
5. **Environment**: **Full** or **Custom**, so it can look people up. Without it the research section is empty
6. **Create**

## Instructions

```
Brief me on today's calls.

Read today's calendar. For each event that involves somebody outside our
organisation, and that is not one of the meeting types excluded at the
bottom, write a one-page brief.

Each brief:

1. THE BASICS. Time, length, who is attending, and the meeting title.
   Flag if more people have been added since it was booked — an extra
   attendee usually means a decision-maker joined, and it changes how
   the call should go.

2. THE HISTORY. Everything in our email with these people. When they
   first got in touch, what they originally asked for, what we have
   already told them, what was promised and by when. Quote the two or
   three sentences that matter most, in their words.

3. OPEN LOOPS. Anything they asked that we did not answer, and anything
   we said we would do and have not. Check this carefully. Walking into
   a call with an unanswered question from three weeks ago still open is
   the most common own goal there is.

4. WHO THEY ARE. What you can find publicly about the person and their
   company, with a source for each fact. If you find nothing, say so.
   Never infer someone's role, company size or budget from their email
   address.

5. WHAT THIS CALL IS FOR, in one sentence — what has to be true at the
   end for it to have been worth doing. Mark it as your reading, not
   theirs.

6. FIVE QUESTIONS to ask. Specific to this person, drawn from the
   history, not generic discovery questions. If they said something
   vague in writing, the question that makes it concrete belongs here.

7. THE LIKELY OBJECTION, based on what they have actually said, and one
   honest sentence in response. Honest, not a rebuttal — if their
   concern is reasonable, say that it is reasonable.

Order the briefs by when the calls are.

Email everything to the connected account, subject "Today's calls —
[date]". Put a one-line summary of each call at the very top so the
first screen tells me what today looks like.

If there are no external meetings today, send one line saying so.

--- EDIT BELOW THIS LINE ---

Ignore meetings with these titles or attendees:
What we sell:
What usually goes wrong on these calls:
Things I always forget to ask:
```

## Before your first run

**"Things I always forget to ask" is the best line in the bottom section.** Everybody has two or three. Write them down once and they appear in every brief forever, which is a genuinely permanent fix to a recurring problem.

**Exclude your internal meetings properly.** Your stand-up does not need a competitive brief. Put the recurring titles in the ignore list on day one.

**Seven in the morning, not the night before.** A brief written at 18:00 is stale by 14:00 the next day if they replied overnight. Move it earlier if you start earlier; keep it on the same day as the calls.

**Set the environment to Full or Custom** or section 4 will be blank every day.

## What a good run looks like

> **Today: 2 external calls.**
> **10:00** Northfield Makes — second call, they have added their finance lead.
> **15:30** Tom Reilly — first call, came in from the newsletter.
>
> ---
>
> **10:00 — Northfield Makes (45 min)**
> Priya Shah, plus **Daniel Okafor, newly added yesterday**. Adding a finance person to a second call usually means they are pricing it properly.
>
> *History:* first contact 12 Sept — *"we're doing this in a spreadsheet and it's falling over now there are four of us"*. First call on the 19th. You promised a written breakdown of migration time **and have not sent it**.
>
> *Open loops:* the migration breakdown. Priya also asked on the 20th *"what happens to our data if we stop"* and the reply covered pricing but never answered that question.
>
> *Who:* Northfield Makes, furniture workshop in Leeds, four people listed on their site. Daniel Okafor appears on the same page as finance. Source: their about page.
>
> *What this call is for* (your reading): getting a yes in principle from Daniel on cost, with Priya already convinced on the substance.
>
> *Five questions:* ...
>
> *Likely objection:* the migration. She has raised time twice and you have not answered either time. Honest response: it is two days of somebody's attention, not two hours, and pretending otherwise now would be found out in week one.

## Prefer Slack instead of email?

In the instructions, replace the "Email everything" sentence with:

> Post the summary as one message to the #sales channel in Slack, then
> post each brief as a reply in that thread.

Add the **Slack** connector; keep Calendar and Gmail as the sources.

## When it goes wrong

**It briefs your internal meetings.** Fill in the ignore list with the recurring titles.

**The history section is thin.** It is searching the wrong thing. If your conversations happen under a different address or in a shared inbox, say so explicitly in the bottom section.

**It invents things about the company.** Harden it: "Give the URL for every fact in section 4. No URL, no fact."

**The questions are generic.** That means the history is thin — see above. Good questions come from what they already said, so if it could not find what they said, it falls back to textbook discovery.

**Nothing arrives at 07:00.** Check the timezone on the routine. A routine set up in one timezone and read in another is the single most common cause of a report arriving at the wrong time.
