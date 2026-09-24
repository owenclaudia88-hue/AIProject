# Call Notes To Actions

Turns the mess you typed during a call into a follow-up email and a list of what you promised.

| | |
|---|---|
| **Runs** | Daily, 17:00 |
| **Cron** | `0 17 * * *` |
| **Connectors** | Google Drive, Gmail |
| **Takes** | One run a day |

---

## The promise you forgot you made

On a good call you say "I'll send you that" three or four times. Then the call ends, the next one starts, and by Friday you have a vague sense of owing somebody something.

The customer does not have a vague sense. They remember exactly what you said you would send, and every day it does not arrive is a small deposit into the account marked "are these people organised".

This routine reads whatever you typed during the call — however untidy — and pulls out two things: the follow-up email you should send them, and the list of things you committed to. It runs at five, so the day's calls get closed off while you can still remember them.

## Set it up

1. In Google Drive, make a folder called `Call notes`. During or right after a call, type into a new document in there. No structure, no tidying — fragments are fine
2. **New routine**, name it `Call Notes To Actions`
3. Paste the instructions and **fill in the bottom section**
4. **Schedule** → **Daily** → 17:00
5. **Connectors**: Google Drive and Gmail
6. **Create**

## Instructions

```
Turn today's call notes into follow-ups and commitments.

Read every document in the Google Drive folder named below that was
created or edited today. If there are none, send nothing at all and stop.

For each one, produce four things.

1. A CLEAN SUMMARY, under 150 words, for me and not for them. What they
   want, what state the conversation is in, and what is actually
   blocking a decision. If the notes do not make the blocker clear, say
   that rather than choosing one.

2. WHAT I COMMITTED TO. Every instance of "I'll send", "I'll check",
   "let me find out", "I'll get back to you" — including the ones that
   were said casually. For each, what it is, who it is for, and by when
   if a time was mentioned. If no date was given, say "no date given"
   rather than assuming one.

3. WHAT THEY COMMITTED TO. The same, for their side. This is the half
   nobody writes down and it is the half that determines whether
   anything actually happens.

4. THE FOLLOW-UP EMAIL, ready to send. Under 150 words:
   - one line of context, not a recap of the whole call
   - the two or three things that were agreed, as a short list
   - what I am doing next and when
   - what they are doing next, stated plainly but without nagging
   - no pleasantries beyond one line at each end

Then, across all of today's calls, give me one combined list of
everything I owe anybody, sorted by when it is due. Anything with no
date goes at the bottom marked "no date — decide one".

Write in my voice, described at the bottom. Never invent a commitment
that is not in the notes. If the notes are ambiguous about who was
meant to do something, say it is ambiguous — that is exactly the kind of
thing worth catching on the day rather than in three weeks.

Email everything to the connected account, subject "Call follow-ups —
[date]".

Never send anything to a customer. Draft only.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Drive folder to read: Call notes
How I write to customers: [e.g. first names, short paragraphs, say the awkward thing plainly]
Things I always promise and often forget: [e.g. sending case studies, introductions, the follow-up breakdown]
```

## Typing notes that work

You do not need to be neat. The routine is genuinely good at untangling fragments. What helps:

- write down the exact words when somebody says something important
- put a `>` or a `*` in front of anything you promise, so it is unmissable
- note what they seemed unsure about, not only what they said
- do not write the summary — that is the thing being automated

Two lines of real quotes beat a page of tidy paraphrase every time.

## Before your first run

**Put a document in the folder first.** An empty folder means an empty run and looks like a fault.

**It sends nothing.** Every follow-up goes to somebody mid-decision.

**The combined list is the part that changes things.** One place, every day, with everything you owe anybody in it. Most people have never had that.

**Five in the afternoon, not the next morning.** The value decays fast. Notes read on the day still have your memory attached to them; the same notes on Thursday are archaeology.

## What a good run looks like

> **2 calls today.**
>
> **Northfield Makes — Priya Shah, Daniel Okafor**
>
> *Summary:* Priya is convinced. Daniel is the one deciding and his concern is the cost of the two days of migration rather than the licence. They are comparing against staying on the spreadsheet, not against a competitor, which is the more winnable comparison.
>
> *You committed to:* the migration breakdown in writing, **by Wednesday**. Confirming whether the September price holds if they sign in October — **no date given**.
>
> *They committed to:* Daniel to check with their accountant before Friday. Priya to send the current spreadsheet so you can size the migration.
>
> *Follow-up email:*
> > Priya, Daniel — thanks for this morning. To confirm: I am sending the migration breakdown by Wednesday, with the two days costed properly rather than waved at. You are checking with your accountant before Friday, and Priya is sending the current sheet so I can size it accurately. If the September price is the sticking point, tell me — that is a conversation worth having before Friday rather than after.
>
> ---
>
> **Everything you owe, by date**
> **Wed** — migration breakdown → Priya Shah
> **Thu** — the three references → Tom Reilly
> **No date, decide one** — whether September pricing holds into October → Daniel Okafor

## Prefer to skip the Drive folder?

If you would rather email yourself the notes than keep a folder, that works: change the first instruction to *"read emails I sent to myself today with 'notes' in the subject"* and drop the Drive connector.

The folder is better if you type during calls. Email is better if you dictate afterwards on your phone.

## When it goes wrong

**It invents commitments.** Usually because the notes are all paraphrase and no quotes. Mark promises with a `>` as you type and this disappears.

**It misses the casual ones.** "I'll dig that out for you" does not look like a commitment in a wall of text. The `>` habit fixes this too — it is the single highest-value thing you can change.

**The emails are too long.** Tighten it: "Maximum 100 words. If you cannot fit everything, drop the context line first."

**It processes yesterday's notes again.** It reads by edit date, so opening an old document to look at it makes it today's. Either do not reopen them, or move each one to a `Done` subfolder after the follow-up goes out.
