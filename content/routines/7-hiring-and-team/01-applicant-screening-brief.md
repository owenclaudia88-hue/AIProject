# Applicant Screening Brief

Every application summarised against what the job actually needs, so the pile stops being a pile.

| | |
|---|---|
| **Runs** | Daily, 08:00 |
| **Cron** | `0 8 * * *` |
| **Connectors** | Gmail, Google Drive |
| **Takes** | One run a day |

---

## Where hiring quietly goes wrong

Post a job and you get sixty applications in a week. You read the first eight properly, the next twenty quickly, and the last thirty by the first line of the covering letter.

Everybody does this, and everybody knows it is not a process. The people who get read properly are the ones who applied early and wrote a good first sentence — which correlates with being available and confident, and with nothing else.

This routine reads every application with the same attention, against the same written criteria, and gives you the same shape of summary for each. You still decide. You are just deciding from a fair comparison rather than from whoever happened to catch you before lunch.

## Before you set this up: what this does not do

This does not score, rank, reject, or decide. It summarises against criteria you wrote down, and it shows its evidence.

Automated screening that filters people out is a serious thing to build. Depending on where you are, it may carry legal obligations around transparency, bias and the right to a human decision — and beyond the law, a system that silently discards people is a system nobody ever audits.

So this routine is deliberately built to inform a human decision rather than to make one. It presents every applicant. It never suggests rejecting anybody. If you want a ranked shortlist with the bottom half hidden, this is the wrong tool, and you should talk to somebody who does employment law where you are.

## Set it up

1. In Google Drive, put the job description in a document
2. In Gmail, make a label called `Applications` and filter applications into it
3. **New routine**, name it `Applicant Screening Brief`
4. Paste the instructions into the big **Instructions** box
5. **Fill in the settings** at the bottom of the instructions, under the `--- EDIT BELOW THIS LINE ---` marker. Every line is `name: value`. Where the value is in `[square brackets]` it is **an example, not an answer** — it is showing you the kind of thing to write. Delete the brackets and the example, and put your own in. Lines that already have a plain value, like `Look back over: 90 days`, are starting points you can leave alone. **Do not paste this into Claude with the brackets still in it** — the routine will tell you it found an example instead of a setting, and do nothing with it. **On this one especially:** fill in the criteria.
6. **Schedule** → **Daily** → 08:00
7. **Connectors**: Gmail and Google Drive
8. **Create**

## Instructions

```
Summarise the applications that arrived since your last run.

Read emails with the label named below from the last 24 hours, including
attachments. Read the job description document named below.

For each applicant, write the same brief, in the same order, with the
same headings. Consistency is the point — a brief that varies in shape
between candidates reintroduces exactly the unfairness this is meant to
remove.

1. NAME AND HOW THEY APPLIED. Where they came from if it is stated.

2. AGAINST EACH REQUIREMENT. Take the requirements from the bottom
   section, one at a time, in order. For each, say: what evidence they
   gave, quoted from their application; whether that evidence is direct
   (they did this) or indirect (they did something adjacent); or that
   they did not address it. Never infer capability that is not
   evidenced, and never assume somebody has a skill because of their
   job title.

3. WHAT THEY BRING THAT IS NOT ON THE LIST. Anything notable that the
   requirements did not ask about. This is worth having — the best hires
   often bring something the job description did not know to ask for.

4. WHAT IS UNCLEAR. Specific things the application does not answer that
   a first conversation would. These are interview questions, and they
   should be written as questions.

5. ANYTHING THAT NEEDS CHECKING. Gaps in dates, claims that are
   ambiguous, anything a reasonable employer would ask about. State
   these neutrally as things to ask, never as concerns or red flags.

Do not score anybody. Do not rank them. Do not recommend or advise
against interviewing anybody. Do not use words like "strong candidate",
"weak", "ideal fit" or "not suitable".

Do not comment on, infer, or mention: age, sex, gender, race,
nationality, ethnicity, religion, disability, health, marital or family
status, sexual orientation, where they live, where they went to school,
how long ago they graduated, or how their name reads. If an application
volunteers any of this, do not repeat it in the brief.

At the end, list only: how many applications arrived, and which
requirements the largest number of applicants did not address. That
second number is about the job description, not the applicants — if
nobody addresses a requirement, it is probably written unclearly.

Email everything to the connected account, subject "Applications —
[date]".

Never reply to any applicant.

--- EDIT BELOW THIS LINE ---

Everything in [square brackets] below is an example. Replace it with
your own and delete the brackets. If anything is still in brackets when
this runs, it is not a real setting — ignore it and say so at the top of
your output rather than treating the example as an instruction.

Gmail label: Applications
Job description document: [e.g. Finance Manager JD — the document name in
  Drive]
Requirements, in order of importance. Be specific and observable — "has
run payroll for 10+" can be evidenced from an application, "is a
self-starter" cannot, and asking for it produces flattery:
  1. [e.g. has run payroll for a team of 10 or more]
  2. [e.g. familiar with UK statutory reporting]
  3.
  4.
Things that genuinely do not matter for this role: [e.g. which accounting
  software they used before, whether they have a degree]
```

