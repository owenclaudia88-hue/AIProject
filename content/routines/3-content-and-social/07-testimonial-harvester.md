# Testimonial Harvester

Finds the nice things people already said about you, which you have forgotten and never used.

| | |
|---|---|
| **Runs** | Fridays, 15:00 |
| **Cron** | `0 15 * * 5` |
| **Connectors** | Gmail. Slack or Stripe optional |
| **Takes** | One run a week |

---

## You are sitting on more proof than you think

People tell you your product is good all the time. In replies to emails, in support threads, in a passing line at the end of a message about something else entirely. You read it, you feel good for four seconds, and it is gone forever.

Meanwhile your sales page has three testimonials on it from 2023.

This routine goes through the week's messages and pulls out every genuinely positive thing somebody said, with enough context to use it. It does not write testimonials — the whole value is that these are real sentences written by real customers, in words you would never have chosen.

## Set it up

1. **New routine**, name it `Testimonial Harvester`
2. Paste the instructions and **set your rules at the bottom**
3. **Schedule** → **Weekly** → Friday, 15:00
4. **Connectors**: Gmail. Add Slack if customers reach you there, and Stripe if you want each quote matched to what they actually bought
5. **Create**

## Instructions

```
Find everything positive a customer said this week that could be used as
proof, and collect it.

Read the emails received in the last 7 days, excluding the folders and
senders listed at the bottom. If Slack is connected, read the channels
listed too.

Pull out every instance of somebody saying something genuinely good
about the product, the service, the support or the result they got.
Include the passing ones — a good line at the end of a message about a
billing question counts, and those are the ones nobody ever remembers.

For each, give:
- the exact quote, unedited, including any typos. Do not tidy it up.
- who said it: name, and their company if it is in the signature
- the date
- what they were actually talking about when they said it
- if Stripe is connected, what they bought and when

Then sort them into three groups:

STRONGEST — quotes that name a specific result, a number, a timeframe or
a before and after. These are worth chasing for permission and a photo.
These are rare; some weeks there will be none.

USEFUL — clear, specific praise without a number. Most good quotes are
here.

WARM BUT VAGUE — "love it", "this is great", "thank you so much". Count
these and list the senders, but do not quote them. They are not proof,
they are affection. They are still worth knowing about, because these
are the people to ask for a proper review.

Then, for the strongest two only, draft a short message asking permission
to use the quote publicly. Under 60 words, no flattery, and it should ask
for one specific thing rather than offering options.

Never send anything. Draft only.

If nothing was found this week, send one line saying so. Do not lower the
bar to fill the report.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Ignore emails from these addresses or domains: [e.g. @yourcompany.com, your suppliers, your accountant]
Ignore emails in these folders or with these labels: [e.g. label:Receipts, label:Newsletters, Spam]
Slack channels to read, if connected: [e.g. #support, #customers — leave blank if you do not use Slack]
```

## Where to put what it finds

Have one document. A Google Doc called `Proof` is enough. Every Friday, paste the STRONGEST and USEFUL quotes into it with the date.

Within a couple of months you will have a file you can open whenever you need to write a sales page, an ad, a reply to an objection, or an about page. Writing those from a file of real customer sentences is a different job from writing them from scratch, and a much easier one.

If you connect Google Drive, you can have the routine append to that document directly instead of emailing you — see the swap below.

## Before your first run

**Fill in the ignore list before the first run, not after.** Without it, the first report will be full of your own team, your suppliers, and every "thanks, received!" in your inbox. Two minutes now saves a useless first impression.

**It never sends the permission request.** Deliberately. Asking a customer to be on your website is a real conversation, and it should come from you having read what they actually said.

**Most weeks will be quiet, and that is correct.** A week with one usable quote is a normal week. A routine that found eight every week would be inventing them.

## What a good run looks like

> **Strongest — 1**
>
> *"we went from doing this on a sunday night to not doing it at all. i got my weekends back which sounds dramatic but its true"*
> — Marta K., Tuesday, in a reply about changing her billing address. Bought the annual plan in March.
>
> **Draft permission request:**
> *Marta — you mentioned getting your weekends back. Would you mind if I used that line on the site, with your first name and company? Happy to send you the exact wording first.*
>
> **Useful — 3**
>
> *"the setup was the part I was dreading and it took about ten minutes"* — Tom R., Wednesday, support thread.
>
> *"honestly the reporting alone is worth it, I had been paying for something separate to do that"* — Priya S., Thursday.
>
> *"I have recommended this to two people this month"* — Dan W., Monday.
>
> **Warm but vague — 11.** Worth asking for a review: Dan W., Priya S., and Alex M. (three separate positive messages this month).

## Send it to a document instead of an inbox?

Better for this one, because quotes accumulate.

In the instructions, replace the final sending instruction with:

> Append the findings to the top of the Google Doc named "Proof", under a
> heading with today's date.

Add the **Google Drive** connector. Keep Gmail — it is still the source
being read.

## When it goes wrong

**It quotes your own team.** Your own domain is not in the ignore list. Put it there.

**Everything lands in WARM BUT VAGUE.** That is often just true. If you think it is being harsh, the fix is not to lower the bar — it is to start asking better questions in your support replies. "Glad it worked — what were you doing before?" produces quotable answers.

**It tidies up the quotes.** The instruction says not to, because the typos are what make a testimonial read as real. If it keeps correcting them, add: "Reproduce the quote character for character, including capitalisation and mistakes."

**It misses Slack.** Check that the channels are named exactly, including the `#`, and that the connector has access to private channels if that is where customers are.
