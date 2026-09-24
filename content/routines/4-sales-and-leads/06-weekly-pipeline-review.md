# Weekly Pipeline Review

What is actually live, what has gone stale, and what next month probably looks like.

| | |
|---|---|
| **Runs** | Mondays, 08:00 |
| **Cron** | `0 8 * * 1` |
| **Connectors** | Gmail, Stripe. Google Drive optional |
| **Takes** | One run a week |

---

## Pipeline without a CRM

Most small businesses do not have a pipeline. They have an inbox, a feeling, and a number they would quote if pressed.

That works until you need to decide something — whether to hire, whether to spend on ads, whether you can take a week off — and then the feeling is not good enough and building the real picture takes an afternoon you do not have.

This routine reconstructs the pipeline from your email every Monday morning. It is not as accurate as a properly maintained CRM. It is considerably more accurate than a feeling, it costs you nothing to maintain, and it exists on Monday at eight whether you were organised last week or not.

## Set it up

1. **New routine**, name it `Weekly Pipeline Review`
2. Paste the instructions and **fill in your stages and values at the bottom**
3. **Schedule** → **Weekly** → Monday, 08:00
4. **Connectors**: Gmail and Stripe. Add Google Drive if you keep a deals sheet
5. **Create**

## Instructions

```
Reconstruct the current sales pipeline and tell me what it means.

Search email from the last 90 days for every live sales conversation —
anybody who has enquired, been quoted, or is mid-discussion. Exclude the
senders, domains and labels at the bottom, and exclude anyone who has
already bought, which Stripe can confirm.

Place each one in a stage, using the definitions at the bottom. If a
conversation does not fit any stage, put it in UNCLEAR rather than
forcing it — the unclear pile is often the most interesting thing in the
report.

For each, give: who, their company, what they want, the value if a
number has been discussed, the stage, the date of the last contact from
either side, and who spoke last.

Then report six things.

1. THE SHAPE. How many in each stage, and the total value of anything
   with a real number attached. Say clearly how much of the total is
   guessed rather than quoted — a pipeline number that mixes the two is
   worse than no number.

2. WHAT MOVED THIS WEEK. Anything that changed stage since your last
   run, in either direction. Backwards movement matters more than
   forwards and is almost never noticed.

3. WHAT IS STALE. Anything with no contact for longer than the stale
   threshold below, with the number of days. Longest first.

4. WHAT IS WAITING ON ME. Every conversation where they spoke last. This
   is the section to act on today.

5. NEW THIS WEEK. Anything that entered the pipeline in the last 7 days,
   and how that compares with the weekly average over the 90 days. A
   quiet week for new enquiries shows up in revenue two months later,
   which is far too late to react to it.

6. WHAT NEXT MONTH LOOKS LIKE. Based on what is at the late stages and
   how long deals have historically taken, a rough range — not a single
   number. Say what would have to happen for the top of the range, and
   what would have to fail for the bottom. Be explicit that this is an
   estimate from incomplete data.

Email the result to the connected account, subject "Pipeline — week of
[date]". Put the shape and the "waiting on me" count in the first three
lines.

Do not invent values for deals where no price has been discussed. Count
them separately as unvalued.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Stages, and what puts somebody in each:
  Enquired —
  In conversation —
  Quoted —
  Verbal yes —

Stale after: 14 days
Typical deal value, if nothing has been discussed: [e.g. £1,500 — or leave
  blank so these stay uncounted]
Ignore these senders, domains and labels: [e.g. @yourcompany.com,
  noreply@, newsletters, label:Receipts]
Our own email addresses: [e.g. you@yourcompany.com, hello@yourcompany.com]
```

## Before your first run

**Write your stage definitions in your own words.** The defaults are a starting point. If your business has a demo, a trial, or a procurement step, say so — the stages are what the whole report hangs on.

**Expect the first run to be messy.** It is reading an inbox, not a database, and it will miscategorise a few. Correct those by tightening the stage definitions rather than by giving up on it: by week three it is usually close.

**Watch the "new this week" number more than the total.** The total is flattering and slow-moving. New enquiries is the leading indicator, and it is the number that tells you about next quarter rather than last one.

**The forecast is a range for a reason.** Anything reconstructed from email is approximate. A single confident number from this data would be false precision, and you would plan against it.

## What a good run looks like

> **Pipeline: 14 live. £18,400 quoted, plus 6 unvalued. 5 are waiting on you.**
>
> **Shape** — Enquired 5, In conversation 4, Quoted 3, Verbal yes 2. Of £18,400, all of it has been quoted in writing. The 6 unvalued are all at Enquired.
>
> **Moved** — Northfield Makes went Quoted → Verbal yes on Thursday. Reilly & Co went Quoted → In conversation, which is backwards: they reopened scope on Friday.
>
> **Stale** — Alex M., 31 days, Quoted, £1,100. Sarah L., 22 days, In conversation. Two more over 14.
>
> **Waiting on you** — 5, of which Priya Shah has been waiting 3 days and has asked twice.
>
> **New this week** — 2. Your 90-day average is 4.1 a week. Second quiet week in a row.
>
> **Next month** — £4,800 to £11,200. The top of that needs both verbal yesses to convert and the Reilly scope to resettle. The bottom assumes only the two verbals land. Estimated from email, not a CRM.

## Keeping a deals sheet instead

If you would rather be explicit than have it inferred, keep a Google Sheet with name, company, stage, value and last contact. Connect Drive and change the first instruction to read the sheet instead of the inbox.

It is more accurate and it is more work. The honest advice is to start with the inbox version, and only move to a sheet if you find yourself correcting it every week.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #sales channel in Slack.

Add the **Slack** connector and keep Gmail as the source.

## When it goes wrong

**People who already bought are in the pipeline.** Stripe is not connected, or they paid under a different email. Check the connector first.

**Everything lands in UNCLEAR.** Your stage definitions are too abstract. Describe the observable thing — "they have asked for a price" — rather than the intent.

**The forecast is wildly optimistic.** It is counting unvalued deals at your typical value. Set that figure conservatively, or leave it blank so they stay uncounted.

**It misses conversations.** They may be happening somewhere other than the inbox you connected. This routine can only see what it is given.
