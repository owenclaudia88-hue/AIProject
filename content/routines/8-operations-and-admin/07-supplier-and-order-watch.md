# Supplier & Order Watch

Every order you are waiting on, and which one is about to be late.

| | |
|---|---|
| **Runs** | Daily, 08:00 |
| **Cron** | `0 8 * * *` |
| **Connectors** | Gmail. Google Drive optional |
| **Takes** | One run a day |

---

## Nobody tells you an order is late

Suppliers do not send a message saying they have missed a date. The order simply does not arrive, and you find out when you go looking for it — which is usually the day you needed it.

The information was all there. The confirmation email said the lead time. The dispatch note never came. A price on an invoice went up eight percent and nobody compared it to the last one.

This routine reads the supplier email every morning and keeps the running picture: what is on order, what is due, what is late, and what quietly got more expensive.

## Set it up

1. In Gmail, make a label called `Suppliers` and filter supplier email into it
2. **New routine**, name it `Supplier & Order Watch`
3. Paste the instructions and **list your suppliers and lead times at the bottom**
4. **Schedule** → **Daily** → 08:00
5. **Connectors**: Gmail. Add Google Drive if you keep an order sheet
6. **Create**

## Instructions

```
Tell me the state of everything on order.

Read emails with the label named below from the last 120 days. Build the
current picture of every order: confirmations, dispatch notes, delivery
notifications, invoices, delays, and anything that changes a date.

Match them up. An order is complete when there is evidence it arrived —
a delivery confirmation, an invoice for goods received, or an email from
us acknowledging it. Anything without that evidence is still open.

Report five things.

1. LATE. Anything past its expected date with no evidence of arrival.
   Longest first. For each: supplier, what it is, the value, the date it
   was expected, how many days late, and whether they have said anything
   about it. Anything more than a week late where the supplier has gone
   silent gets called out separately — silence is the signal, not the
   delay.

2. DUE IN THE NEXT 7 DAYS. So there is time to chase before it becomes
   section 1.

3. OPEN WITH NO DATE. Orders confirmed with no expected date given, or
   where the date was never confirmed. These are the ones that disappear
   for two months. Say how long ago each was placed.

4. PRICE CHANGES. Any invoice where the unit price differs from the
   previous invoice for the same item from the same supplier. Give both
   prices, the percentage, and the dates. Supplier price rises are
   almost never announced — they arrive on an invoice and get paid.

5. ANYTHING THAT NEEDS AN ANSWER. Supplier emails asking us something
   that has had no reply — a confirmation needed, a substitution
   offered, a query about an order.

Then for anything in section 1 that is more than 3 days late, draft a
chase email. Under 60 words, specific: the order, the date agreed, and
one direct question about when it will arrive. Not apologetic, and not
aggressive — you will be dealing with these people next month.

Then one line: the total value of everything currently open.

Never send anything. Draft only.

If nothing is late and nothing needs an answer, say so in one line with
the count of open orders.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Gmail label: Suppliers
Suppliers — name, what we buy, usual lead time: [e.g. Kestrel Supplies — oak panels — 10 working days]
Orders not placed by email — add them here: [e.g. anything ordered by phone or through a supplier portal]
Ignore these senders: [e.g. noreply@, marketing@, anything with "newsletter" in the address]
```

## Before your first run

**Fill in the usual lead times.** Many suppliers confirm an order without giving a date. Without a lead time to work from, everything lands in section 3 and the routine cannot tell you anything is late.

**Section 4 usually pays for the routine.** Supplier prices drift upwards in small increments on individual invoices, and almost nobody compares one invoice to the last one. An eight percent rise on a regular order is real money and it is invisible unless something is watching for it.

**Section 3 is where things get lost.** An order with no date is not tracked by anybody — not by you, and often not by them.

**It drafts and does not send.** Supplier relationships are long, and the tone of a chase matters more than its speed.

## What a good run looks like

> **14 open orders, £8,340 total value. 2 late, 1 needs an answer.**
>
> **Late — 2**
>
> **Kestrel Supplies — oak panels, £1,240. Expected 12 September, 12 days late.** They confirmed on 28 August and have said nothing since. **Silent for 12 days.**
> > Subject: Order 4471 — oak panels
> > Hello — order 4471 was confirmed for the 12th and has not arrived, and I have not heard anything since the confirmation on the 28th. Can you tell me where it is and when it will ship? I have work booked around it.
>
> **Ardley Metals — fixings, £180. Expected 20 September, 4 days late.** They emailed on the 19th to say it slipped to "early next week", so this one is known.
>
> **Due in the next 7 days — 3**
> Kestrel, hinges, £340, due Thursday. Two others Friday.
>
> **Open with no date — 2**
> Ardley Metals, brackets, £420, ordered **6 weeks ago**, no date ever confirmed.
> Fenwick Timber, £95, ordered 3 weeks ago.
>
> **Price changes — 1**
> **Kestrel Supplies, oak panels: £62/unit on 28 August, £58/unit on 3 July. Up 6.9%.** No notice given.
>
> **Needs an answer — 1**
> Fenwick Timber asked on 21 September whether a substitution is acceptable. No reply. Three days.

## Keeping an order sheet instead

If a lot of your ordering happens by phone or through a portal rather than by email, connect Google Drive and keep a sheet: supplier, item, value, date ordered, date expected, arrived yes or no.

Add one line to the instructions: *"Also read the order sheet in Drive and include everything on it."*

More accurate, more work. Start with email and add the sheet only for the orders that do not come through it.

## Prefer Slack instead of email?

Add a sending instruction to the prompt:

> Post the result as a single message to the #ops channel in Slack.

Then add the **Slack** connector, keeping Gmail as the source.

## When it goes wrong

**Everything shows as open.** It cannot find evidence of arrival. If you never acknowledge deliveries by email, nothing will ever close. The order sheet is the fix, or add: "Treat an order as complete once an invoice for it has been received."

**It misses orders placed through a portal.** They leave no email trail. Put them in the manual list or the sheet.

**Price comparisons are wrong.** Usually different quantities or units being compared. Add: "Only compare prices for the same item at the same unit and quantity. If the units differ, say so rather than calculating a change."

**The late list never empties.** Some of those orders were cancelled or arrived without a paper trail. Add a line to the bottom section listing order numbers to ignore.