## Writing the requirements

Observable, not abstract. "Has run payroll for a team of more than ten" can be evidenced from an application. "Is a self-starter" cannot, and asking for it produces flattery rather than information.

Four or five requirements is right. More than that and every brief says "did not address" to half of them, which tells you nothing about anybody.

The "things that genuinely do not matter" line is worth filling in. If you do not care which software somebody used before, saying so stops the brief from noting its absence for sixty people.

## Before your first run

**Read the whole brief for at least the first ten applicants.** If you only read section 2, you have rebuilt the filter you were trying to avoid.

**It presents everybody.** No hidden bottom half. The point is that the pile becomes readable, not shorter.

**The "did not address" count is about your job advert.** If 40 of 60 people did not address requirement 3, requirement 3 is badly written. That is a genuinely useful piece of feedback and it arrives for free.

**The exclusion list is not decoration.** Applications routinely contain photographs, dates of birth, nationalities and family details, particularly from countries where that is the norm. Those must not reach the brief, and the instruction is written to stop it.

## What a good run looks like

> **4 applications yesterday.**
>
> ---
>
> **A. Okonkwo** — applied via the careers page.
>
> **1. Has run payroll for a team of 10+** — *direct.* "Ran monthly payroll for 24 staff across two entities for three years."
> **2. Familiar with UK statutory reporting** — *direct.* Names the specific filings.
> **3. Has managed an external accountant relationship** — *not addressed.*
> **4. Can work Tuesdays and Thursdays on site** — *direct.* "Happy with two days on site."
>
> **Also brings:** ran a migration between two payroll systems, which is not on your list and is the thing you are about to do.
>
> **Unclear:** whether the two entities were in the same jurisdiction. Whether they chose the new payroll system or inherited it.
>
> **To ask about:** a five-month gap between the second and third roles listed.
>
> ---
>
> **4 applications. Requirement 3 was not addressed by 3 of 4.** Worth checking how it is worded in the advert.

## When it goes wrong

**It scores people anyway.** Harden it: "Do not use any comparative or evaluative language. State only what the application says."

**The briefs are uneven in length.** Some applications are longer than others, but the headings should always be the same. Add: "Every brief has the same five headings, in the same order, even when a section is empty."

**It repeats personal details.** Strengthen the exclusion list with whatever slipped through, and put the specific field name in it.

**Attachments are not read.** Some formats do not extract cleanly. If CVs arrive as images or unusual formats, the brief will be thin — the fix is asking for a standard format in the advert, not in the routine.

**It starts inferring from job titles.** Add: "A job title is not evidence. Only quote what the application states was done."
