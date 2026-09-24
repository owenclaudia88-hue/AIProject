# Search Demand Tracker

Whether people are looking for what you sell, and whether they can find you.

| | |
|---|---|
| **Runs** | Mondays, 06:00 |
| **Cron** | `0 6 * * 1` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a week |

---

## Two questions, one report

The first question is whether demand for what you sell is going up or down. Not your sales — demand. Your sales can fall in a rising market and rise in a falling one, and you cannot tell which is happening by looking at your own numbers.

The second is simpler: when somebody searches for what you sell, what do they find? Most people check this once, at launch, and never again. Meanwhile the results page changes every few months.

This routine answers both every Monday and, more usefully, remembers last week's answer so you can see movement rather than position.

## A note on what this can and cannot do

This reads public search results and public trend pages. It is not a keyword tool, and it will not give you precise monthly search volumes, because those come from paid APIs that no connector exposes.

What it does give you is direction and competition: what appears when somebody searches, who is above you, what the search engine thinks the question means, and what changed since last week. For most small businesses that is the actionable part — the volume number is interesting, and the results page is what you can do something about.

If you have a paid keyword tool, keep it. This complements it rather than replacing it.

## Set it up

1. **New routine**, name it `Search Demand Tracker`
2. Paste the instructions and **list your search terms at the bottom**
3. **Schedule** → **Weekly** → Monday, 06:00
4. **Connectors**: none. Remove them all
5. **Environment**: **Full**, or **Custom** with the search engines and trend sites you want it to read. Without this the routine does nothing at all
6. **Create**

## Instructions

```
Report on search demand and visibility for the terms below.

For each search term listed at the bottom:

1. WHAT IS ON THE RESULTS PAGE. The top ten results, in order: who they
   are, the page title, and whether each is a competitor, a marketplace,
   a directory, a publication, a forum, or us. Note any results that are
   not ordinary links — featured answers, video blocks, question
   sections, shopping results. These change how much of the page is
   actually available to click.

2. WHERE WE ARE. If we appear at all, the position and which page of
   ours it is. If we do not appear in the top ten, say so plainly.

3. WHAT THE SEARCH ENGINE THINKS THE QUESTION MEANS. Judge this from the
   results, not from the words. If somebody searches your term and gets
   ten how-to articles, the search engine has decided this is somebody
   learning, not somebody buying — and a sales page will never rank for
   it no matter how good it is. This is the single most useful judgement
   in the report.

4. RELATED QUESTIONS. Anything listed on the results page as a related
   or commonly asked question. These are real questions real people
   typed, and they are the best free list of content ideas available.

5. WHAT CHANGED since your last run: new entrants to the top ten, anyone
   who dropped out, position changes for us and for the named
   competitors, and any change in the shape of the page. If this is the
   first run, say so and record a baseline.

Then, across all the terms:

- Which terms we are visible for, which we are close on (11 to 20), and
  which we are nowhere on.
- The one term where we are closest to a real improvement, and what is
  currently ranking there instead of us.
- Any term where the intent has clearly shifted since a previous run.
  That matters more than a position change: it means a page that used to
  be right for that term is no longer right for it.

If a general trends source is readable, add a line per term on whether
interest over the last 12 months is rising, flat or falling. If it is
not readable, say so rather than guessing.

Email the result to the connected account, subject "Search — week of
[date]".

Report what you actually read. Do not estimate search volumes, do not
invent difficulty scores, and do not state a position you did not see.
Results vary by location and by who is searching, so note which country
you checked.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Search terms — 8 to 15, in the words a customer would actually use: [e.g.
  "stock spreadsheet falling over", "inventory software small workshop"]
Country to check: [e.g. United Kingdom]
Our domain: [e.g. yourcompany.com]
Competitor domains: [e.g. competitor-a.com, competitor-b.co.uk]
```

## Choosing terms

Use your customers' words, not your industry's. The Customer Language Miner routine exists partly to produce this list — group 3 in its output is exactly what belongs here.

A good set has a mix: two or three terms where somebody is clearly buying, three or four where somebody has the problem but does not yet know the solution exists, and two or three that name your category directly. Include one term you are certain you rank for, as a sanity check that the routine is reading correctly.

## Before your first run

**Environment set to Full or Custom.** Everything about this routine is reading the open web.

**The first run is a baseline.** Direction is the point, and direction needs two readings.

**Watch intent more than position.** Being 11th for a term where the whole page is how-to articles is worth less than being 25th for a term where the page is full of products. Position without intent is the most common way people waste six months of effort.

**Expect some variation run to run.** Search results are personalised and regionalised. A movement of one or two places is noise; a new entrant in the top five is not.

## What a good run looks like

> **11 terms. Visible on 3, close on 2, nowhere on 6.**
>
> **"inventory spreadsheet falling over"** — nowhere.
> Top ten: 6 how-to articles, 2 forum threads, 2 competitor blog posts. No product pages at all.
> *Intent:* somebody learning, not buying. A sales page will not rank here. A genuinely useful article might.
> *Related questions on the page:* "why does my inventory spreadsheet keep breaking", "how many people can use one spreadsheet", "when should you stop using spreadsheets".
>
> **"stock management for small workshops"** — **position 12**, your features page. Closest to a real improvement.
> Above you: 4 competitors, 3 directories, 2 marketplaces, 1 publication. The three directories are beatable.
> *Changed:* you were 14 last week. Competitor A entered at 6 with a page published this month.
>
> **"[your category] software"** — position 4. Unchanged for six weeks.
>
> **Intent shift:** "stock tracking app" was product pages three weeks ago and is now mostly comparison articles. Your product page has dropped from 9 to 19 and that is why — the page did not get worse, the question changed.
>
> *Checked from: United Kingdom. Trends data was not readable this week.*

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #general channel in Slack.

Add the **Slack** connector.

## When it goes wrong

**It returns nothing.** Network access first, always. Some search engines also block automated reading — if one does, the routine should say so. If it does not say so, make it: add "If you could not read a results page, say which and why."

**Your position looks wrong.** It almost certainly is, slightly. Results differ by location, device, and history. Use it for movement, not for a number to report to anybody.

**It invents search volumes.** Explicitly forbidden, so harden it: "You have no access to search volume data. Never state a number of searches."

**Every term is 'nowhere'.** That is often just true early on, and it is better to know. If it is all of them and you know you rank for something, check the sanity-check term — if that is wrong too, the routine is not reading results properly.
