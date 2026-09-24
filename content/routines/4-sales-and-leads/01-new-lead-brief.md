# New Lead Brief

Everything worth knowing about the person who just enquired, before you reply.

| | |
|---|---|
| **Runs** | Three times a day — 08:00, 13:00, 17:00 |
| **Cron** | `0 8,13,17 * * *` |
| **Connectors** | Gmail. Slack optional |
| **Takes** | Three runs a day |

---

## The gap between a name and a person

Somebody fills in your form. You get an email with a name, an address and two lines of text. You reply with something generic, because generic is all you can write from two lines.

The version of that reply you would send if you had spent ten minutes looking them up is a completely different email — and it is the one that gets answered. But ten minutes times every enquiry is not a thing anybody actually does, which is why almost nobody does it.

This routine does the looking up. Three times a day it takes whatever came in, finds out who these people are, and hands you a short brief with an opening line you could not have written from the form alone.

## Set it up

1. In Gmail, make a label called `Leads` and filter your enquiry notifications into it
2. **New routine**, name it `New Lead Brief`
3. Paste the instructions into the big **Instructions** box
4. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it.
5. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 8,13,17 * * *`
6. **Connectors**: Gmail
7. **Environment**: set to **Full** or **Custom** with the sites you want it to check, otherwise it cannot look anybody up
8. **Create**

## Instructions

```
Brief me on the new enquiries that arrived since your last run.

Read emails with the label named below from the last 6 hours. For each
genuine enquiry — ignore newsletters, receipts and automated mail — build
a brief.

Each brief has five parts and fits on a phone screen.

1. WHO. Name, email, and company if given. Then what you can establish
   from public sources in a couple of minutes: what the company does,
   roughly how big it is, what this person's role appears to be. Say
   where each fact came from. If you could not find them, say "nothing
   public found" — that is a useful fact in itself and much better than
   a guess.

2. WHAT THEY ASKED, in their own words. Quote the important sentence
   rather than summarising it. How somebody phrases a question tells you
   more than the question does.

3. WHAT THEY PROBABLY NEED. Your reading of the actual problem behind
   the enquiry, in one or two sentences. Mark this clearly as inference,
   not fact.

4. ONE THING TO MENTION. A specific detail from your research that would
   show you paid attention. Not flattery — a fact. If there is nothing,
   say so rather than inventing something; a made-up compliment is worse
   than none.

5. SUGGESTED OPENING. The first two sentences of a reply, in my voice.
   Not the whole email. Under 40 words.

Then rank the enquiries: who to reply to first, and why, using the
priority rules at the bottom.

Never reply to anybody. Draft only.

Do not state anything about a person as fact unless you actually read it
on a page. Do not guess at company size, revenue, or seniority from a
name or an email domain.

If there were no new enquiries, send nothing at all.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Gmail label to read: Leads
What we sell: [e.g. stock control software for small workshops, £49/mo]
Who is a good fit for us: [e.g. 5 to 30 staff, already outgrown a
  spreadsheet, based in the UK]
Who is not, and should be deprioritised: [e.g. sole traders, students,
  anyone asking about a free plan]
Priority rules — what makes one enquiry more urgent than another: [e.g.
  anyone naming a deadline, anyone with more than 10 staff, anyone who has
  already had a demo]
```

## Getting enquiries into the label

Whatever your form sends — your website, Typeform, Calendly, a Shopify contact form — it arrives from a consistent address. Filter on that address in Gmail and apply the `Leads` label.

If enquiries reach you through several routes, add them all to one filter with `OR`. One label is much easier to reason about than three.

## Before your first run

**Set the environment to Full or Custom.** The default blocks outbound traffic, and without it the WHO section will be empty every time, which makes the whole routine pointless.

**Three times a day is the right shape, not an arbitrary limit.** Claude allows 5 runs a day on Pro and 15 on Max. Three is fast enough that nobody waits more than a few hours and leaves you room to run other things. On Pro, two — `0 9,16 * * *` — is a sensible trade.

**Fill in "who is not a good fit".** Most people only describe their ideal customer, and then everything is ranked as urgent. The deprioritise list is what makes the ranking mean anything.

**It will not reply for anybody.** A first reply to a prospect is the highest-value email you send all week. This gets you to a good draft in thirty seconds; it does not send it.

## What a good run looks like

> **2 new enquiries.**
>
> **1. Priya Shah — priya@northfieldmakes.co.uk — reply first**
> *Who:* Northfield Makes, a furniture workshop in Leeds. Site lists four people. She is named as operations on their about page. Found: their website, a 2024 local press piece about their move to a bigger unit.
> *Asked:* "we're doing this in a spreadsheet at the moment and it's falling over now there are four of us"
> *Probably needs* (inference): not features — a way to stop being the only person who understands the spreadsheet.
> *Mention:* they moved to a larger unit last year, which is usually when the spreadsheet stops working.
> *Opening:* "Four people sharing one spreadsheet is usually the point it stops holding. Before I suggest anything — is it the version conflicts, or that everything routes through you?"
>
> **2. m.kowal@gmail.com — no name given**
> *Who:* nothing public found.
> *Asked:* "price?"
> *Probably needs* (inference): early looking, comparing options.
> *Mention:* nothing to mention — no research available.
> *Opening:* "It's £49 a month, and there's a full list of what's included here. What are you trying to fix?"

## Prefer Slack instead of email?

Useful if leads are handled by more than one person.

In the instructions, replace the sending instruction with:

> Post each brief as a separate message to the #leads channel in Slack.

Separate messages, not one — each lead becomes its own thread. Add the
**Slack** connector; keep Gmail as the source.

## When it goes wrong

**The WHO section is always empty.** Network access, every time. Check the environment before anything else.

**It states things about people that are not true.** The instruction against guessing is explicit, so if this persists, harden it: "For every fact, give the URL you read it on. If you have no URL, do not state the fact."

**Everything is ranked urgent.** The deprioritise list is empty. Fill it in.

**It briefs the same lead twice.** Runs overlap slightly by design. If it bothers you, narrow the window from 6 hours to 5, or add: "Ignore anything you have already briefed today."

**Nothing arrives.** Correct behaviour when there were no enquiries. Check the label in Gmail before assuming a fault.
