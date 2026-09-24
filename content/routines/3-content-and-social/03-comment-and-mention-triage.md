# Comment & Mention Triage

Separates the three comments worth answering from the ninety that are not.

| | |
|---|---|
| **Runs** | Twice a day — 09:00 and 17:00 |
| **Cron** | `0 9,17 * * *` |
| **Connectors** | Gmail. Slack if you want the alerts there |
| **Takes** | Two runs a day |

---

## Why this reads your email, not your social accounts

Every platform emails you when somebody comments, replies, mentions you or sends a message. Those notification emails are the one place where everything from every platform lands together — and unlike the platforms themselves, your inbox has a connector that works today.

So this routine reads the notifications rather than the apps. It is less elegant and considerably more reliable, and it has the useful side effect of covering platforms nothing else covers.

Check `claude.ai/customize/connectors` before you set this up. If a direct connector for your platform now exists, use it and change the first line of the instructions to read from it instead. Everything else in the routine is unchanged.

## Set it up

1. In Gmail, make a label called `Social` and set up filters so notification emails from your platforms get that label. Ten minutes, once
2. **New routine**, name it `Comment & Mention Triage`
3. Paste the instructions and **set the label name and your rules at the bottom**
4. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 9,17 * * *`
5. **Connectors**: Gmail
6. **Create**

## Instructions

```
Read the social notifications that arrived since your last run and tell
me only what needs me.

Look at emails with the label named below, received in the last 12 hours.
Extract every individual comment, reply, mention or message in them: who
said it, on which platform, on which piece of content, and what they
actually said.

Sort every one into exactly one of these:

NEEDS A REPLY FROM ME
  - a real question about the product, the price or how something works
  - somebody saying they are about to buy, or asking how to
  - a complaint, a problem, or anything that reads as frustrated
  - a journalist, a podcast, a partner, or anyone proposing something
  - a comment with genuine disagreement that other people can see

WORTH A LIKE, NOT A REPLY
  - praise, thanks, agreement, encouragement

IGNORE
  - spam, bots, single emoji, tagging friends, promotional replies
  - anything selling me something

For everything in NEEDS A REPLY, write a suggested reply in my voice.
Keep it under 40 words. Do not be effusive. If the comment is a
complaint, the reply acknowledges the specific thing first and does not
apologise twice.

Then give me the counts for the other two groups and nothing more about
them.

At the end, note anything you saw more than twice — the same question,
the same confusion, the same objection. Repetition is the most useful
thing in this whole report: it is either a gap in the content or a gap
in the product.

If nothing needs a reply, send one line saying so with the counts. Do not
send an empty report.

Never send, post or publish anything. Suggest replies only — I will send
them myself.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Gmail label to read: Social
Things that always need me, whatever they look like: [e.g. anything from a
  journalist, anything mentioning a refund]
Things I never want flagged: [e.g. emoji-only replies, the same three
  people who comment on everything]
```

## Setting up the Gmail label

In Gmail, click the filter icon in the search bar, put your platforms' notification addresses in **From** (separated by `OR`), then **Create filter** → **Apply the label** → `Social`. Tick **Also apply to matching conversations** so it catches what is already there.

Common senders worth including: `notification@facebookmail.com`, `noreply@youtube.com`, `no-reply@linkedin.com`, `info@e.instagram.com`, `notify@twitter.com`. Yours will vary — the fastest way to find them is to open one existing notification and copy the address.

## Before your first run

**Twice a day is the right frequency, and it is not arbitrary.** Claude allows 5 runs a day on Pro and 15 on Max. Two leaves room for everything else you will want to run, and comments do not go stale in eight hours. If you are on Max and reply for a living, `0 9,13,17 * * *` is fine.

**It will not post anything.** By design. An automated reply that misreads a complaint is a public mistake, and public mistakes are the expensive kind.

**The first run will over-flag.** It does not know yet that the same three people always comment, or that one particular phrase is a running joke. Put those in the bottom section after the first couple of runs and it settles down within a week.

## What a good run looks like

> **Needs you — 3**
>
> **1. YouTube, "Setup walkthrough"** — *"does this work if my stock is in two warehouses?"*
> Suggested: *Yes — it handles multiple locations, you just set them up once at the start. The walkthrough covers one location to keep it short. Happy to send the two-location version.*
>
> **2. Instagram, Tuesday's post** — *"bought it last week and still haven't had the email"*
> Suggested: *That should have arrived within a few minutes — something has gone wrong. Send me the email address you used and I will sort it today.*
>
> **3. LinkedIn** — podcast invitation, host has 12k followers, asking about November.
>
> **Worth a like:** 34. **Ignored:** 61.
>
> **Seen more than twice:** four separate people asked whether it works on a phone. Nothing in your content answers that.

## Prefer Slack instead of email?

Useful for this one, because a triage report is something you glance at rather than read.

In the instructions, replace the sentence about sending with:

> Post the result as a single message to the #social channel in Slack.

Change `#social` to your channel and add the **Slack** connector. Keep
Gmail — it is still the source.

## When it goes wrong

**Everything comes back as NEEDS A REPLY.** Your label is catching too much — newsletters and platform marketing emails as well as notifications. Tighten the Gmail filter rather than the instructions.

**It misses comments.** Notification emails are often digests that hide older items behind "and 12 others". Check whether your platform is set to notify per comment or in a daily digest, and switch to per comment.

**It suggests replies that sound nothing like you.** Fill in the voice properly, or paste two real replies you have written into the bottom section with the line "match the tone of these".

**Nothing arrives and you know people commented.** Almost always the label. Search Gmail for `label:Social newer_than:1d` and see whether anything is actually there.
