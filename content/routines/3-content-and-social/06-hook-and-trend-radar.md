# Hook & Trend Radar

What is getting attention in your corner of the internet this week, and the lines doing it.

| | |
|---|---|
| **Runs** | Mondays, 08:00 |
| **Cron** | `0 8 * * 1` |
| **Connectors** | None required — it reads public pages |
| **Takes** | One run a week |

---

## Trends are not the useful part

Most trend reports tell you what is popular. That is the least actionable information available, because by the time something is legible as a trend, being early to it is no longer possible.

What is actually useful is narrower: which *openings* are working right now in your specific field. Not the topic — the first twelve words. Hooks go in and out of fashion much faster than subjects do, and they transfer between topics in a way subjects never do.

This routine reads the accounts and communities you tell it to, every Monday, and brings back the lines rather than the themes. It needs no connector, because everything it reads is public.

## Set it up

1. **New routine**, name it `Hook & Trend Radar`
2. Paste the instructions and **list your sources at the bottom** — this is the whole routine
3. **Schedule** → **Weekly** → Monday, 08:00
4. **Connectors**: none. Remove them all. This routine reads public pages and should have access to nothing of yours
5. **Environment**: the default environment blocks most outbound traffic. Edit it to **Full**, or **Custom** with the domains you listed. Without this it returns nothing and looks broken
6. **Create**

## Instructions

```
Report on what is getting attention in this field right now, with the
emphasis on how things are being opened rather than what they are about.

Read each source listed at the bottom. From each, take the posts,
threads, videos or articles from the last 7 days that are visibly
outperforming the rest of that source's recent output.

Then report four things.

1. THE HOOKS. Ten to fifteen opening lines, quoted exactly, from the
   pieces that did best. Next to each, one word for what it is doing:
   contradiction, number, confession, question, warning, list, story.
   Quote them. Do not paraphrase into marketing language, because the
   exact wording is the entire point.
2. THE SHAPES THAT REPEAT. Which of those openings appear more than
   twice across different sources this week. That repetition is the
   signal; a single strong post is not.
3. WHAT IS BEING ARGUED ABOUT. Any subject where you can see people
   disagreeing publicly, not just agreeing. Disagreement is where the
   attention is, and it is where a new voice can enter.
4. WHAT HAS GONE QUIET. Anything that was everywhere last month and is
   not this week. This is the half of a trend report nobody writes, and
   it is the half that stops you arriving late.

Then give me five hooks of my own, written for what I do — described at
the bottom — using the shapes that are working this week. Mine, not
copies. Each one under 15 words.

Email the result to the connected account, subject "Hook radar — [date]".

Report what you can actually read. If a source did not load, say so
rather than filling the gap from memory. Do not speculate about why
something is popular.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Sources — public URLs, 4 to 8 of them: [e.g. a competitor blog, a trade
  publication, one community your customers use]

What I do, in one sentence: [e.g. I help small workshops stop running on
  spreadsheets]
Who I am trying to reach: [be specific — "workshop owners with 3 to 15
  staff"]
```

## Choosing sources

Four to eight is right. More than that and every week looks the same because the signal averages out.

Good sources have a visible measure of what did well — likes, replies, upvotes, view counts. Worth including:

- two or three people in your field who post constantly and publicly
- one community where your customers talk to each other rather than to sellers
- one place slightly adjacent to your field, which is where most genuinely new angles come from
- one publication your customers read that is not about your industry at all

Avoid sources that are entirely your competitors. You will end up sounding like a summary of them.

## Before your first run

**The network setting is what catches people.** The default cloud environment allows only a package-registry allowlist. A routine that browses the open web silently returns nothing. Set **Full**, or **Custom** with your listed domains.

**Some sources will not be readable.** Anything behind a login, and some platforms, will simply not load. The routine says so rather than pretending. Replace those with something public.

**The hooks are for studying, not copying.** Lifting a line verbatim from somebody in your own field is obvious to exactly the audience you are trying to reach. The five it writes for you at the end are the point.

## What a good run looks like

> **Hooks that worked this week**
> *"You are not behind. You are just comparing your Tuesday to someone's highlight reel."* — contradiction
> *"I spent £4,000 finding this out so you do not have to."* — number
> *"I have been doing this for nine years and I still get this wrong."* — confession
> *"Stop optimising the thing nobody is reading."* — warning
>
> **Shapes repeating**: confession openings appear in five of this week's top pieces across three different sources. Last week there was one. Numbers are steady. Pure list openings are down.
>
> **Being argued about**: whether onboarding should be shorter or more thorough. Two large accounts took opposite sides on Thursday and the replies are still going.
>
> **Gone quiet**: the "AI will replace X" framing was everywhere four weeks ago and appears once this week.
>
> **Five for you**
> — I got my own pricing wrong for two years.
> — Your onboarding is not too long. It is too quiet.
> — Nobody abandons a setup because it was hard.
> — I charge less than I should and I know exactly why.
> — The cheapest customer you have is the one you already lost.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #content channel in Slack.

Change `#content` to your channel and add the **Slack** connector.

## When it goes wrong

**It comes back empty with a green run.** Network access. This is the routine that hits it hardest, because reading the open web is all it does.

**Every week says the same thing.** Your sources post the same way every week. Swap two of them, and make sure at least one is outside your field.

**The five hooks it writes are generic.** The one-sentence description of what you do is too broad. "I help businesses grow" produces hooks that could belong to anyone. Specific input, specific output.

**It quotes things that clearly are not popular.** Some sources hide their numbers. Add: "If a source does not show engagement figures, say so and skip it rather than guessing at what did well."
