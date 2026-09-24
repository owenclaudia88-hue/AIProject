# Support Inbox Triage

Sorts the support inbox before you open it, and drafts the answers to the easy half.

| | |
|---|---|
| **Runs** | Three times a day — 08:00, 12:00, 16:00 |
| **Cron** | `0 8,12,16 * * *` |
| **Connectors** | Gmail. Slack optional |
| **Takes** | Three runs a day |

---

## The cost is the sorting, not the answering

Answering a support email takes two minutes. Deciding which of the nineteen to answer first takes longer than that, and it happens every time you open the inbox.

Worse, the sorting is where the mistakes live. The angry customer gets answered before the quiet one who has been waiting four days, the refund request gets missed behind six password resets, and something that was going to be a two-line fix becomes a public complaint.

This routine does the sorting three times a day and drafts replies to the things that have obvious answers. You still write the hard ones. The hard ones are the reason you are good at this.

## Set it up

1. **New routine**, name it `Support Inbox Triage`
2. Paste the instructions and **fill in the bottom section, especially the known answers**
3. **Schedule** → **Daily**, then `/schedule update` in the CLI to set `0 8,12,16 * * *`
4. **Connectors**: Gmail
5. **Create**

## Instructions

```
Triage the support inbox and draft what can be drafted.

Read unanswered emails in the inbox or label named below from the last
7 days. Ignore automated mail, receipts and notifications.

Sort every message into exactly one of these, and put them in this order:

1. ANGRY OR PUBLIC RISK. Anybody who is clearly upset, anybody
   threatening a chargeback, a review, or a complaint to a third party,
   and anybody who has now written more than once without an answer.
   These go first regardless of how long they have waited.
2. MONEY. Refunds, billing errors, double charges, cancellation
   requests, anything about a payment.
3. BLOCKED. They cannot use the thing they paid for. Cannot log in,
   cannot access, something is broken.
4. QUESTION. They want to know something.
5. FEEDBACK OR THANKS. No answer strictly required.

Within each group, oldest first, and show how long each has waited.

For each message give: who, how long they have waited, one sentence on
what they need, and whether they are a paying customer if that is
visible in the thread.

Then draft replies, but only for these:

- anything matching the known answers at the bottom
- anything where the whole answer is a link to existing documentation
- straightforward acknowledgements where the real answer needs me, but
  the person should not keep waiting in silence

Do not draft for anything in the ANGRY group. Those need a person to
read the whole thread and decide, and a competent-sounding automated
reply to somebody who is upset makes it worse.

Do not draft for anything about money unless it exactly matches a known
answer. Getting a refund reply slightly wrong is expensive.

For everything you do not draft, say in a few words why it needs me.
That line is useful: it tells me what my actual job in this inbox is.

At the end, give the counts per group, the longest wait in the inbox, and
anything that appeared three or more times today. Repetition here means
something is broken, unclear, or missing from your documentation, and it
is the most valuable thing in the report.

Never send anything. Draft only.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Inbox or Gmail label to read: [e.g. Support — or leave as Inbox]
Our tone with customers: [e.g. plain, direct, no corporate softening.
  Apologise once and then fix it]
Known answers — the question, then exactly how we answer it. Paste your
real wording, not a tidied version. Add a pair every time the report
tells you something was asked three times:
  Q: Does this work on a phone?
  A: Yes — everything works in a phone browser, there is no app to
     install. Most people do the first setup on a laptop because of the
     copying and pasting, then use it on their phone afterwards.
  Q: [your next most-asked question]
  A: [your actual answer, word for word]
Links we send often: [e.g. the help centre, the pricing page, the
  cancellation form]
```

## Filling in the known answers

This section is what makes the routine worth running, and it should grow every month.

Start by looking through your sent mail for the five answers you have written most often. Paste the question and your real answer — the actual wording you use, not a tidied version. Five is enough to start; fifteen is where it starts saving you serious time.

Every time the report tells you something appeared three times today, that is a candidate for this list.

## Before your first run

**It never sends.** Support is where an automated mistake reaches a real person who already paid you.

**The ANGRY group is deliberately not drafted for.** This is the most important design decision in the routine. A polished reply to an upset customer, written without reading the history, is how a complaint becomes a review.

**Three times a day is the right shape.** Claude allows 5 runs a day on Pro and 15 on Max. Three keeps nobody waiting more than half a day and leaves allowance for your other routines. On Pro, twice — `0 9,15 * * *` — is fine.

**Watch the repetition line more than the counts.** Three people asking the same thing in one day is a product problem wearing a support costume.

## What a good run looks like

> **19 waiting. Longest: 4 days.**
>
> **Angry / public risk — 1. Needs you.**
> **Sarah L., 4 days, third message.** Asked about a double charge on Monday, again Wednesday, no reply either time. Last message mentions her bank. *Not drafted — read the thread first.*
>
> **Money — 3**
> Tom R., 1 day — refund request within the window. *Drafted, matches known answer.*
> Marta K., 2 days — charged twice in September. *Not drafted: needs the Stripe record checked.*
> Dan W., 6 hours — wants to cancel and asks if he gets a partial month. *Not drafted: your known answers do not cover partial months. Worth adding.*
>
> **Blocked — 4**
> All four are password resets. *All drafted.*
>
> **Questions — 9.** 6 drafted from known answers, 3 need you:
> — whether it works on a phone
> — whether it works on a phone
> — whether it works on a phone
>
> **Feedback — 2.** Both positive, no reply needed.
>
> **Seen three or more times today:** "does this work on a phone", asked by three separate people. Nothing on your site answers it.

## Prefer Slack instead of email?

Sensible here, especially if more than one person covers support.

In the instructions, replace the sending instruction with:

> Post the summary as one message to the #support channel in Slack, then
> post each draft as a reply in that thread.

Add the **Slack** connector and keep Gmail as the source.

## When it goes wrong

**Everything is marked ANGRY.** It is reading terse as hostile. Add: "Short and direct is not angry. Only use this category for explicit frustration, a stated threat, or a third unanswered message."

**It drafts replies that are wrong.** Your known answers are paraphrased rather than exact. Paste the real ones.

**It misses messages.** Check what the label actually catches. If support arrives at several addresses, they all need to feed one label.

**The drafts do not sound like you.** Paste three real replies of yours under the tone line with "match these". It works far better than adjectives.

**It says "needs you" for everything.** Your known-answer list is empty or too short. That list is the routine.
