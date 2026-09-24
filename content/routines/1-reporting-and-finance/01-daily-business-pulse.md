# Daily Business Pulse

Yesterday's numbers, in Slack, before you open your laptop.

| | |
|---|---|
| **Runs** | Weekdays, 07:00 your time |
| **Cron** | `0 7 * * 1-5` |
| **Connectors** | Stripe, Slack |
| **Takes** | About one run a day of your allowance |

---

## Set it up

1. Go to **claude.ai/code/routines** and click **New routine**
2. Name it `Daily Business Pulse`
3. Paste the instructions below
4. Under **Select a trigger**, choose **Schedule** → **Weekdays** → 07:00
5. Under **Connectors**, keep **Stripe** and **Slack**. Remove everything else
6. Click **Create**

Then open it and press **Run now** once, so you see the output before tomorrow morning rather than after.

## Instructions

```
Report yesterday's trading figures to Slack.

From Stripe, for yesterday only:
- gross revenue from successful charges
- number of successful charges
- refunds issued, with amounts
- failed or declined payments
- net new active subscriptions

Compare revenue and charge count against the same weekday last week, and
against the average of the last 7 days. Give both as a percentage change.

Post one message to the #general channel in Slack. Open with revenue and
the change against last week. Then one short line each for charges,
refunds, failures and subscriptions.

Call out anything that deserves a human:
- more than 10% of payment attempts failed
- a single refund over $100
- revenue more than 40% below the 7-day average
- a subscription cancelled within 48 hours of starting

If none of those apply, end with "Nothing needs you today." Do not pad the
message to make it look busier.

Keep the whole thing under 120 words. No greeting, no sign-off, no offer to
help further.
```

## Before your first run

**Change `#general`** to whichever channel you actually read in the morning. A daily message in a channel nobody opens is worse than no message.

**Check your Stripe connector is the live account**, not a test one. Test mode will report zero every day and look like a broken routine rather than a misconfiguration.

**If you sell in more than one currency**, add a line saying which to report in, or you will get a total that adds dollars to euros.

## What a good run looks like

> Revenue $1,240 yesterday, up 18% on last Tuesday and 9% above the 7-day average.
> 41 charges, 2 refunds totalling $58, 3 failed payments.
> 6 new subscriptions, none cancelled.
> Nothing needs you today.

## Prefer email instead of Slack?

Plenty of people do not live in Slack. This one sends there by default, but the
swap takes one line.

In the instructions, replace the Slack sentence with:

> Email the result to the connected account with the subject "[name of this
> automation] — [date]".

Then swap the **Slack** connector for **Gmail** on the routine. Everything else
stays exactly the same.

## When it goes wrong

**A green run with no Slack message.** A green status only means the session started and exited without crashing — it does not mean the task worked. Open the run and read the transcript. Nine times out of ten the Slack connector was removed from the routine, or the channel name is wrong.

**Zeroes every morning.** The Stripe connector is pointed at test mode.

**It writes an essay.** The word limit is in the prompt for a reason, but a model under instruction pressure will sometimes ignore it. Add "Hard limit: 120 words. If you exceed it, cut detail, not the alerts." as a final line.

## Variations worth making

Change the schedule to `0 7 * * *` to include weekends — worth it if you sell to consumers, not worth it if you sell B2B.

Swap Slack for Gmail and it becomes a morning email instead. Everything else stays the same.
