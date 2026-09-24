# Review Request Timing

Asks the right customers for a review, on the one day they would say yes.

| | |
|---|---|
| **Runs** | Weekly, Thursdays 11:00 |
| **Cron** | `0 11 * * 4` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a week |

---

## Timing is the whole thing

Most review requests go out on a schedule — thirty days after purchase, to everybody, identically. That is why most of them are ignored.

A review happens when somebody feels good about you at the moment you ask. That moment is not on day thirty. It is the day after you fixed something for them, the week they got a result, the message where they said something nice without being prompted.

Those moments are already in your inbox. This routine finds them once a week and tells you who to ask, why now, and what to say — and, just as importantly, who not to ask.

## Set it up

1. **New routine**, name it `Review Request Timing`
2. Paste the instructions and **put your review link and rules at the bottom**
3. **Schedule** → **Weekly** → Thursday, 11:00
4. **Connectors**: Stripe and Gmail
5. **Create**

## Instructions

```
Find the customers worth asking for a review this week.

Look at the last 14 days of email, and at Stripe for customer history.

Find every good moment. A good moment is any of:

- somebody said something positive, unprompted, in any context
- a problem they reported was resolved and they acknowledged it
- they mentioned a result, an outcome, or something getting easier
- they referred somebody, or asked about referring somebody
- they upgraded, added seats, or renewed early
- they have been a customer for a round length of time — a year, two
  years — and everything has been quiet

Rank these by strength. Unprompted praise and a resolved problem are the
two strongest; a quiet anniversary is the weakest.

Then exclude, and say how many were excluded for each reason:

- anybody who has had an unresolved problem in the last 60 days
- anybody who has been asked for a review in the last 6 months. Use the
  list at the bottom
- anybody who has complained, disputed a charge, or asked about
  cancelling, ever
- anybody in their first 30 days. They do not know yet, and a review
  from somebody who does not know yet is a thin review
- anybody on the do-not-ask list

Report the top five only. For each: who, what they pay, how long they
have been a customer, the moment, with the date and the quote, and how
strong it is.

For each, draft the request. Under 70 words, and:

- name the specific thing. "You mentioned the reporting saved you a
  Sunday" beats "we hope you are enjoying it" by an enormous margin
- ask once, clearly, for one thing. Not "a review or a testimonial or a
  case study or an intro"
- give them a way to say no that costs them nothing
- do not offer anything in exchange. An incentivised review is worth
  less and, on most platforms, breaks the rules
- do not send it from a no-reply tone. This is a personal ask

Then, separately, say how many good moments there were in total. That
number is a health metric in its own right, and it is worth watching
month to month.

Never send anything. Draft only.

If there are no good moments this week, say so. Do not lower the bar.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Where we want reviews (the link): [e.g. https://g.page/r/... or your Trustpilot link]
Already asked in the last 6 months — add names here as you go: [add a name and a date each time you ask, or people get asked twice]
Never ask these customers: [e.g. anyone who has ever disputed a charge, anyone on a free arrangement]
```

## Before your first run

**Fill in the "already asked" list, and keep it up to date.** Being asked twice is the fastest way to turn a happy customer into an irritated one. This is the one piece of bookkeeping the routine needs from you, and it takes ten seconds a week.

**It excludes anyone with an open problem, on purpose.** Asking somebody for a public review while they are waiting on you for something is how you get the review you deserve.

**Five a week is plenty.** That is 250 requests a year at the right moment, which will produce far more reviews than a thousand sent on a schedule.

**Never offer an incentive.** It is in the instructions because the pressure to add "and we'll give you a month free" is real, and because most review platforms will remove reviews they can tell were paid for.

## What a good run looks like

> **11 good moments this fortnight. 5 worth asking, 4 excluded.**
>
> **1. Marta K.** — £49/mo, 7 months. **Strong: unprompted praise.**
> Tuesday, in a reply about a billing address: *"we went from doing this on a sunday night to not doing it at all"*
> > Subject: The Sunday thing
> > Marta — you mentioned getting your Sundays back, which is the nicest thing anybody has said about this all year. Would you be up for saying a version of that as a review? Here is the link: [link]. Two sentences is plenty, and a no is genuinely fine.
>
> **2. Tom Reilly** — £149/mo, 14 months. **Strong: problem resolved and acknowledged.**
> Friday: *"perfect, that's sorted it, thanks for turning that round so fast"*
>
> **3. Harlow & Sons** — £149/mo, 12 months exactly this week. **Weak: quiet anniversary.**
>
> **Excluded** — 2 asked within 6 months, 1 has an open support thread from 2 Sept, 1 is on day 11.

## When it goes wrong

**It suggests somebody you already asked.** The list at the bottom is empty or stale. This is the routine's only real maintenance cost.

**It finds no good moments for weeks.** Two possibilities, and they are very different: your customers are quietly content and never write, or something is wrong. Check the support volume before assuming the first one.

**The requests feel pushy.** Usually because they ask for several things. Enforce the one-ask rule: "Ask for exactly one thing. Do not mention any other way they could help."

**It suggests customers with open problems.** Sixty days may be too short for your business, or the thread genuinely looks resolved. Widen the window before doubting the logic.
