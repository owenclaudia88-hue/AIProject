# Start Here — What These Are and How to Use Them

Read this once. Every automation after it takes about two minutes to set up.

No coding. Nothing to install. Nothing to download.

---

## What a Routine actually is

You already know Claude as a chat window. You type, it answers, and when you close the tab nothing more happens.

A **Routine** is Claude doing a job on a timer instead — every morning, every Monday, whatever you choose. It runs on Anthropic's computers, not yours, so it works while your laptop is shut and while you are asleep.

That is the whole idea. You write the job down once. It does it forever.

**An example.** You set one up that says: *every weekday at 7am, look at yesterday's sales and post a summary to my team chat.* You close your laptop. At 7am the next morning the summary is there. You did nothing.

## What you need before you start

**A paid Claude account.** Routines are on **Claude Pro** and **Claude Max**. They are not on the free plan. If you are on free, upgrade first or none of this will work.

**Nothing else.** No GitHub, no coding, no software to install. You may see a box asking you to "Select a repository" — **ignore it**. That is for programmers. You can leave it empty and everything in this collection still works.

## How many can you run?

There is a daily limit on how many times your automations can run:

| Plan | Runs per day |
|---|---|
| Claude Pro | 5 |
| Claude Max | 15 |

This is **runs**, not automations. You can set up all of these and switch on whichever few you want running today.

A daily automation uses one run a day. One that checks three times a day uses three. Each automation in this collection tells you at the top how many it uses, so you can budget.

## Where to find Routines

**On the web**, go to:

> **claude.ai/code/routines**

Type that into your browser. Sign in if it asks.

**In the Claude desktop app**, click **Code** at the top, then **Routines** in the left sidebar. If you do not see it, click **More** in the sidebar and it is in there.

![Where Routines live in the sidebar](/assets/routines/01-where-to-find.png)

Both take you to the same place. Anything you set up in one appears in the other.

## Setting up your first one

Every automation in this collection works the same way. Here it is once, slowly.

### 1. Click "New routine"

Top right of the Routines page.

![The New routine button](/assets/routines/02-new-routine.png)

### 2. Give it a name

Use the name at the top of whichever automation you picked — for example, `Daily Business Pulse`. This is only for you, so you can find it later.

### 3. Paste the instructions

Every automation in this collection has a panel called **Instructions — paste this into Claude**, with a **Copy instructions** button.

Click that button, then paste into the big **Instructions** box.

**Copy only that panel.** Do not copy the rest of the page — the setup steps and troubleshooting notes are for you, not for Claude.

![Pasting the instructions](/assets/routines/03-paste-instructions.png)

### 4. Skip the repository

Under the Instructions box you will see **"Select a repository"**. Leave it alone. It is for programmers and you do not need it.

### 5. Choose when it runs

Under **Select a trigger**, click **Schedule**, and pick the time from the automation's **Runs** line.

Times are in your own timezone. You do not need to convert anything.

![Choosing a schedule](/assets/routines/04-schedule.png)

### 6. Choose what it can reach

Under **Connectors** you will see the apps Claude is allowed to use during the run — Gmail, Slack, Stripe and so on.

Each automation lists what it needs. **Remove everything else.** Claude can use any connector on this list without asking you first, so keep it to what the job requires.

If an app you need is not there, see *"The app I need isn't listed"* below.

![The connectors list](/assets/routines/05-connectors.png)

### 7. Click Create

Then open it and press **Run now** once.

**Do not skip this.** It runs the job immediately so you can see what it produces, before it starts doing it on a schedule at 7am when you are not watching.

## Connecting your apps

An automation that reads your sales needs permission to see them. That is what a connector is.

Go to:

> **claude.ai/customize/connectors**

Click **Browse connectors**, find the app, and sign in when it asks. You do this once per app, not once per automation.

Common ones: **Gmail**, **Google Calendar**, **Google Drive**, **Slack**, **Stripe**, **Notion**.

### The app I need isn't listed

Use **Zapier**. It connects to thousands of apps and has its own Claude connector, so anything Zapier reaches, your automations can reach.

Add the Zapier connector the same way, then build a Zap for the app you need. Each automation that might need this says so.

## How to tell it worked

Open the routine and look at its run history.

**A green tick does not mean it worked.** It means the run started and finished without crashing. The job inside it can still have done nothing at all.

This catches everybody once. **Click into the run and read what Claude actually did.** That is the only way to know.

If a run looks green but nothing arrived in your inbox or Slack, it is almost always one of two things:

1. **The connector was removed** from the routine, so Claude had no way to send anything
2. **A name is wrong** — a Slack channel that does not exist, or a document it could not find

## Two more things worth knowing

**They run as you.** A Slack message an automation sends appears from your account. An email goes from your address. Set them up on the account you want them to act as.

**Stopping one is easy.** Open the routine and use the on/off switch at the top. It keeps everything and simply stops running until you turn it back on.

---

## You're ready

Pick one. **Daily Business Pulse** is the usual first choice — it only reads, it sends nothing to your customers, and you will see the result tomorrow morning.

Set it up, press **Run now**, and read what it gives you.
