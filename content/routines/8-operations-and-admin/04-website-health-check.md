# Website Health Check

Finds the broken page, the dead link and the year-old price before a customer does.

| | |
|---|---|
| **Runs** | Daily, 06:00 |
| **Cron** | `0 6 * * *` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a day |

---

## Websites rot quietly

Nothing on a website announces that it has broken. A payment link stops working. A page 404s because something was renamed. The pricing page says £39 and the checkout says £49. A form submits into nowhere because the address it forwards to was closed last year.

None of it errors anywhere you would see. The only monitoring most small businesses have is a customer eventually mentioning it, and most customers do not mention it — they leave.

This routine walks your own site every morning like a visitor would and tells you what is wrong. It reads public pages, so it needs no access to anything.

## What this does and does not check

It checks what a visitor can see: pages loading, links working, prices agreeing, forms existing, content being current.

It is not uptime monitoring and should not replace it. A proper uptime service checks every minute from several countries and wakes you up; this checks once a day and emails you. If your business depends on being online, have both — most uptime services have a free tier and this is not a substitute for one.

It also cannot complete a purchase, submit a form, or test anything behind a login.

## Set it up

1. **New routine**, name it `Website Health Check`
2. Paste the instructions and **list your pages at the bottom**
3. **Schedule** → **Daily** → 06:00
4. **Connectors**: none. Remove them all
5. **Environment**: **Full**, or **Custom** with your own domain and any domain you link to. Without this it cannot read anything
6. **Create**

## Instructions

```
Check the website the way a visitor would, and report only what is
wrong.

Visit every page listed at the bottom, plus anything linked from the
main navigation.

Check each of these:

1. DOES IT LOAD. Every page. Report anything that errors, redirects
   somewhere unexpected, or takes visibly long. Give the status.

2. LINKS. Every link on every listed page. Report any that are broken,
   that go somewhere other than what the link text says, or that point
   at a domain that no longer resolves. Check the footer as carefully as
   the body — footer links are the oldest links on any site and nobody
   ever looks at them.

3. PRICES. Every price shown anywhere. Report any disagreement between
   pages. A price on the homepage that differs from the pricing page is
   the most expensive fault on this list, and it is invisible until
   somebody complains.

4. FORMS AND BUTTONS. Every form and every call-to-action button:
   does it exist, does it point somewhere, does the destination load.
   You cannot submit anything — say what you could and could not verify
   rather than implying a form works.

5. CONTENT THAT HAS GONE STALE. Anything with a date in it that has
   passed. Announcements of things that have happened. "Coming soon" on
   something that has arrived. A copyright year that is not this year.
   Offers with an end date in the past.

6. THE BASICS A VISITOR NEEDS. Is there a way to contact you on every
   page. Does the contact address look current. Is there a privacy
   policy and terms page, and do they load. Is there anything on the
   site that contradicts anything else on the site.

7. MOBILE. Read each page as a narrow screen would and report anything
   obviously broken — text running off, a navigation that cannot be
   opened, a button that is unreachable. Be honest about the limits of
   what you can tell this way.

Report ONLY problems. If everything passes, send one line saying so with
the number of pages and links checked. Do not send a list of things that
are fine — a daily report full of successes is a daily report nobody
reads, and then nobody reads it on the day something breaks.

Rank what you find: anything that stops somebody buying comes first,
then anything that stops somebody getting in touch, then everything
else.

If you could not check something, say so and say why. Do not report a
page as fine when you could not read it.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Pages to check — the homepage, pricing, checkout, contact, and any page
that matters: [e.g. https://yourcompany.com, /pricing, /checkout, /contact]
Prices that should be consistent everywhere: [e.g. £49/mo, £490/year]
Known issues to ignore: [e.g. /old-pricing redirects on purpose, the blog has no contact link and that is fine]
```

## Before your first run

**Environment set to Full or Custom.** This routine is nothing but reading the web.

**Include your checkout page.** It is the page that matters most and the one people leave out because it feels like it belongs to the payment provider.

**The first run will find things.** Usually a footer link from a redesign, a copyright year, and something described as coming soon that arrived in April. That is normal, and clearing them is a one-off hour.

**Fill in "known issues to ignore" after the first run.** Some things are deliberate — a link that redirects on purpose, a page that is meant to be sparse. Otherwise you get the same three false alarms every morning until you stop reading it.

**Silence is the expected state.** Most days it should send one line.

## What a good run looks like

Most mornings:

> **All clear.** 14 pages, 122 links, no problems found.

The morning it matters:

> **3 problems. 1 is costing money right now.**
>
> **Stops somebody buying**
> **The pricing page says £39. The checkout says £49.** Pricing page last changed — unknown, but the checkout has said £49 throughout every check for the last 30 days. Anybody arriving from the pricing page is seeing a £10 increase at the moment they enter their card.
>
> **Stops somebody getting in touch**
> **The contact form on /contact has no destination.** The form element is present but has no action attribute. It will appear to submit and go nowhere. Could not verify by submitting — checked the markup only.
>
> **Everything else**
> Footer link "Case studies" → /case-studies returns 404. Present on all 14 pages.
> Copyright notice says 2024.
> The homepage banner still says "Summer offer — ends 31 August".
>
> *Could not check: /account and anything behind the login.*

## Prefer Slack instead of email?

Worth it — a daily one-liner is better suited to a channel than an inbox.

Add a sending instruction to the prompt:

> Post the result as a single message to the #alerts channel in Slack.

Then add the **Slack** connector.

## When it goes wrong

**It reports everything as broken.** Network access, or your site blocks automated reading. If it is the latter, the routine cannot help and you will need a proper monitoring service instead.

**It reports the same three things daily.** Put them in the ignore list, or fix them.

**It says a form works.** It cannot know that. Harden it: "You cannot submit forms. State only what you observed in the page markup."

**It misses a page that was down.** It checks once a day. A site that was down for two hours at 14:00 will pass a 06:00 check. That is the gap uptime monitoring fills, and it is why this is not a replacement for one.

**Mobile findings are vague.** They will be. Treat section 7 as a prompt to look yourself, not as a test.
