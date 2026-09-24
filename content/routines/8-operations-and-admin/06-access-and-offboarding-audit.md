# Access & Offboarding Audit

Who still has keys to things, months after they stopped needing them.

| | |
|---|---|
| **Runs** | 1st of the month, 09:00 |
| **Cron** | `0 9 1 * *` |
| **Connectors** | Gmail, Google Drive |
| **Takes** | One run a month |

---

## Access only ever accumulates

Granting access takes ten seconds and happens whenever somebody needs something. Removing it takes a deliberate act that nobody is responsible for, and which produces no visible benefit when it is done.

So it never happens. The contractor from last spring is still in the shared drive. The agency you stopped using has an account on your ad platform. A former employee's email address is still on the bank's notification list, and their personal address is still on a document with your customers' details in it.

None of this is malicious and almost all of it is real. This routine reconstructs, once a month, who appears to have access to what, and who should not.

## What this can and cannot see

It cannot log into your systems and list users. No connector exposes that, and one that did would be a serious thing to hand to an automation.

What it can do is reconstruct the picture from the paper trail: invitation emails, sharing notifications, "you have been added" messages, Drive sharing settings, and the leavers you tell it about. That is enough to produce a list of things to go and check, which is the part nobody ever gets round to starting.

Treat the output as a to-do list for a human, not as an audit.

## Set it up

1. **New routine**, name it `Access & Offboarding Audit`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** list your people, your systems and your leavers.
4. **Schedule** → **Monthly** → 1st, 09:00
5. **Connectors**: Gmail and Google Drive
6. **Create**

## Instructions

```
Reconstruct who appears to have access to what, and flag what should be
removed.

Search email, all of it, for anything that records access being granted:
invitations, "you've been added", "has been given access", sharing
notifications, new user confirmations, API key or token notices,
password reset confirmations for shared accounts.

Read the sharing settings on the Drive folders listed at the bottom.

Build a picture: for each system listed at the bottom, who appears to
have access, when it was granted, and what the evidence was.

Then flag, in this order:

1. LEAVERS AND FORMER CONTRACTORS. Anybody on the leavers list at the
   bottom who still appears anywhere: in a Drive share, in an
   invitation with no matching removal, on a notification list, as a
   recipient of anything automated. For each, say what and say how long
   it has been since they left. Do this first and do it thoroughly —
   this is the section that matters.

2. PERSONAL ADDRESSES. Any access granted to a personal email address
   rather than a company one, particularly on anything containing
   customer data, financial data, or credentials. Note that some of
   these will be legitimate — a sole trader, a supplier — and say which
   look legitimate rather than flagging all of them equally.

3. SHARED-WITH-ANYONE. Any Drive document or folder set so that anyone
   with the link can open it. Say what is in it, in general terms. This
   is the one that produces the genuine surprises.

4. DORMANT. Anybody who has access to something and has not appeared in
   email at all for longer than the dormancy threshold below. Dormant is
   not the same as wrong — some people legitimately use a system without
   emailing anybody — so present these as worth checking rather than as
   problems.

5. NO EVIDENCE OF REMOVAL. Anywhere an invitation exists with no
   corresponding removal, for somebody no longer on the current people
   list.

6. SHARED ACCOUNTS. Any sign of a login being used by more than one
   person, or credentials being sent by email. If credentials appear in
   an email body, say that they do and say which thread — do not
   reproduce them.

For each item, say what to go and check, and where. Be specific: "check
the user list in [system] for [name]" rather than "review access".

Then one line: how many items are outstanding from last month's run,
based on what is still appearing.

Never attempt to remove anybody's access, change any setting, or log
into anything.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Current people, with their company email addresses: [e.g. Priya Shah —
  priya@yourcompany.com]
Leavers and finished contractors — name, every address they used, and
when they left: [e.g. J. Hart — j.hart@yourcompany.com, jhart88@gmail.com
  — left 14 March 2026]
Systems we use — name each one: [e.g. Stripe, Google Workspace, Xero, the
  ad platform, the website admin]
Drive folders to check sharing on: [e.g. Finance, Customer exports,
  Contracts]
Dormancy threshold: 90 days
```

## Before your first run

**The leavers list is the whole routine.** Every address they ever used, including personal ones and any alias. Without it, section 1 — the section worth running this for — is empty.

**Expect the first run to be uncomfortable.** Everybody has at least one. A contractor from two years ago in a folder, or a shared login in an old email thread. That is the point.

**It never removes anything.** Handing an automation the ability to revoke access is how you lock yourself out of your own payment provider on a Sunday.

**Credentials in email are worth acting on the same day.** If section 6 finds a password in a thread, change it rather than deleting the email. The email is not the exposure; the password is.

**Do this on the 1st and act on it the same week.** A monthly audit nobody acts on is eleven months of the same report.

## What a good run looks like

> **6 items. 2 are from a leaver.**
>
> **Leavers — 2**
> **J. Hart, left 14 March (6 months ago).**
> — Still has edit access to the `Finance` Drive folder, granted 2 Feb. *Check: Drive sharing on Finance.*
> — Still listed as a recipient on the monthly supplier statement, based on an email from 3 September. *Check: the supplier's contact list.*
>
> **Personal addresses — 1**
> The `Customer exports` folder is shared with a gmail.com address not on the current people list, granted 11 August. No invitation email found explaining who this is. *Check: Drive sharing on Customer exports — establish who this is before removing.*
>
> **Shared with anyone — 1**
> `Pricing 2026 — working.doc` is set to "anyone with the link can view". Contains unreleased pricing. *Check: the sharing setting on that document.*
>
> **Dormant — 1**
> A. Rahman has not appeared in any email for 118 days and was invited to the ad platform in May. May be legitimate — they may use it without emailing. *Check: the user list on the ad platform.*
>
> **Shared accounts — 1**
> A password for the shared supplier portal appears in the body of an email thread from 2 July, sent to three people. *Not reproduced here. Change that password this week.*
>
> *Outstanding from last month: 2 of 5 items still appearing.*

## When it goes wrong

**It finds nothing.** The leavers list is empty. That is the only real way this produces a clean report on a first run.

**It flags everybody as dormant.** Your team does not email much. Raise the threshold, or drop section 4.

**It cannot see a system at all.** Expected — it only knows what left a paper trail. For the systems that matter most, the honest answer is to open the user list yourself once a quarter. This routine tells you which ones to look at first.

**It reproduces a password.** Harden it: "Never reproduce a credential, key or token. State only that one is present and name the thread."

**The same items appear every month.** Nobody has acted on them. The outstanding count at the end exists to make that visible.
