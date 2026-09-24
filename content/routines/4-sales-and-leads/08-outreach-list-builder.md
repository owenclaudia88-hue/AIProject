# Outreach List Builder

Ten businesses a week that actually fit, with a reason to write to each one.

| | |
|---|---|
| **Runs** | Mondays, 13:00 |
| **Cron** | `0 13 * * 1` |
| **Connectors** | Gmail. Google Drive optional |
| **Takes** | One run a week |

---

## Lists are easy. Reasons are not.

Anybody can buy a list of ten thousand companies. That is why cold outreach mostly does not work: the list is the cheap part, and a message that could have gone to any of the ten thousand reads exactly like it.

What is expensive is the reason — the specific, checkable thing about *this* business that explains why you are writing to them today rather than to anybody else. Finding that takes ten minutes a company, which is why almost nobody does it, which is why doing it works.

This routine does the ten minutes. It brings back a small list, deliberately, with a real reason attached to each one.

## A word about doing this properly

Cold outreach is legitimate and it is also regulated. Broadly, and this is not legal advice:

- Write to businesses about their business, not to private individuals.
- Use publicly listed business contact details, not scraped personal addresses.
- Say who you are and why you are writing, in the message itself.
- Honour an opt-out immediately and permanently.
- Keep the volume low enough that each message is genuinely individual.

The rules differ by country — GDPR in the UK and EU, CAN-SPAM in the US, and others elsewhere — and the responsibility for following them is yours. This routine is built for ten considered messages a week, which is both more effective and much easier to keep on the right side of the line than a thousand automated ones.

## Set it up

1. **New routine**, name it `Outreach List Builder`
2. Paste the instructions and **describe your customer at the bottom** — this is the entire routine
3. **Schedule** → **Weekly** → Monday, 13:00
4. **Connectors**: Gmail, so it can check you are not writing to somebody you already know
5. **Environment**: **Full** or **Custom**, or it cannot research anything
6. **Create**

## Instructions

```
Find ten businesses worth contacting this week, with a real reason for
each.

Use the description at the bottom to find candidates from public sources:
directories, industry listings, local press, public membership lists,
company websites.

For each candidate, check three things before including it:

- Does it actually match the description? Not roughly. Specifically.
- Is there a publicly listed business contact address? If there is only
  a personal-looking address, or you had to guess at the format, exclude
  it and say why.
- Have we already been in touch? Search our email for the domain. If we
  have any history at all, exclude it and note it separately — writing a
  cold email to an existing conversation is the worst outcome here.

Then find the reason. For each business, one specific, checkable fact
that explains why now: they have opened somewhere, they are hiring for
something relevant, they have launched a product, they said something
publicly that connects to what we do, they have visibly changed
something. Give the source URL.

If you cannot find a real reason, exclude the business. Ten with reasons
beats thirty without, and a fabricated reason is worse than no email.

For each of the ten that survive, give:
- the business, what it does, roughly how big
- the public contact address you found, and where it is listed
- the reason, in one sentence, with its URL
- why they fit the description, in one sentence
- a first line for the message — under 25 words, referring to the reason,
  no compliments

Then say how many candidates you looked at and how many were excluded
for each of the four reasons. If the exclusion rate is very high, the
description at the bottom is probably too broad, and that is worth
knowing.

Email the list to the connected account, subject "Outreach list — week
of [date]".

Never contact anybody. This produces a list and nothing else.

Do not guess at email addresses. Do not infer a pattern from one known
address. An address you did not read on a page is not an address.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

What we sell: [e.g. stock control software for small workshops, £49/mo]
The business that is a perfect fit — industry, size, location, and what
must be true about them: [e.g. joinery or cabinetmaking, 8 to 25 staff, UK, has a website and at least one manager]
What makes somebody a bad fit: [e.g. fewer than 3 staff, or they want us to do the work for them]
What usually triggers a business like this to need us: [e.g. they hire a fourth person, they move premises, they lose the person who ran the spreadsheet]
Never contact these companies or domains: [e.g. existing customers, anyone who has asked us not to, competitors]
```

## Before your first run

**"What usually triggers a business like this to need us" is the important line.** It is what turns a directory search into a reason. If you cannot answer it, look at your last five customers and ask what had just changed for each of them.

**Ten is the number on purpose.** Ten researched messages a week is 500 a year, every one of them individual. That is a real channel. A thousand identical ones is a spam complaint.

**It never sends.** Obviously. Cold outreach that goes out unread by a human is how domains get blocked.

**Set the environment to Full or Custom**, or it will find nothing and look broken.

## What a good run looks like

> **10 businesses. Looked at 63 — excluded 34 as a poor match, 12 with no public address, 5 already in your inbox, 2 with no reason found.**
>
> **1. Harlow & Sons — joinery, Sheffield, ~12 staff**
> *Address:* enquiries@harlowandsons.co.uk, on their contact page.
> *Reason:* advertising for a second workshop manager, posted 4 days ago. [URL]
> *Fit:* hitting the size where one person can no longer hold the schedule in their head, which is exactly the description.
> *First line:* "You are hiring a second workshop manager — which usually means the scheduling has stopped fitting in one person's head."
>
> **2. Brightwell Studios — design, Bristol, ~6 staff**
> *Address:* hello@brightwell.studio, footer of their site.
> *Reason:* announced a move to a larger studio on 14 Sept. [URL]
> *First line:* "Congratulations on the new studio. The move usually breaks whatever was holding your project tracking together."
>
> **Note:** excluded Reilly & Co — you already have an open thread with them from August.

## Keeping a record

If you connect Google Drive and keep a sheet called `Outreach`, add one line to the instructions: *"Read the Outreach sheet first and exclude anything already on it. Append the new ten to it."*

Without this, the routine will happily suggest the same company in six weeks. With it, you get a permanent record of who you have approached and when — which also matters for opt-outs.

## When it goes wrong

**It suggests businesses that are nothing like your customer.** The description is too abstract. Name industries, sizes and places. "Companies that value efficiency" describes every company that has ever existed.

**It guesses email addresses.** The instruction forbids it, so harden it: "Quote the exact line of the page where you found the address."

**It cannot find reasons.** Either the businesses are too small to leave a public trail, or the trigger line is empty. Both are fixable in the bottom section.

**The exclusion rate is 90%.** That is the routine working — but it also means you are looking in the wrong place. Change where it is searching, not how strict it is being.

**It suggests somebody you already spoke to.** The Gmail check missed it because they wrote from a different domain. The Drive sheet is the durable fix.
