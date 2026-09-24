# Morning Brief

One page at seven: what happened overnight, what is on today, and the three things that matter.

| | |
|---|---|
| **Runs** | Weekdays, 07:00 |
| **Cron** | `0 7 * * 1-5` |
| **Connectors** | Gmail, Google Calendar. Stripe and Slack optional |
| **Takes** | One run a weekday |

---

## The first hour sets the day

Most days start by opening the inbox, which means the day's priorities are set by whoever emailed you last. That is a genuinely terrible way to decide what matters, and almost everybody does it, because the alternative requires knowing what is in the inbox before you open it.

This routine reads everything before you wake up and hands you one page: what came in overnight, what today actually looks like, and the three things worth doing if the day goes wrong and you only get three things done.

It is the routine most people end up keeping, and it is the one to set up first.

## Set it up

1. **New routine**, name it `Morning Brief`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it.
4. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 7 * * 1-5` if you want weekdays only
5. **Connectors**: Gmail and Google Calendar. Add Stripe if you sell, Slack if your team lives there
6. **Create**, then **Run now** so you can see the shape of it

## Instructions

```
Give me one page for the start of today. Short enough to read standing
up.

Read email since 17:00 yesterday, today's and tomorrow's calendar, and
if connected, Stripe for yesterday and the shared Slack channels.

Six sections, in this order, and nothing else.

1. THE THREE THINGS. The three most important things today, in order,
   each in one line with why. Not a to-do list — the three that would
   make today count. If one of them is something I have been avoiding,
   say so plainly; avoided things do not become less important by being
   avoided, and this is the only section that will ever mention it.

2. TODAY. Every calendar event with the time, and for each one, whether
   anything needs doing before it. Flag anything back-to-back with no
   gap, and anything I have not prepared for. Then how many hours of
   unscheduled time there actually are — that number changes what is
   realistic and nobody ever calculates it.

3. OVERNIGHT. Anything that arrived since yesterday evening and actually
   needs me. Not a list of emails. Use the urgency rules at the bottom.
   If it can wait until tomorrow, leave it out entirely.

4. NUMBERS, if Stripe is connected. Yesterday's revenue and payments,
   against the same day last week. Two lines. Only flag something if it
   moved by more than the threshold below.

5. WAITING ON ME. Anybody who has been waiting more than a day for a
   reply, with how long. Longest first, maximum five.

6. TOMORROW, one line. Anything tomorrow that needs preparation today.
   This is the line that prevents the thing at 09:00 tomorrow that you
   see for the first time at 08:55.

Rules:

- The whole brief fits on a phone screen. If it does not, cut sections 3
  and 5 down, not 1.
- No greeting, no summary of what the brief contains, no encouragement.
- If a section has nothing in it, write one word and move on.
- If today is genuinely quiet, say so. Do not fill it.

Email it to the connected account, subject "[day], [date]".

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

What matters most to this business right now: [e.g. converting the 14 open
  trials before month end]
Urgent means: (who, and what kind of message)
Never urgent: (senders, topics, newsletters)
Revenue change worth flagging: 30%
People whose messages always matter: [e.g. your accountant, your landlord,
  your three largest customers by name]
```

## Before your first run

**"What matters most right now" is what drives section 1.** Without it the three things are just the three loudest emails, which is the problem this exists to solve. Update it when your priorities change — once a quarter is usually enough.

**Set the time so it lands before you start, not while you are starting.** If you get up at seven, run it at six. A brief you read at 09:30 has already lost to the inbox.

**Let it call out the avoided thing.** That instruction is in section 1 on purpose and it is the one most people delete after a fortnight. Leave it.

**Weekdays only, unless you genuinely work weekends.** `0 7 * * 1-5` runs Monday to Friday and saves two runs of your daily allowance for something else.

## What a good run looks like

> **Wednesday, 24 September**
>
> **The three things**
> 1. Send Priya the migration breakdown. Promised Monday, due today, and it is the last thing blocking a £2,400 decision.
> 2. Decide on the card machine. It has been in the blocked list for three weeks and nobody else can decide it.
> 3. Sarah L.'s double charge. Four days, three messages, no reply. This becomes a chargeback tomorrow.
>
> **Today** — 3 hours 20 minutes unscheduled.
> 10:00 Northfield Makes (45m) — *you have not prepared, and their finance lead was added yesterday.*
> 14:00 Supplier call (30m)
> 14:30 Team catch-up (30m) — *back to back with the supplier call.*
>
> **Overnight**
> Sarah L. wrote again at 22:40. Tone has changed, mentions her bank.
> One new enquiry, Harlow & Sons, asking about pricing for 12 people.
>
> **Numbers** — £340 yesterday, 7 payments. Same day last week: £310, 6 payments. Nothing to flag.
>
> **Waiting on you** — Sarah L. 4 days. Tom Reilly 2 days. Alex M. 2 days.
>
> **Tomorrow** — quarter end. The supplier file needs chasing today or Friday will not work.

## Prefer Slack instead of email?

A brief in the inbox competes with the inbox, which is a fair argument for sending it elsewhere.

In the instructions, replace the "Email it" sentence with:

> Post the brief as a single message to my Slack direct messages.

Add the **Slack** connector and keep Gmail as a source.

## When it goes wrong

**It is too long.** The most common problem. Harden it: "Maximum 250 words in total. Cut section 3 first."

**Section 1 is just the three newest emails.** The bottom section is empty. That one field is most of the routine.

**Everything is urgent.** Fill in "never urgent" — newsletters, notifications, suppliers who always mark things important.

**It arrives at the wrong time.** Check the routine's timezone. A routine created in one timezone and read in another is the single most common cause of this, and it is not obvious when it happens.

**It is encouraging.** Add: "No pleasantries, no motivation, no commentary on the day ahead."
