# Document Freshness Check

Finds the instructions your team is following that stopped being true a year ago.

| | |
|---|---|
| **Runs** | Mondays, 09:00 |
| **Cron** | `0 9 * * 1` |
| **Connectors** | Google Drive, Gmail |
| **Takes** | One run a week |

---

## Wrong documentation is worse than none

A team with no written process asks. A team with a written process that is eighteen months out of date follows it, confidently, and gets it wrong — and nobody questions it, because it is written down.

The failure is always the same: somebody changes how something works, tells the two people who needed to know, and the document that described the old way sits there being authoritative.

This routine reads your documents every Monday and looks for the signs: named people who left, tools you no longer use, prices that have changed, deadlines that have passed, steps that contradict something you decided in an email three months ago.

## Set it up

1. **New routine**, name it `Document Freshness Check`
2. Paste the instructions and **list your folders and your known changes at the bottom**
3. **Schedule** → **Weekly** → Monday, 09:00
4. **Connectors**: Google Drive and Gmail
5. **Create**

## Instructions

```
Find documentation that has stopped being true.

Read the documents in the Drive folders listed at the bottom. Check each
against the facts listed there, and against what you can see in the last
6 months of email.

For each document, check for:

1. PEOPLE. Anybody named who has left, changed role, or no longer does
   the thing the document says they do. Use the people list at the
   bottom. A process that says "send this to X" where X left in March is
   the most common failure of all, and it is silent — the email bounces
   or goes to an unread mailbox.

2. TOOLS AND SYSTEMS. Any software, platform, supplier or service named
   that is no longer in use, has been replaced, or has been renamed.

3. NUMBERS. Prices, thresholds, limits, rates, deadlines. Check them
   against the current facts at the bottom. Report anything that does
   not match, with both values.

4. DATES THAT HAVE PASSED. Anything described as upcoming, planned or
   temporary that has since happened or expired.

5. CONTRADICTIONS. Anywhere two documents say different things about the
   same process, or where a document says something that an email in the
   last 6 months explicitly changed. Quote both sides. This is the
   hardest check and the most valuable.

6. LINKS. Anything linking to a document, folder or page that no longer
   exists.

Then report, ranked by what would cause the most damage if somebody
followed it:

- HIGH: anything where following the document would send money, data or
  a customer to the wrong place, or would break something.
- MEDIUM: anything factually wrong that would waste time or cause
  confusion.
- LOW: cosmetic staleness — an old date, an old logo reference, an
  obsolete note.

For each, give: the document, the line quoted, what is wrong, and what
it should probably say. If you do not know what it should say, say so
rather than guessing — a confidently wrong correction is how a stale
document becomes an incorrect one.

Then two things:
- documents not edited in more than a year. Not necessarily wrong, but
  worth someone's eyes.
- any document that has been flagged HIGH for three weeks running.

Email the result to the connected account, subject "Document freshness —
[date]".

Do not edit any document. Report only.

If nothing needs attention, say so in one line.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Drive folders to check: [e.g. Processes, Handbook, Onboarding]

Current facts — keep this updated, it is what everything is checked
against:
  People, and what they do: [e.g. Priya Shah — runs payroll and supplier
    payments]
  People who have left, and when: [e.g. J. Hart — left 14 March 2026]
  Tools we use now, and what they replaced: [e.g. Xero, replaced the old
    spreadsheet ledger in June]
  Current prices: [e.g. standard plan £49/mo, annual £490]
  Current suppliers: [e.g. Kestrel Supplies, Ardley Metals]

Documents to ignore — archives, drafts, old versions: [e.g. anything in
  /Archive, anything with "old" or "draft" in the name]
```

## Before your first run

**The "current facts" section is the routine.** Without it, nothing can be checked against anything and the report will be a list of documents that have not been edited recently. Spend fifteen minutes filling it in properly; it is the only maintenance this needs, and it is the same information you would want written down anyway.

**Add leavers as they leave.** The single most useful check here is the one that catches a process pointing at somebody who has gone, and it only works if the list is current.

**Point it at the documents people actually follow.** Not every document in Drive. The onboarding notes, the process documents, the handbook, the runbook. Fifteen documents checked properly beats four hundred checked shallowly.

**It never edits anything.** Reading a document to decide it is wrong and rewriting it are very different levels of confidence.

## What a good run looks like

> **18 documents. 1 high, 3 medium, 4 low.**
>
> **HIGH — 1**
>
> **Refund process.doc**, line 4:
> > *"Forward the request to jenny@ to approve anything over £200."*
> Jenny left in March. That address is no longer monitored. Anybody following this document is sending refund approvals into a mailbox nobody reads.
> *Should probably say:* approvals go to Marcus — but confirm that, the current facts list does not say who took this over.
>
> **MEDIUM — 3**
>
> **New starter checklist.doc**: says accounts are created in the old admin tool, replaced in June.
>
> **Pricing notes.doc**: says the standard plan is £39. It has been £49 since January. This document is used when quoting.
>
> **Month end.doc** says close is on the 1st. An email on 23 September records the decision to move it to the 3rd. *Both quoted below.*
>
> **LOW — 4**
> Four documents reference the "Q1 launch", which happened. Two link to a folder that no longer exists.
>
> **Not edited in over a year — 5.** Including Refund process.doc, last edited 14 months ago.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Add the **Slack** connector and keep Drive and Gmail.

## When it goes wrong

**It finds nothing.** The current-facts section is empty, so there is nothing to check against. This is the only real failure mode.

**It flags everything as wrong.** Usually an archive folder being read. Put old versions in a separate folder and add it to the ignore list.

**It suggests corrections that are wrong.** Harden it: "Only suggest a replacement if the correct value is in the current facts or in an email you can quote. Otherwise write 'needs checking' and name who would know."

**It reports the same items week after week.** That is the routine working correctly and nobody fixing the document. The three-weeks-running flag exists to make that impossible to ignore.

**It cannot read some documents.** PDFs that are scans are images. Spreadsheets with the facts buried in cells often read badly. Move the important processes into plain documents.
