# New Starter Runner

Runs the first ninety days for you, so a new person's third week is not spent waiting.

| | |
|---|---|
| **Runs** | Daily, 08:00 |
| **Cron** | `0 8 * * *` |
| **Connectors** | Google Drive, Gmail, Google Calendar |
| **Takes** | One run a day |

---

## Onboarding fails quietly

The first week of a new job is usually fine. Somebody has thought about the first week.

It is weeks three to eight where it goes wrong, and it goes wrong invisibly. The access they needed was requested and never followed up. The introduction they were promised did not happen. The thirty-day conversation slipped, then slipped again, and by day fifty nobody has asked how it is going — and a new person will not ask, because asking feels like complaining in a job they have had for a month.

This routine holds the plan instead of you. It runs every morning, checks where each new person is, and tells you what is due today and what is late.

## Set it up

1. In Google Drive, write your onboarding plan as a document — see below
2. **New routine**, name it `New Starter Runner`
3. Paste the instructions and **name the plan and list your starters at the bottom**
4. **Schedule** → **Daily** → 08:00
5. **Connectors**: Google Drive, Gmail, Google Calendar
6. **Create**

## Instructions

```
Check on everybody in their first 90 days and tell me what is due.

Read the onboarding plan document named below. Read the list of current
starters at the bottom, with their start dates.

For each person, work out which day of their onboarding they are on, and
then which items from the plan are due today, which are overdue, and
which are coming up in the next three days.

For each item, check whether there is any evidence it happened: a
calendar event that took place, an email about it, a document created.
Be explicit about what you found. "No evidence found" is not the same as
"did not happen", and the difference matters — say which it is.

Report per person:

1. WHERE THEY ARE. Name, day number, and how many plan items are done,
   outstanding and overdue.

2. OVERDUE, longest first. For each: what it is, who owns it, how many
   days late. Anything more than a week late gets called out separately,
   because a week-late access request is somebody sitting unable to do
   their job and not saying so.

3. DUE TODAY, with who owns each.

4. COMING UP in the next three days — especially anything needing
   someone else's time, so it can be booked rather than missed.

5. ANYTHING THAT LOOKS STUCK. Items that have been due for a while, that
   depend on somebody outside the team, or that keep getting rebooked. A
   meeting moved three times is not going to happen without an
   intervention.

Then, across everybody, one combined list of what I personally owe
anybody today.

At the end, note any item in the plan that has been late for more than
two starters in a row. That is a broken plan, not a series of
oversights, and it is the most useful thing this routine produces.

Never email a new starter, book anything, or grant any access. Report
only.

If nothing is due or overdue for anybody, say so in one line.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Onboarding plan document: [e.g. Onboarding plan — the document name in Drive]

Current starters — name, start date: [e.g. J. Meyer — 2 September 2026]

Who owns what, by default: [e.g. Ops owns accounts and equipment. The manager owns everything else]
```

## Writing the plan document

Plain list. Each line: which day it is due, what it is, and who owns it.

```
Day -3   Laptop ordered and delivered               Ops
Day 1    Accounts created, all systems              Ops
Day 1    Welcome lunch                              Manager
Day 2    Read the handbook                          Starter
Day 3    Shadowing session with the team            Manager
Day 5    First one-to-one                           Manager
Day 10   First piece of real work, owned end to end Manager
Day 14   Two-week check-in                          Manager
Day 30   Thirty-day conversation                    Manager
Day 45   Introduced to the five people they will    Manager
         work with most
Day 60   Sixty-day conversation                     Manager
Day 90   Probation review                           Manager
```

Twelve to twenty items is right. A plan of sixty items is a plan nobody follows and this routine will simply report forty overdue things every morning until you stop reading it.

Put the awkward ones in. The thirty-day conversation is the single highest-value item on any onboarding plan and the one most reliably skipped, because by day thirty everything seems fine.

## Before your first run

**Keep the starters list current.** It is the one thing the routine needs from you. Add a name and a date when somebody starts; remove them after day 90.

**"No evidence found" is not "did not happen".** Plenty of things happen without leaving a trace. Treat the report as a prompt to check, not as an accusation.

**Section at the end is the real prize.** When the same item is late for three starters running, that item is badly designed — the owner is wrong, or it depends on something that is never ready. Fix the plan rather than chasing it again.

**It does nothing to anybody.** No emails, no calendar invites, no access grants. The one place automation genuinely does not belong is a person's first fortnight.

## What a good run looks like

> **2 people in their first 90 days.**
>
> **J. Meyer — day 22.** 9 done, 3 outstanding, **2 overdue**.
> *Overdue:*
> — **Access to the reporting system — 11 days late**, owner Ops. Requested 3 Sept, no evidence of it being granted. Eleven days is long enough that they have probably worked around it or stopped trying.
> — First one-to-one, 4 days late, owner Manager.
> *Due today:* nothing.
> *Coming up:* Day 30 conversation on Thursday week — book it now, it needs an hour.
> *Stuck:* the one-to-one has been booked and moved twice.
>
> **A. Rahman — day 4.** 4 done, 1 outstanding, 0 overdue.
> *Due today:* shadowing session, owner Manager.
> *Coming up:* first one-to-one on day 5, tomorrow.
>
> **You personally owe today:** the shadowing session with A. Rahman. And the one-to-one with J. Meyer, which is four days late and has moved twice.
>
> **Pattern:** the first one-to-one has now been late for three starters in a row. It is scheduled for day 5, which is a Friday for most starts. Consider moving it to day 8.

## When it goes wrong

**Everything is reported as overdue.** Nothing leaves a digital trace in your business, so it finds no evidence for anything. Either accept it as a daily checklist rather than a status report, or add a column to the plan document that you tick — and point the routine at that instead.

**It misses somebody.** They are not in the starters list. This is the only manual step and it is the only thing that breaks.

**The plan has sixty items.** Cut it to fifteen. An onboarding plan is a list of the things that must not be missed, not a list of everything that happens.

**It reports the same overdue item for a month.** That is the routine working. Something is genuinely not happening, and it will keep saying so.
