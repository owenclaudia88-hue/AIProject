# Contract & Renewal Watch

Tells you about a notice period while you can still use it.

| | |
|---|---|
| **Runs** | Mondays, 08:00 |
| **Cron** | `0 8 * * 1` |
| **Connectors** | Gmail, Google Drive |
| **Takes** | One run a week |

---

## The date that costs money is not the renewal date

Contracts do not usually cost you money by renewing. They cost you money by renewing *after* the date you could have done something about it.

A twelve-month contract with a ninety-day notice period has a real deadline nine months in, and nobody has that date written down anywhere. So it renews, and you find out in month thirteen, and the honest answer is that you would have cancelled it if anybody had asked you in month nine.

This routine reads your contracts and your email for dates, works backwards from the renewal to the last day you can act, and tells you weeks before that — not weeks before the renewal.

This is about contracts with terms: insurance, leases, suppliers, agencies, maintenance, phone and broadband. For software subscriptions charged to a card, the Subscription Spend Audit is the routine that covers those.

## Set it up

1. In Google Drive, make a folder called `Contracts` and put whatever you have in it. PDFs are fine
2. **New routine**, name it `Contract & Renewal Watch`
3. Paste the instructions and **list anything not in the folder at the bottom**
4. **Schedule** → **Weekly** → Monday, 08:00
5. **Connectors**: Google Drive and Gmail
6. **Create**

## Instructions

```
Tell me about every contract deadline coming up, working backwards from
the notice period rather than from the renewal.

Read every document in the Drive folder named below. Also read the
manually listed contracts at the bottom. Also search email for renewal
notices, contract confirmations and anything that reads like a term
being agreed.

For each contract, establish and state clearly:
- who it is with, and what it is for
- what it costs, and how often
- when the current term ends
- the notice period, quoted from the document if you can find it
- whether it renews automatically
- THE ACT-BY DATE: the renewal date minus the notice period, minus a
  two-week margin. This is the date that matters and it is the one
  nobody writes down.

If you cannot find a notice period, say "notice period not found" rather
than assuming one. An assumed notice period is worse than none, because
it produces a confident wrong date.

Then report in four groups, in this order:

1. ACT-BY DATE WITHIN 30 DAYS. These need a decision now. For each, say
   exactly how many days are left and what the decision is.
2. ACT-BY DATE WITHIN 90 DAYS. Diary these.
3. ALREADY PASSED THE ACT-BY DATE, still before renewal. Say so plainly
   — it may still be worth a conversation, and some suppliers will
   release you, but the leverage has gone.
4. NOTICE PERIOD UNKNOWN. Everything where the document was missing or
   unclear. This group is a to-do list: find the contract.

For anything in group 1, give me three lines: what it costs a year, what
happens if I do nothing, and the one question to ask before deciding.

Then, once a quarter's worth of runs, note anything that has been in
group 4 for more than a month. A contract nobody can find is a risk on
its own.

Email the result to the connected account, subject "Contract deadlines —
[date]".

State only what the documents and emails actually say. Do not estimate a
renewal date, and do not infer a notice period from what is typical.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Drive folder: Contracts
Contracts not in the folder — who with, what for, cost, renewal date,
notice period: [e.g. Fairbank Brokers — insurance — £1,840/yr — renews 14
  Dec — 60 days]
Ignore these: [e.g. anything already cancelled, or contracts under
  £20/month]
```

## Before your first run

**Put whatever you have in the folder, even if it is a mess.** Signed PDFs, confirmation emails, a scan of something from 2023. It reads what is there, and an incomplete picture surfaced weekly is enormously better than a complete one nobody has assembled.

**Group 4 is the first thing to work through.** Every contract whose notice period you cannot find is one that will renew by surprise. Finding five of them in the first month is normal, and dealing with them is a one-off job.

**The two-week margin is deliberate.** A notice deadline that lands on the day you find out is not a deadline you can use — you need time to get a quote from somewhere else, or to have the conversation.

**This finds obligations, not just costs.** Some of what it surfaces will be things you want to keep. The point is deciding rather than defaulting.

## What a good run looks like

> **11 contracts tracked. 1 needs a decision now, 2 within 90 days, 3 with no notice period found.**
>
> **Act by within 30 days — 1**
>
> **Business insurance — Fairbank Brokers.** £1,840/year.
> Term ends 14 December. Notice period **60 days**, quoted from clause 9.2. **Act-by date: 1 October — 7 days away.**
> *Costs you:* £1,840 a year.
> *If you do nothing:* it renews for another 12 months, at whatever they set, and you are in it until December 2027.
> *Ask first:* whether last year's claim affects the renewal quote. Get that answer before you shop around, because it changes what a competitive quote looks like.
>
> **Within 90 days — 2**
> Unit lease, Harlow Estates. £14,400/year, term ends 31 March, 3 months' notice. **Act by 17 December.**
> Waste collection, £62/month, ends 28 February, 1 month notice. **Act by 14 January.**
>
> **Passed the act-by date — 1**
> Card machine rental, £39/month, renewed 1 September on a 12-month term. Notice was 30 days and the date passed on 1 August. Worth a call — some providers will release you — but you no longer have the right to.
>
> **Notice period not found — 3**
> Accountancy engagement letter — document in the folder, no term stated.
> Cleaning contract — no document, found only in an email from 2024.
> Phone and broadband — no document at all.

## When it goes wrong

**It cannot read your PDFs.** Scans of paper documents are images. If a contract is a photograph of a page, put the key dates into the manual list at the bottom instead.

**It invents notice periods.** Explicitly forbidden, so harden it: "Quote the clause. If you cannot quote a clause, write 'notice period not found'."

**It misses a contract entirely.** It only knows what is in the folder, the manual list, and your email. Anything agreed on a phone call exists nowhere and cannot be found.

**Dates are wrong.** Usually because a contract has been renewed since the document in the folder was signed. Check the most recent renewal email rather than the original contract, and say so in the instructions if this is common for you.

**Everything is in group 4.** The folder is empty or full of things that are not contracts. Start with the five that cost the most and build from there.
