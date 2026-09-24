# Trial Ending Watch

Everyone on a trial that converts to a paid plan this week, and whether they have actually used the thing yet.

| | |
|---|---|
| **Runs** | Daily, 09:00 |
| **Cron** | `0 9 * * *` |
| **Connectors** | Stripe, Gmail |
| **Takes** | One run a day |

---

## Why this one earns its place

A customer who is charged at the end of a trial they never used is the most expensive kind of customer you can have. They refund, they dispute, and they tell people.

This routine finds them before the charge, not after.

## Set it up

1. **New routine**, name it `Trial Ending Watch`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** fill in the settings.
4. **Schedule** → **Daily** → 09:00
5. **Connectors**: Stripe and Gmail
6. **Create**

## Instructions

```
Find trials converting to paid in the next 48 hours.

From Stripe, list every subscription with status "trialing" whose trial
ends within the look-ahead window set at the bottom. For each one report:
- customer name and email
- the amount they will be charged
- the exact date and time of the charge
- how long ago they signed up

Email the list to the connected account with the subject "Trials
converting: [count]".

For each person on the list, draft a short email to them — do not send it,
put the drafts in the same summary email for review. Each draft should:
- say their trial ends on [date] and what they will be charged
- say how to cancel, in one sentence, without making cancelling sound like
  the expected choice
- offer the one specific thing named at the bottom for them to try before
  then, adapted to what they have or have not done so far

If no trials end within the look-ahead window, send nothing.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Look ahead: 48 hours
The one thing worth trying before a trial ends: [e.g. connect a second
  account — the people who do it almost never cancel]
How to cancel, in our own words: [e.g. one click in Settings, no email
  needed]
Never include these customers: [e.g. anyone on a trial you arranged
  personally]
```

## Before your first run

**Note that it drafts rather than sends.** That is deliberate for this one. A trial-ending email is the last thing a customer reads before money leaves their account, and it is worth twenty seconds of your attention.

Once you trust the drafts, change "do not send it, put the drafts in the same summary email" to "send it to the customer" and it becomes fully automatic.

**"The one thing worth trying before a trial ends"** is the field that decides whether these drafts are any good. Look at what your customers who stayed did in their first week that the ones who left did not, and put that. Left vague, the suggestion will be vague.

## What a good run looks like

> Trials converting: 2
>
> **Dana Ruiz** — dana@example.com — $39 on 26 September at 14:12 — signed up 19 September
> **Tomas Lind** — tomas@example.com — $39 on 27 September at 09:03 — signed up 20 September
>
> Draft for Dana:
> Your trial ends on Thursday and your card will be charged $39...

## Prefer Slack instead of email?

This one emails you by default. If your team lives in Slack, send it there
instead.

In the instructions, replace the "Email to the connected account" sentence
with:

> Post the result as a single message to the #general channel in Slack.

Change `#general` to the channel you actually read, then swap the **Gmail**
connector for **Slack** on the routine. Nothing else changes.

## When it goes wrong

**It finds nothing and you know you have trials.** Check that your subscriptions actually use Stripe's trial period rather than a free plan you switch manually. Only the former has status "trialing".

**The drafts all say the same thing.** They will, unless the settings at the bottom say what your product does and what a good first week looks like. This is the routine that most rewards a few sentences of context.

## The honest version of this

If you would rather not email people before charging them, do not install this routine and tell yourself you will check manually. You will not. Either install it, or change the trial so it does not auto-charge.
