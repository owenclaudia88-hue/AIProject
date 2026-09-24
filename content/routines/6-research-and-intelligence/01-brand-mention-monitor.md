# Brand Mention Monitor

Everywhere your name came up this week, including the places you would never have looked.

| | |
|---|---|
| **Runs** | Daily, 08:00 |
| **Cron** | `0 8 * * *` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a day |

---

## The conversation happening without you

Somebody recommends you in a forum. Somebody else asks whether you are any good, and gets an answer from a person who used you eighteen months ago. A blog compares you to two competitors and gets one fact wrong. A customer posts a complaint somewhere you do not have an account.

All of that is happening now, and none of it arrives in your inbox.

Monitoring tools for this exist and cost real money every month. This does the useful eighty percent of what they do, once a day, for nothing beyond a run of your allowance — and unlike most of them, it tells you which mentions are actually worth your time rather than emailing you about every single one.

## Set it up

1. **New routine**, name it `Brand Mention Monitor`
2. Paste the instructions into the big **Instructions** box
3. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** put your name and your places.
4. **Schedule** → **Daily** → 08:00
5. **Connectors**: none. Remove them all — this reads public pages and needs access to nothing of yours
6. **Environment**: the default blocks most outbound traffic. Edit it to **Full**, or **Custom** with the domains you listed. Without this it finds nothing and looks broken
7. **Create**

## Instructions

```
Find everywhere we were mentioned in the last 24 hours.

Search for the names and terms listed at the bottom. Check the places
listed there, and search the open web generally.

Report only genuine mentions of us. Exclude our own pages, our own
posts, our own press releases, and anything that is just a directory
listing or a scraped copy of our site.

Sort what you find into four groups, in this order.

1. NEEDS AN ANSWER TODAY
   - somebody asking whether we are any good, or which of us and a
     competitor to choose
   - a complaint or a criticism, anywhere visible
   - a factual error about our product, our price, or what we do
   - somebody asking a question we could answer
   These decay fast. A question answered the same day reads as
   attentive; the same answer four days later reads as monitoring.

2. WORTH KNOWING
   - a recommendation or positive mention
   - a comparison or review
   - a mention in an article or newsletter

3. BACKGROUND
   - passing references with nothing to act on

4. NOT US
   - anything matching the name but about something else. Count these
     and do not list them, unless the count is high, in which case say
     so — a name collision that produces thirty false hits a day is
     worth knowing about.

For everything in the first two groups give: where, a link, the date, who
said it as far as is public, what they actually said quoted directly, and
how visible it is — a big forum or a dead blog.

For NEEDS AN ANSWER TODAY, add one line on what to say. Not a script —
the substance of the right reply, and whether it should come from you
publicly, from you privately, or not at all. Sometimes not at all is
correct, and it is worth saying so explicitly.

Quote exactly. Do not soften a criticism into a summary — the wording is
how you judge whether it matters.

Do not respond, post, comment or register anywhere. This reads and
reports.

If there was nothing, say so in one line.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Our name, and any variants and misspellings: [e.g. Northfield Makes,
  Northfield, "north field", Northfeild]
Our product names: [e.g. the Workshop Plan, the Starter Kit]
Our founders' names, if worth watching: [e.g. Priya Shah — leave blank if
  you would rather not]
Places to check specifically — forums, communities, review sites,
subreddits, directories: [e.g. reddit.com/r/smallbusiness, your main trade
  forum, your Trustpilot page]
Terms that produce false matches: [e.g. the band with the same name, the
  town in Yorkshire]
```

## Choosing the places

The open-web search catches most things. The named places are for where your customers actually talk, which is usually two or three specific communities and one review site.

Worth adding: your industry's main forum, any subreddit your customers use, the review platforms you are listed on, and any comparison site that ranks your category. Anything behind a login will not be readable — say so in the false-matches section rather than leaving it to fail silently every day.

## Before your first run

**The network setting is the whole thing.** The default environment allows only a package-registry allowlist. A routine whose entire job is reading the open web will silently return nothing. Set **Full**, or **Custom** with your listed domains.

**Fill in the misspellings.** People get names wrong constantly, and the wrong versions are where the unguarded opinions live.

**Same-day matters for group one.** That is why this runs daily rather than weekly. A question in a forum has a useful lifespan of about a day.

**It never posts anything.** Replying publicly under your own brand is a judgement call every time, especially to criticism.

## What a good run looks like

> **4 mentions. 1 needs you today.**
>
> **Needs an answer today**
> **r/smallbusiness**, 11 hours ago, thread with 34 comments. User `hartley_makes`:
> > *"has anyone actually used [name]? looks decent but the pricing page is vague about whether it's per user"*
> Two people have replied and neither knows.
> *What to say:* answer the question, publicly, in one sentence, from an account that says who you are. It is per account, not per user. Do not pitch anything — the useful thing here is being the person who answered.
>
> **Worth knowing**
> **A newsletter**, yesterday, in a roundup of five tools:
> > *"the one I keep recommending to people who are still doing this in a spreadsheet"*
> No action needed. Worth noting who wrote it.
>
> **A comparison blog**, updated 2 days ago, lists your price as £69. It is £49 and has been for a year.
> *What to say:* email the author privately with the correction. Do not comment publicly on a comparison post — it reads as defensive whatever you write.
>
> **Background** — 1 passing reference in a list post.
>
> **Not us** — 6 matches, all a band with a similar name. Consistent every day; worth adding to the false-matches list.

## Prefer Slack instead of email?

Worth it here, because same-day matters and a Slack message gets seen faster.

Add a sending instruction to the prompt:

> Post the result as a single message to the #mentions channel in Slack.
> If anything is in NEEDS AN ANSWER TODAY, put that at the top of the
> message.

Then add the **Slack** connector.

## When it goes wrong

**It finds nothing, ever, and the run is green.** Network access. This routine is the one that hits it hardest.

**It finds your own website every day.** The exclusion is there; make it specific by listing your own domains in the false-matches section.

**Endless false matches.** Your brand name is a common word. Add context to the search terms — your name plus your category — and list the collisions explicitly.

**It misses a mention you found yourself.** Almost always a place that needs a login, or a platform that blocks automated reading. Add the place to the list anyway, and expect it to report that it could not read it, which is at least honest.

**It suggests replying to everything.** Add: "Recommend replying only where a reply would be useful to the reader. Defending yourself is not useful to the reader."
