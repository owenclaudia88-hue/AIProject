# Support Quality Report

How fast you actually answer, how often you answer properly, and what keeps coming back.

| | |
|---|---|
| **Runs** | Mondays, 10:00 |
| **Cron** | `0 10 * * 1` |
| **Connectors** | Gmail. Stripe optional |
| **Takes** | One run a week |

---

## Everybody thinks they answer quickly

Ask any small business how fast they respond to support and they will tell you the number they hit on a good day. The number they actually hit includes the Friday afternoon they lost, the thread that needed a decision nobody made, and the one that went to spam.

Nobody is lying. It is that response time is a distribution, and everyone remembers the middle of it while their customers experience the tail.

This routine measures the tail. It runs once a week, reads what actually happened, and reports the three things that matter: how long people waited, how often the first answer was the last one needed, and what had to be asked twice.

## Set it up

1. **New routine**, name it `Support Quality Report`
2. Paste the instructions and **fill in the bottom section**
3. **Schedule** → **Weekly** → Monday, 10:00
4. **Connectors**: Gmail. Add Stripe if you want paying customers reported separately
5. **Create**

## Instructions

```
Report on the quality of last week's support.

Read every support thread with activity in the last 7 days, excluding
the senders, domains and labels at the bottom, and excluding automated
mail.

Report five things.

1. RESPONSE TIME. For every thread where a customer wrote and we
   replied: the median time to first reply, the slowest, and the
   proportion answered within the target below. Give the median, not the
   average — one thread that took four days drags an average into
   fiction. Count only working hours as defined at the bottom.

   Then list every thread that took longer than the target, with who,
   how long, and what it was about. Not as a telling-off: the slow ones
   have something in common, and naming them is how you find out what.

2. STILL WAITING. Anybody who wrote and has had no reply at all. Longest
   first. This number should be zero and usually is not.

3. FIRST-ANSWER RATE. How often our first reply ended the thread, versus
   how often the customer had to come back. A thread that needed three
   exchanges to resolve one question usually means the first answer
   assumed something. List the threads that took more than two exchanges
   and say, in a few words, what the first reply missed.

4. WHAT CAME BACK. Anybody who raised the same issue they had raised
   before, this week or previously. Say how many times and how far
   apart. A repeat issue is worth several new ones — it means the fix
   did not hold, or the answer did not land.

5. THE TONE CHECK. Any thread where the customer sounds more frustrated
   at the end than at the start. Quote both ends. These are rare and
   they are the most important thing in the report.

Then the trend against the last four weeks: median response time,
proportion within target, still-waiting count, and volume. Say plainly
whether each is better, worse or flat. Do not soften it.

Finish with the one thing that would most improve next week, in one
sentence.

Email the result to the connected account, subject "Support quality —
week of [date]".

If volume is under ten threads, say so and present the figures as
individual cases rather than statistics. Percentages from six threads
are not percentages.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Target first response: 4 working hours
Working hours: Mon-Fri 09:00-17:00
Ignore these senders, domains and labels: [e.g. @yourcompany.com,
  noreply@, newsletters, label:Receipts]
Our own email addresses: [e.g. you@yourcompany.com, hello@yourcompany.com]
```

## Before your first run

**Working hours matter more than you would expect.** Without them, every message that arrives at 18:00 on Friday shows a 63-hour response time and your figures are meaningless. Set them honestly — if you genuinely answer at weekends, say so.

**The first-answer rate is the number to watch.** Response time is easy to game by replying quickly with nothing useful. First-answer rate cannot be gamed: either your reply solved it or the customer had to write again.

**The tone check will find something eventually.** When it does, read the whole thread rather than the quotes. Those are the threads worth learning from, and there are usually only two or three a year.

**Use the median.** It is in the instructions because the average is what makes support metrics comforting and useless.

## What a good run looks like

> **31 threads last week.**
>
> **Response time** — median **2h 40m**. Slowest 3 days. **74% within 4 working hours**, target met.
> Over target, 8 threads. Six of the eight arrived between Friday 14:00 and Monday 09:00. The slow ones are not spread through the week; they are a Friday afternoon problem.
>
> **Still waiting — 2.** Sarah L., 4 days, about a double charge. Jo T., 2 days.
>
> **First-answer rate — 61%.** 12 threads needed more than one exchange.
> Three of those were the same shape: the first reply answered the question asked, and the customer came back because the real question was one step further on. All three were about exports.
>
> **Came back — 2.** Tom Reilly raised the expired-invite problem on 4 Sept and again on 22 Sept. The fix did not hold.
>
> **Tone check — 1.**
> Sarah L., opened Monday: *"hi, think I might have been charged twice, could you check?"*
> Thursday: *"this is the third time I've written about this. I'll take it up with my bank."*
>
> **Trend** — median response time down from 3h 20m. Within-target up from 68%. **Still-waiting up from 0 to 2.** Volume flat.
>
> **The one thing:** nothing arriving after Friday lunchtime gets answered until Monday. Six of your eight misses and your one tone failure all start there.

## Prefer Slack instead of email?

In the instructions, replace the "Email the result" sentence with:

> Post the result as a single message to the #support channel in Slack.

Add the **Slack** connector and keep Gmail as the source.

## When it goes wrong

**Response times look impossible.** Working hours are not set, or are wrong. This is the first thing to check whenever the numbers look strange.

**It counts internal email as support.** Your own domain is not in the bottom section.

**First-answer rate looks terrible.** Check what it is counting as a second exchange — a customer replying "thanks, perfect" should not count. Add: "Do not count a closing courtesy message as a further exchange."

**The report is depressing every week.** That may be accurate, and the last line exists so there is always one thing to do about it. If the volume is genuinely beyond what you can answer in a week, this report is telling you about capacity rather than quality, and no instruction change will fix that.
