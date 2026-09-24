# Funnel & Tracking Health Check

Finds the day your conversion tracking broke, rather than the week you noticed.

| | |
|---|---|
| **Runs** | Daily, 08:00 |
| **Cron** | `0 8 * * *` |
| **Connectors** | Stripe, Slack. Ad platform or Zapier if you have one |
| **Takes** | One run a day |

---

## The failure this exists for

Tracking breaks silently. A pixel stops firing, a checkout page changes, a consent banner starts blocking — and nothing errors. Ads keep spending, the platform keeps optimising towards a signal it is no longer getting, and the first sign is a bad month.

This compares what the ad platform thinks happened against what actually hit your bank, every morning, and shouts when the two stop agreeing.

## Set it up

1. **New routine**, name it `Funnel & Tracking Health Check`
2. Paste the instructions and **set your normal gap at the bottom**
3. **Schedule** → **Daily** → 08:00
4. **Connectors**: Stripe, Slack, and your ad platform if you have one
5. **Create**, then **Run now** to establish what normal looks like

## Instructions

```
Check that conversion tracking still agrees with reality.

For yesterday, and for each of the seven days before it, collect:

From Stripe:
- number of successful payments
- number of first-time customers

From the ad platform, if connected:
- conversions reported
- spend

Then check for each of these, and alert on any that are true:

1. The ad platform reported conversions yesterday but Stripe shows no
   payments at all. Something is being counted that is not happening.
2. Stripe shows payments but the ad platform reported zero conversions.
   This is the common one, and it means the pixel or the server events
   have stopped arriving.
3. The ratio between platform conversions and Stripe payments has moved
   by more than the tolerance below, against its own 7-day average.
4. Spend continued yesterday while reported conversions were zero.
5. Payments dropped to zero yesterday on a day of the week that normally
   has some.

Post to the Slack channel below, one message, naming which check fired and
the numbers behind it.

If every check passes, post nothing.

A gap between platform and Stripe numbers is normal — attribution windows
and organic traffic both cause it. This routine is watching for the gap
changing, not for the gap existing.

--- EDIT BELOW THIS LINE ---

Slack channel: #alerts
Tolerance for a change in the ratio: 50%
```

## If you have no ad-platform connector

Checks 1 to 4 need one. Check 5 — payments falling to zero on a day that normally has some — works on Stripe alone, and it is the check that catches a broken checkout page.

You can run this routine with Stripe only and it remains worth having. Remove the platform section from the prompt so it does not report a missing connector as a finding every morning.

## Before your first run

**Let it run a week before trusting the ratio check.** It needs its own history to know what normal is.

**Fifty percent is deliberately loose.** Attribution moves around day to day. Tighten it once you have seen a fortnight of real numbers.

**Check 5 is the one that pays for this.** A checkout that silently stops accepting cards produces exactly this signature: spend continues, traffic continues, payments stop.

## What a good run looks like

Silence, most days.

> **Tracking check failed — 2 of 5**
>
> Stripe recorded 14 payments yesterday. Meta reported 0 conversions. The 7-day average is 11 reported against 13 actual, so this is not the usual gap.
>
> Spend continued at $46 with zero reported conversions.
>
> Both point at the same thing: conversions stopped being reported some time after 18:00 on the 23rd.

## When it goes wrong

**It fires every day about the ratio.** Your tolerance is too tight, or you genuinely have very few conversions a day — in which case the ratio is noise and you should delete check 3 and keep the rest.

**It says the ad platform reported nothing, every day, from the first run.** That is not a tracking failure, that is no connector. Remove the platform section.
