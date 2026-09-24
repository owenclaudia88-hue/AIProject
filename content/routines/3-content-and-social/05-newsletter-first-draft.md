# Newsletter First Draft

Your weekly email, already written badly, so you only have to make it good.

| | |
|---|---|
| **Runs** | Wednesdays, 08:00 |
| **Cron** | `0 8 * * 3` |
| **Connectors** | Gmail, Google Drive |
| **Takes** | One run a week |

---

## The blank page is the only hard part

Most people who stop sending a newsletter did not decide to stop. They missed one week, then it had been three weeks, then sending felt like an event rather than a habit.

The thing that breaks the habit is always the same: opening a blank draft on Wednesday morning with nothing in your head.

This routine makes sure the draft is never blank. It writes a first version from whatever you have been doing, thinking and answering that week, and leaves it in your inbox before you start. Editing something mediocre takes twenty minutes. Starting from nothing takes the whole morning, which is why it does not happen.

## Set it up

1. In Google Drive, make a document called `Newsletter notes`. During the week, paste anything into it — a thought, a link, a customer question, a half sentence. No structure needed
2. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it.
3. **New routine**, name it `Newsletter First Draft`
4. Paste the instructions into the big **Instructions** box
5. **Schedule** → **Weekly** → Wednesday, 08:00
6. **Connectors**: Google Drive and Gmail
7. **Create**

## Instructions

```
Write this week's newsletter as a first draft.

Read the notes document named below, and use anything added to it since
your last run. Also use anything in the standing material at the bottom.

Pick ONE idea. Not three. A newsletter about one thing gets read; a
newsletter about three things gets skimmed and then unsubscribed from.
Choose the idea that is most specific, not the one that is most
important — specific beats important in an inbox.

Write the email in this shape:

- SUBJECT LINE. Under 45 characters. It should make somebody curious
  without promising anything the email does not deliver. Give three
  options and mark the one you would send.
- FIRST LINE. Under 20 words, and it must work as the preview text as
  well. Never open with a greeting, never open with what the email is
  about.
- THE BODY, 250 to 450 words. One idea, developed. Use the specifics
  from the notes — the real number, the real question somebody asked,
  the real thing that went wrong. Short paragraphs. No headings.
- THE TURN. One short paragraph near the end that says what this means
  for the reader specifically, not in general.
- THE CLOSE. One line. If there is something to click, this is where it
  goes, and it is an invitation rather than an instruction.

Rules:

- Write to one person. Never "you all", never "folks", never "hey
  everyone".
- No summary of what you are about to say, and no summary of what you
  just said.
- Do not invent examples, numbers, customers or results. If the notes do
  not contain a specific, write the sentence generally rather than
  inventing a detail.
- If the notes are empty or contain nothing with an idea in it, do not
  invent a newsletter. Send me three questions instead, drawn from the
  standing material, that would each make a good one — and say plainly
  that the notes were empty.

Email the draft to the connected account, subject "Newsletter draft —
[date]". Put the three subject line options at the very top.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Notes document: Newsletter notes
What the newsletter is about: [e.g. running a small workshop without
  drowning in admin]
Who reads it: [e.g. owners of 5-to-20-person workshops who signed up for
  the guide]
What I want them to feel at the end: [e.g. like somebody told them
  something true, not like they were sold to]
Words and phrases I would never use: [e.g. leverage, synergy, "excited to
  share", "in today’s fast-paced world"]
Two real subject lines of mine that did well: [paste two of your own —
  this does more for the output than any instruction about tone]
```

## Feeding the notes document

Thirty seconds a day is enough. Things worth pasting in:

- a question a customer asked that made you think
- a number you looked up
- a thing that went wrong and what you did
- a strong opinion you had in the shower
- a link and one sentence about why it annoyed you

You are not writing. You are leaving yourself breadcrumbs. The routine does the joining up.

## Before your first run

**Put your two best real subject lines in the bottom section.** This does more for the output than any instruction about tone. It learns the shape of what already worked for your list.

**Wednesday 08:00 means you edit while it is fresh.** Pick whichever morning is genuinely yours. The one rule is that it should arrive before the day starts eating you, not during.

**It writes a draft, and drafts are meant to be cut.** The most common improvement is deleting the first paragraph, because the real opening is usually the second one. That is true of human drafts too.

**It will tell you when your notes were empty rather than making something up.** Take that as the reminder it is.

## What a good run looks like

> **Subject options**
> 1. The refund that taught me something ← would send
> 2. What I got wrong about returns
> 3. A £40 lesson
>
> **First line:** *Somebody asked for a refund last week and then explained why, which almost never happens.*
>
> *Most refund requests arrive with no reason attached. You get a line of text and a number, and you are left guessing. So when somebody actually explains, it is worth paying attention.*
>
> *She said the product was fine. The problem was that she had bought it expecting to use it that same afternoon, and setup took her until the following day...*
>
> **The turn:** *If you sell anything with a setup step, the promise on your page is not what you deliver — the promise plus the setup time is. Most of us only ever advertise the first half.*
>
> **Close:** *If you have a setup step, time it this week. Properly, with a stopwatch.*

## Prefer it as a Google Doc instead of an email?

Some people would rather edit in a document than in an inbox.

In the instructions, replace the "Email the draft" sentence with:

> Append the draft to the top of the Google Doc named "Newsletter drafts",
> with today's date as a heading.

Then you can drop the Gmail connector entirely and keep Drive.

## When it goes wrong

**It writes about three things.** The "pick ONE idea" instruction is losing to a week of scattered notes. Harden it: "If the notes contain several unrelated ideas, choose one and list the others at the bottom under 'not this week'."

**It sounds like a marketing email.** Almost always the "what I want them to feel" line. If you wrote "excited", you will get an excited marketing email. Try "like someone told them something true".

**The subject lines are clickbait.** Add: "The subject line must be accurate enough that somebody who opens it does not feel tricked."

**It invents a customer.** The instruction against this is explicit, so if it still happens, harden it the same way as elsewhere: "If you need a specific that is not in the notes, write [DETAIL NEEDED] instead of inventing one."
