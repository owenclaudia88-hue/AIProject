/**
 * Build The Funnel Engine in the member area: its six downloads and its course.
 *
 *   node --env-file=.env.local scripts/ingest-funnel-engine.mjs "C:/Users/Coolio/Downloads/funnel-engine-source"
 *   ... add --live once it is on sale.
 *
 * Moved over from the Own Your Stack program on ai.productizedcoach.com, where
 * the same engine is sold. Everything here is gated on the `funnel-engine`
 * entitlement, which only buying it grants - the membership never lends it
 * (see FUNNEL_ENGINE in lib/products.js). So:
 *
 *   - the files are private blobs served only through /api/content/download,
 *     and the downloads shelf does not list them to anybody who has not bought;
 *   - the course is visible to every member once live, locked unless bought.
 *
 * Until --live the course row is testers-only: a locked card for something not
 * on sale yet is an announcement nobody meant to make.
 *
 * The lesson videos are in Bunny (scripts/upload-funnel-engine-videos.mjs) and
 * their ids come from the map that script writes. Their lengths and shapes are
 * read back from Bunny here, so the player draws the right frame.
 *
 * The text lessons are the Own Your Stack ones, with The Lounge pointed at
 * this community's "Ask for help" and their support at ours. Re-runnable:
 * everything upserts by key or id.
 */
import { put } from '@vercel/blob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { upsertContent, upsertLibraryItem, upsertCourse } from '../lib/db.js';
import { FUNNEL_ENGINE } from '../lib/products.js';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: ingest-funnel-engine.mjs <folder with the six files> [--live]'); process.exit(1); }
for (const k of ['BLOB_READ_WRITE_TOKEN', 'BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} is not set in .env.local`); process.exit(1); }
}

const SLUG = 'the-funnel-engine';
const KIND = 'funnelengine';
const TESTERS_ONLY = !process.argv.includes('--live');
const SUPPORT = 'support@aifounderuniversity.com';

/* ---------------- the six files ---------------- */

const FILES = [
  { file: 'funnel-engine.zip', title: 'The Funnel Engine', type: 'application/zip',
    description: 'The ready-made code that runs your own sales funnel: sales page, checkout, bumps, upsells, buyer emails and a sales dashboard. Unzip it to get your my-business folder.' },
  { file: 'quick-start-skill.zip', title: 'The Quick Start skill', type: 'application/zip',
    description: 'A Claude skill that installs the engine with you, one step at a time, and publishes your funnel on your own Cloudflare account.' },
  { file: 'integrate-skill.zip', title: 'The /Integrate skill', type: 'application/zip',
    description: 'Connects your live funnel to the email tool and course you already use, writes your emails in your voice and proves it with a test sale.' },
  { file: '80-20-sheet.md', title: 'The Claude Code & Codex 80/20 Sheet', type: 'text/markdown',
    description: 'The handful of moves that do most of the work in Claude Code and Codex, on one page.' },
  { file: '10-90-launch-brief.md', title: 'The 10/90 Launch Brief', type: 'text/markdown',
    description: 'The one page you fill in before every launch, so Claude builds the offer you meant.' },
  { file: 'claude-from-your-phone.md', title: 'Claude From Your Phone', type: 'text/markdown',
    description: 'Set up once, then build and fix your pages from your phone.' }
];

const COURSE_ONLY = process.argv.includes('--course-only');

/* A dropped connection is waited out, three times. The first build lost the
   database twice on a shaky line; everything below is an upsert, so trying
   one again is safe. */
const retry = async (what, fn) => {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (err) {
      if (attempt >= 3) throw err;
      console.log(`    ${what}: ${err.message.slice(0, 80)}, trying again (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 10000 * attempt));
    }
  }
};

const keyOf = (file) => `${KIND}/${file}`;
const dl = (file, label) =>
  `<p><a href="/api/content/download?key=${encodeURIComponent(keyOf(file))}"><strong>⬇ ${label}</strong></a></p>`;

// --course-only rebuilds the lessons without uploading the files again: each
// upload is a new blob, so a second one leaves the first behind unused.
let sort = 0;
for (const f of COURSE_ONLY ? [] : FILES) {
  const full = path.join(SRC, f.file);
  const body = await readFile(full);
  const size = (await stat(full)).size;
  const { url } = await put(`content/${keyOf(f.file)}`, body, {
    access: 'private', addRandomSuffix: true, contentType: f.type,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  await upsertContent({
    key: keyOf(f.file), title: f.title, kind: KIND, filename: f.file,
    blobUrl: url, sizeBytes: size, sort: sort++, requires: FUNNEL_ENGINE, description: f.description
  });
  console.log(`  + file  ${(size / 1024).toFixed(0).padStart(5)} KB  ${keyOf(f.file)}`);
}

/* ---------------- the videos, as Bunny has them ---------------- */

const bunnyMap = JSON.parse(await readFile(path.resolve('Claude outputs/funnel-engine/bunny-videos.json'), 'utf8'));
const bunny = async (guid) => {
  const r = await retry(`Bunny ${guid}`, () => fetch(`https://video.bunnycdn.com/library/${process.env.BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`,
    { headers: { AccessKey: process.env.BUNNY_STREAM_API_KEY, accept: 'application/json' } }));
  if (!r.ok) throw new Error(`Bunny ${guid}: ${r.status}`);
  return r.json();
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/* ---------------- the lessons ---------------- */

const P = (s) => `<p>${s}</p>`;
const H2 = (s) => `<h2>${s}</h2>`;
const UL = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const OL = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const NOTE = (s) => `<p><em>${s}</em></p>`;
/* The parts of a video lesson, the same ones Own Your Stack has under each
   video: a line under the title, the moments to jump to, the highlights, what
   the lesson is for, any prompt to copy, the next step and the call's questions.
   The member area styles them (.ls-*), adds a Copy button to every prompt and
   seeks the video when a moment is clicked. */
const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LEAD = (t) => `<p class="ls-lead">${t}</p>`;
const MOMENTS = (list) => `<div class="ls-box"><p class="ls-k">Jump to a moment</p><ol class="ls-moments">${list.map(([t, label]) => {
  const [m, sec] = t.split(':').map(Number);
  return `<li><a href="#" data-seek="${m * 60 + sec}"><b>${t}</b>${label}</a></li>`;
}).join('')}</ol></div>`;
const HIGH = (items) => `<div class="ls-box"><p class="ls-k">Highlights</p><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
const INTRO = (t) => `<p class="ls-k">In this lesson</p><p>${t}</p>`;
const PROMPT = (t) => `<pre class="ls-prompt"><code>${escHtml(t)}</code></pre>`;
const NEXT = (items) => `<h2>Your next step</h2><ol class="ls-steps">${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const QA = (list) => `<h2>Questions from the call</h2>${list.map(([q, a]) => `<details class="ls-qa"><summary>${q}</summary><p>${a}</p></details>`).join('')}`;

const HELP = 'Ask in the community, under <a href="#c-help"><strong>Ask for help</strong></a> in your menu';

/* A link to another lesson of this course, by its number in the order below
   (Start Here is 1). The member area opens it in the player: #lesson-<course>/<id>. */
const LESSON = { startHere: 1, engine: 2, quickStart: 3, integrate: 4, brief: 6, mortals: 8, bypass: 13, replay: 19, installEngine: 20, tenNinety: 22 };
const A = (n, text) => `<a href="#lesson-${SLUG}/lesson:funnel-engine-${String(n).padStart(2, '0')}">${text}</a>`;

const sections = [
  {
    name: 'START · Start Here', label: 'Start Here',
    lessons: [{
      title: 'Start Here', minutes: 3,
      body: [
        P("You're in. The live call was on October 13, and all of it is here for you to watch."),
        H2('Watch Claude Code for Mortals first'),
        P(`${A(LESSON.mortals, 'Start with the first lesson')}. It's Part 1 of the call, re-recorded as short lessons: you set up Claude Code and plug in your tools.`),
        H2('Then watch The Replay'),
        P(`${A(LESSON.replay, 'Open The Replay')}. It's the rest of the call, in five parts.`),
        H2('Install your engine'),
        OL([
          `${A(LESSON.engine, 'Download Your Funnel Engine')} and save the zip.`,
          `${A(LESSON.quickStart, 'Download the Quick Start skill')} and add it to Claude.`,
          'Tell Claude to set up your engine with you.',
          `${A(LESSON.integrate, 'Download and set up the /Integrate skill')}. Run it after your funnel is live.`
        ]),
        P(`Stuck? Stop there. ${HELP}.`),
        H2('Have these ready'),
        UL(['A paid Claude plan', 'A free Stripe account', 'A domain', 'A Cloudflare account']),
        H2('Ask your questions in the community'),
        P('Other members and our team answer there.'),
        OL(['Tap <a href="#c-help"><strong>Ask for help</strong></a> in your menu.', 'Post your question.']),
        NOTE(`Can't find something? Email ${SUPPORT} and a person answers.`)
      ]
    }]
  },
  {
    name: 'ENGINE · Your Engine', label: 'Your Engine',
    lessons: [
      {
        title: 'Download Your Funnel Engine', minutes: 2,
        body: [
          dl('funnel-engine.zip', 'Download the Funnel Engine (zip)'),
          P("This is your Funnel Engine. It's yours to keep."),
          H2('Save the zip'),
          OL(['Tap the download button above.', "Save the zip where you'll find it again.", 'Unzip it. You get a folder called <strong>my-business</strong>.']),
          H2('Set it up'),
          P(`${A(LESSON.quickStart, 'Download the Quick Start skill')} next. Claude sets up the engine with you, one step at a time.`),
          P(`Then ${A(LESSON.integrate, 'download and set up the /Integrate skill')}. It connects your email tool and your course after your funnel is live.`),
          P('Both skill lessons have a zip download. You can save both now. Run Quick Start first.'),
          NOTE(`Rather watch first? Open ${A(LESSON.installEngine, '<strong>Install the Funnel Engine</strong>')} in The Replay. Nothing saved? Tap the button again, then look in your Downloads folder.`)
        ]
      },
      {
        title: 'The Quick Start Skill', minutes: 3,
        body: [
          dl('quick-start-skill.zip', 'Download the Quick Start skill (zip)'),
          P('This skill sets up your engine with you. Claude does the work. You answer its questions.'),
          H2('Add the skill to Claude'),
          OL(['Tap the download button above.', 'Add the skill to Claude.', 'Tell Claude: <strong>"Set up my Funnel Engine."</strong>']),
          H2('Answer what it asks'),
          P(`Claude asks for one thing at a time. Have your Stripe, Cloudflare and domain logins close by. Get stuck? Stop there. ${HELP}.`),
          H2('Connect your tools after you\'re live'),
          P(`${A(LESSON.integrate, 'Download and set up the /Integrate skill')}. It connects your email tool and your course.`),
          NOTE('Claude didn\'t start the setup? Say it again: "Use the Quick Start skill to set up my Funnel Engine."')
        ]
      },
      {
        title: 'The /Integrate Skill', minutes: 6,
        body: [
          dl('integrate-skill.zip', 'Download the /Integrate skill (zip)'),
          P('This skill connects your funnel to the tools you already use. You keep them. Claude does the setup for you while you watch.'),
          H2('Finish the Quick Start first'),
          P(`/Integrate needs a live funnel. Run the ${A(LESSON.quickStart, 'Quick Start skill')} until Claude says you're live, then come back here.`),
          H2('Add the skill to Claude'),
          P('Same way as the Quick Start skill.'),
          OL([
            'Tap the download button above.',
            'Unzip it into Claude\'s skills folder. You want a folder called <strong>integrate</strong> with a SKILL.md file inside.<br>Windows: <code>C:\\Users\\&lt;your name&gt;\\.claude\\skills\\integrate</code><br>Mac: your home folder, then <code>.claude/skills/integrate</code>. In Finder, press Command, Shift and the period key to see the hidden .claude folder.',
            'Open the Claude app. Click the Code tab. Pick your my-business folder.',
            'Type <strong>/integrate</strong>. Answer one question at a time.'
          ]),
          H2('What it does'),
          UL([
            'Connects your funnel to the email tool and course you already use.',
            'Writes every email in your voice, then puts them in your tool for you.',
            'Proves it with a test signup and a test purchase. You watch the first email land.'
          ]),
          P('The test purchase is on your own card. You refund it after.'),
          H2('What Claude builds, and what you click'),
          P('GoHighLevel, Kit, MailerLite, ActiveCampaign, Mailchimp and Systeme.io connect straight to your funnel. No Zapier. Every sale and every signup lands in your tool with the right tag.'),
          P('A tag is a label on a contact. An automation is the rule that sends your emails. Each tool calls it something else, like a workflow, a rule or a flow.'),
          P('Claude adds whatever your tool lets it add directly. Then it clicks the rest in for you, in your own Chrome, while you watch.'),
          `<table><thead><tr><th>Your tool</th><th>Claude adds it directly</th><th>Claude clicks it in for you</th></tr></thead><tbody>
            <tr><td>Systeme.io</td><td>Tags, every email, and the rules</td><td>A check of what it built</td></tr>
            <tr><td>Kit</td><td>Tags, sequences and their emails</td><td>The rule that starts each sequence</td></tr>
            <tr><td>GoHighLevel</td><td>Tags, and every email as a template</td><td>The workflow</td></tr>
            <tr><td>MailerLite</td><td>Groups</td><td>The automation and its emails</td></tr>
            <tr><td>ActiveCampaign</td><td>Tags</td><td>The automation</td></tr>
            <tr><td>Mailchimp</td><td>Tags</td><td>The flow</td></tr></tbody></table>`,
          P('Systeme.io gets the most done for you.'),
          UL([
            'Kajabi on the Growth or Pro plan? Your funnel opens your course the moment someone pays. No Zapier. Your emails come from the funnel or your other email tool.',
            'No email tool? The funnel sends your emails itself. Claude writes every one and puts them in.'
          ]),
          H2('Let Claude click for you in Chrome'),
          P('Claude in Chrome is Anthropic\'s extension for the Chrome browser. It lets Claude click and type in your own Chrome while you watch.'),
          P('You need:'),
          UL(['Chrome on a computer', 'A paid Claude plan', 'The Claude in Chrome extension. Claude offers to add it the first time it needs your browser.']),
          P('You can say stop any time. Rather click yourself? Claude walks you through each click. Can\'t connect it? Claude writes the steps for you to paste into the extension\'s side panel.'),
          H2('What only you do'),
          UL([
            'Log in. Claude never types a password.',
            'Make your keys. Paste them into your own Cloudflare account, in a window of your own.',
            'Copy any webhook address the same way. That\'s a private link a tool gives you, so your funnel can send it each sale.',
            'Pay for anything. Claude never touches your billing.',
            'Say yes. Nothing switches on until you do.'
          ]),
          P('Your keys never go in the chat. Claude tells you where to paste them.'),
          H2('When you still need a paid Zapier plan'),
          P('Zapier is an app that passes each sale from your funnel to your tool. <strong>You only need a paid Zapier plan in three cases.</strong>'),
          UL([
            'ClickFunnels 2.0. It connects through Zapier. On its Scale plan and up, Claude also builds your ClickFunnels workflow directly.',
            'Kajabi on the Basic or Kickstarter plan, to open your course for each buyer.',
            'Sending your follow-ups from inside Kajabi.'
          ]),
          H2('Check your plan first'),
          P('Some free plans can\'t send a follow-up sequence at all. That\'s Kit and Mailchimp. A sequence is a set of emails sent over a few days.'),
          P('MailerLite and Systeme.io have tight caps on their free plans. Claude tells you before it writes a word.'),
          NOTE('Claude didn\'t start? Say: "Use the /Integrate skill to connect my funnel."')
        ]
      }
    ]
  },
  {
    name: 'BONUSES · Your Bonuses', label: 'Your Bonuses',
    lessons: [
      {
        title: 'Bonus: The Claude Code & Codex 80/20 Sheet', minutes: 2,
        body: [
          dl('80-20-sheet.md', 'Download the 80/20 Sheet'),
          P('The handful of moves that do most of the work in Claude Code and Codex, all on one page.'),
          P('Claude Code is the Code tab in the Claude desktop app. Codex is the same kind of helper inside the ChatGPT app.'),
          H2('Use it like this'),
          OL(['Tap the download button above.', 'Keep it open next to Claude Code or Codex.', 'Pick one move. Follow its "Do this" line, then paste its "Say this" line into your chat.']),
          P('Start with move 1. Claude Code and Codex work in the folder you open. Your funnel\'s folder is my-business.'),
          NOTE(`Your screen doesn't match the sheet? Send Claude a screenshot. Still stuck? ${HELP}.`)
        ]
      },
      {
        title: 'Bonus: The 10/90 Launch Brief', minutes: 2,
        body: [
          dl('10-90-launch-brief.md', 'Download the 10/90 Launch Brief'),
          P('Fill in this one page before every launch, and Claude builds it right the first time.'),
          H2('Use it like this'),
          OL(['Tap the download button above.', "Fill it in. That's your 10%.", "Hand it to Claude. That's the other 90%."]),
          P('"Build me an offer" gets you junk. This page gets you the offer you meant.'),
          P('Have your <a href="#roadmap"><strong>AI Roadmap</strong></a>? It already names your offer, your buyer and your goal, so most of the brief is done. Copy it across.'),
          NOTE(`Stuck on a box? Watch ${A(LESSON.tenNinety, '<strong>The 10/90 and the Install Offer</strong>')} in The Replay. Still stuck? Leave it blank and ${HELP.charAt(0).toLowerCase() + HELP.slice(1)}.`)
        ]
      },
      {
        title: 'Bonus: Claude From Your Phone', minutes: 2,
        body: [
          dl('claude-from-your-phone.md', 'Download Claude From Your Phone'),
          P('Build and fix your pages from your phone. No laptop needed.'),
          H2('Set it up once'),
          OL(['Tap the download button above.', 'Follow the steps on your phone.', 'Try one small change, like a new headline.']),
          P('Once that works, you can fix a page from anywhere.'),
          NOTE(`Didn't work? Watch ${A(LESSON.bypass, '<strong>Bypass Permissions and Remote Control</strong>')} in Claude Code for Mortals. Still stuck? ${HELP}.`)
        ]
      }
    ]
  },
  {
    name: 'CLAUDE CODE · Claude Code for Mortals', label: 'Claude Code for Mortals',
    video: [
      { slug: 'oys-cc-tony-stark', body: [
        LEAD('The one idea that makes the rest of this click.'),
        HIGH([
          'You\'re Tony Stark. Claude is Jarvis. You say what you want, and Claude does the work.',
          'The old way, you log in, drag and drop, and wire it all up yourself. And you still pay every month.',
          'The new way, you don\'t log into anything. You ask Claude.',
          'Your pages live on Cloudflare. Claude goes in there and builds them for you.',
          'Want something changed? Ask Claude from your phone or your computer.'
        ]),
        INTRO('Watch this one first. It makes everything after it click.'),
        NEXT(['Think of one job you do by hand every week. Write it down. You\'ll hand it to Claude soon.'])
      ] },
      { slug: 'oys-cc-code-vs-chat', body: [
        LEAD('Why you do all your work in the Code tab from now on.'),
        HIGH([
          'Claude Chat has fewer tools. It stops, says "I can\'t do that," and waits for you.',
          'Claude Code runs on its own. It makes the files, clicks the buttons and publishes.',
          'Ask it for your ads, and it can also make the images, publish them and update your page.',
          'You need the Claude desktop app. This doesn\'t work in your browser.',
          'On ChatGPT? Use Codex. It\'s the same idea.'
        ]),
        INTRO('Same app, same plan. The Code tab just does a lot more.'),
        NEXT(['Download the Claude desktop app. Open it and click <strong>Code</strong>, top left.'])
      ] },
      { slug: 'oys-cc-setup', body: [
        LEAD('One business, one folder. Set it up once.'),
        HIGH([
          'The app calls your business folder an environment. You pick it when you start a chat.',
          'One business gets one environment. Your web app, ads and emails all live in it.',
          'Got clients? Keep one environment. Give each client a section in the sidebar.',
          'A section is just a label in your sidebar. Claude can set them up for you.',
          'Like it simple? Skip sections. Pin the chat you\'re working on.'
        ]),
        INTRO('One business, one folder. Set it up once, and every chat stays tidy.'),
        H2('Copy these prompts'),
        P('Paste this once, in your business folder:'),
        PROMPT(`This folder is my business. Set it up so every future chat keeps it tidy.
If this is my Funnel Engine folder (my-business), stop and tell me to open a different folder.
Otherwise, create a CLAUDE.md file here (AGENTS.md if you're Codex) with these house rules:
1. Every project gets its own folder in here, with a plain name like "quiz-app", "emails" or "videos". No loose files at the top.
2. Before you make anything new, check the folders already here. Use the one that fits. Only make a new folder when nothing fits.
3. Keep one current copy of each file and edit it in place. No "v2" or "final" copies. Before a big rewrite, move the old copy into an "old" folder inside that project.
4. When you make a new folder, add one line about it to the Folder Map at the bottom of this file.
5. If my-business is in here, follow its own rules inside it, and never edit its CLAUDE.md or AGENTS.md.
End the file with a Folder Map of what's here now. Don't make any other folders yet.`),
        P('Then teach it your business:'),
        PROMPT('Interview me one question at a time about my business, my offer, my buyers and how I talk. Save what you learn in this folder so you never have to ask again.'),
        NEXT([
          'Make a folder for your business.',
          'In the Code tab, open the environment menu and pick <strong>New environment</strong>. Add your folder, then click <strong>Create environment</strong>.',
          'Paste the first prompt above.'
        ])
      ] },
      { slug: 'oys-cc-skills', body: [
        LEAD('Do it twice? Make it a skill.'),
        HIGH([
          'Do a job more than twice? Make it a skill. Then it\'s a / command.',
          'Don\'t build skills ahead of time. Do the job once, the way you like it.',
          'Happy with the result? Ask Claude to turn it into a skill.',
          'Bought a skill? Ask Claude to mix it with your own templates and voice.',
          'Type / to find your skills. Or ask Claude to run one by name.'
        ]),
        INTRO('A skill is just how you like a job done. Claude follows it every time.'),
        H2('Copy this prompt'),
        P('Paste this right after a job comes out the way you like:'),
        PROMPT('Turn what we just did into a skill, so next time I just type /[name] and you do it my way.'),
        NEXT(['Pick a job you did twice this week. Do it once more with Claude. Then paste the prompt above.'])
      ] },
      { slug: 'oys-cc-models', body: [
        LEAD('How hard to let Claude think, and how to tell news from noise.'),
        HIGH([
          'More reasoning makes the model smarter. It also costs more.',
          'Turn reasoning up to make a plan. Turn it down to medium to do the work.',
          'On a cheaper model like Sonnet, keep the effort on medium.',
          'Hear about a new model? Check its intelligence score on a benchmark site first.',
          'Claude and ChatGPT are all you need.'
        ]),
        INTRO('How smart to make Claude, and how to tell real news from hype.'),
        NEXT(['Open the model menu by the chat box. Set the effort to medium for your next job.'])
      ] },
      { slug: 'oys-cc-bypass-remote', body: [
        LEAD('Stop clicking approve. Then run Claude from your phone.'),
        HIGH([
          'Do all your work in Claude Code. On ChatGPT, use Codex.',
          'Use <strong>Bypass permissions</strong> mode. Then Claude stops asking you to approve every step.',
          'Skip Plan mode. Claude makes a plan anyway, and Plan mode burns credits.',
          'In Codex, turn on <strong>Full access</strong>.',
          'Turn on <strong>Remote Control</strong>. Then you can pick up the same chat on your phone.',
          'Your computer has to stay on. A laptop on a stand or a small $500 PC works.',
          'Codex is easier for starting new work from your phone.'
        ]),
        INTRO('Two settings that let Claude work while you get on with your day.'),
        NEXT(['Turn on bypass permissions in settings. Then pick <strong>Bypass permissions</strong> in the mode menu by the chat box.'])
      ] },
      { slug: 'oys-cc-settings', body: [
        LEAD('The settings we turn on in Claude and Codex.'),
        HIGH([
          'Turn on the browser tools and the Chrome extension.',
          'Ask for an unrelated task? Have Claude start a new session for it.',
          'Archive old sessions after seven days. Claude can still read them.',
          'Pick an output style. Want plain words? Ask Claude to make you one.',
          'Block any site with private details, like your bank.',
          'In Codex, turn on full access and the higher reasoning levels.',
          'Something won\'t work? Ask Claude which setting to turn on.'
        ]),
        INTRO('A tour of our settings in Claude and Codex. Copy what fits you.'),
        NEXT(['Open your settings. Click through each page and turn on what you need.'])
      ] },
      { slug: 'oys-cc-browser', body: [
        LEAD('If you can do it on a computer, Claude can do it.'),
        HIGH([
          'Turn on the Chrome extension and computer use. Then Claude and Codex can drive your browser.',
          'Codex has its own browser. Sign in to your sites there once.',
          'Need your real Chrome? Open the site, then tell it to take control of your Chrome.',
          'Claude edited this whole course: the cuts, the captions and the upload.',
          'It can set up automations in GoHighLevel or Kajabi, answer emails and send DMs.'
        ]),
        INTRO('If you can click it, Claude can click it.'),
        NEXT(['Open a tool you use every week in Chrome. Ask Claude: "Take control of my Chrome and show me where my settings are. Change nothing."'])
      ] },
      { slug: 'oys-cc-codex-claude', body: [
        LEAD('Shared memory, and a second opinion from another AI.'),
        HIGH([
          'Memory lives in files in your business folder. Claude and Codex can both read them.',
          'Claude can call Codex for you. Just ask.',
          'Use Codex to make images without leaving Claude.',
          'Have an idea? Ask Claude to have Codex poke holes in it.',
          'One second opinion is enough. Don\'t let them go back and forth forever.'
        ]),
        INTRO('Use both, and let them check each other\'s work.'),
        NEXT(['With Codex installed, ask Claude: "Call Codex and ask it to check my plan for holes."'])
      ] },
      { slug: 'oys-cc-team-member', body: [
        LEAD('Why we\'d rather pay Claude than any funnel software.'),
        HIGH([
          'We used to pay $1,500 a month for funnel design. Claude does it better and faster.',
          'Start on the $20 plan. Upgrade when it saves you more time than it costs.',
          'Would the $100 plan save you five hours a month? Then it pays for itself.',
          'AI doesn\'t replace good people. It lets a small team do more.',
          'We\'d rather pay Claude than GoHighLevel or ClickFunnels.'
        ]),
        INTRO('Stop comparing Claude to software. Compare it to hiring help.'),
        NEXT(['Write down what one hour of your time is worth. Then pick the plan that buys back the most hours.'])
      ] },
      { slug: 'oys-cc-plug-in', body: [
        LEAD('Make your accounts, add the plugins, then let Claude check each one.'),
        HIGH([
          'Make a free account on Cloudflare, Convex, Stripe and GitHub. Do it today.',
          'New to Stripe? It can take a few days to approve you. Start now.',
          'A plugin lets Claude run your other apps. You never open the app. You just ask.',
          'Add one in Claude: <strong>Customize</strong>, then <strong>Plugins</strong>. Search for it, then click <strong>Add</strong>.',
          'No plugin for a tool? Look under <strong>Connectors</strong> instead.',
          'Stuck? Ask Claude to walk you through it.'
        ]),
        INTRO('Claude can only do the work if it can reach your tools. Here\'s how you plug them in.'),
        H2('Copy this prompt'),
        P('Made your accounts? Paste this into Claude Code. It checks each tool and walks you through the rest, one step at a time. It works in Codex too.'),
        PROMPT(`Help me connect you to the tools my Funnel Engine uses: Cloudflare, Stripe, Convex and GitHub. I already made an account on each one.
Go one tool at a time, in that order. For each one:
1. Check if you can already reach it. If you can, tell me and move on.
2. If you can't, tell me exactly where to click in this app to add its plugin or connector. One click at a time. Wait for me to say done.
3. For GitHub, pick a way that signs me in through my browser, not a token.
4. If it needs me to sign in, I'll do that in my browser. Never ask me for a password, an API key or a card number. Never ask me to paste one here.
5. Prove it works with one look-only check, like "what's my Cloudflare account name?" Change nothing. If you can't check one yet, say why and move on.
When you're done, show me a short list: what's connected, and what's still missing.`),
        NEXT(['Make your four accounts.', 'Add the Cloudflare and Stripe plugins.', 'Paste the prompt above.'])
      ] }
    ]
  },
  {
    name: 'REPLAY · The Replay', label: 'The Replay',
    video: [
      { slug: 'oys-replay-new-way', body: [
        LEAD('Why we launch every offer with Claude now, starting with one live prompt.'),
        MOMENTS([['0:00', 'Why this workshop'], ['1:53', 'One prompt builds a new page'], ['3:57', 'The blue pill or the red pill'],
          ['5:30', 'Tech trauma, and what changes'], ['6:31', 'Two coaches we work with'], ['7:36', 'The deal on the call'],
          ['9:10', 'Claude builds it, you own it'], ['10:35', 'Who we are, and the bigger picture'], ['13:04', 'Where AI is right now']]),
        HIGH([
          'You tell Claude what to do. Claude does the work. You check it and ask for changes.',
          'Treat Claude like a team member, not like software.',
          'Tech trauma is real. Claude builds it, and you own it.',
          'The funnel code you got ran almost $80,000 in sales in September.',
          'The models get smarter and cheaper every few months. A $20 plan is enough to start.'
        ]),
        INTRO('This is where the call starts. Claude gets one prompt to build a new page. Then you see why this is how we launch now.'),
        NEXT(['Open Claude and ask it for one small page for your offer. Don\'t polish it. Just see what comes back.'])
      ] },
      { slug: 'oys-replay-install-engine', body: [
        LEAD('Stop renting your pages. What the engine is, what it costs and how to set it up.'),
        MOMENTS([['0:00', 'Stop renting software built for humans'], ['1:42', 'Video hosting for almost nothing'], ['3:53', 'What the whole stack costs'],
          ['6:13', 'What the Funnel Engine is'], ['8:35', 'Test any idea fast'], ['9:35', 'Upsells that discount what they bought'],
          ['12:12', 'Design it with Claude, ship it live'], ['14:49', 'Keep it or cancel it'], ['15:55', 'A coaching platform, not a community'],
          ['16:56', 'Connect the tools you love'], ['18:12', 'What to set up before you install'], ['19:50', 'When something breaks'],
          ['20:19', 'What the engine replaces'], ['23:25', 'Is the course builder separate?'], ['25:09', 'Principles here, steps in the course'],
          ['27:12', 'The split test page, built from one prompt'], ['28:32', 'Pick your poison']]),
        HIGH([
          'A lot of software is a developer tool with a human screen and a big markup.',
          'Mux hosts video free until 100,000 watch minutes a month. A whole stack like this runs about $130 a month.',
          'The Funnel Engine is code you own. Hand it to Claude and say "set this up."',
          'Before you install, set up Cloudflare, Convex, Stripe and Mux. Point your domain at Cloudflare.',
          'Small change? Just tell Claude. Whole new look? Pull the page into Claude Design first.',
          'Love a tool? Keep it and connect it. Don\'t love it? Cancel it.'
        ]),
        INTRO('Why we stopped renting our pages, and how the Funnel Engine works.'),
        NEXT([
          'Make your Cloudflare, Convex, Stripe and Mux accounts.',
          `Open ${A(LESSON.engine, '<strong>Download Your Funnel Engine</strong>')} in this course and save the zip.`,
          'Open it in Claude and say: "Set up my funnel engine and build me a simple page."'
        ])
      ] },
      { slug: 'oys-replay-pages-live', body: [
        LEAD('Your pages live on Cloudflare. Claude is your Jarvis.'),
        MOMENTS([['0:00', 'Where does the page live?'], ['1:50', 'The middleman, on a whiteboard'], ['5:34', 'You\'re Tony Stark, Claude is Jarvis'],
          ['6:43', 'Cloudflare is the land'], ['9:05', 'Finding every page you\'ve built'], ['11:24', 'Moving pages over with the browser'],
          ['13:48', 'Dashboards for your numbers'], ['17:22', 'Pick your battle'], ['18:36', 'Countdowns without another tool']]),
        HIGH([
          'ClickFunnels and Systeme put your page on hosting like Cloudflare. You skip the middleman.',
          'You\'re Tony Stark. Claude is Jarvis. You say what you want, and it does the work.',
          'Can\'t find a page? Ask Claude for a list of every page you have live.',
          'Want your numbers? Ask Claude for a dashboard. The engine already has one.',
          'You can learn the tool, hire someone, or let Claude do it. Pick your battle.'
        ]),
        INTRO('The question that made it click on the call: where does the page actually live?'),
        NEXT(['Ask Claude: "Give me a list of every page I have live, with its link."']),
        QA([
          ['Where does the page live?', 'On Cloudflare. You don\'t have to log in there. Ask Claude.'],
          ['So the engine is like Jarvis?', 'That\'s it. You direct it, and Claude builds it.'],
          ['How do I find my old pages?', 'Ask Claude for every page you\'ve put live. It pulls the list.']
        ])
      ] },
      { slug: 'oys-replay-ten-ninety', body: [
        LEAD('You write the 10% that sells. Claude does the other 90%.'),
        MOMENTS([['0:00', 'The 10/90 formula'], ['2:24', 'Write your headline by hand'], ['2:49', 'Nail the mechanism'],
          ['4:49', 'Give Claude the right amount'], ['6:06', 'Less research, better pages'], ['6:42', 'Go back and forth'],
          ['6:50', 'Show, don\'t tell'], ['8:32', 'Do it yourself, or have it installed']]),
        HIGH([
          'You do the core 10%: the headline, the North Star Promise, the offer, the mechanism and the page outline.',
          'Write your headlines by hand. The ones AI writes come out weak.',
          'Your mechanism says why everything else failed, and why this works.',
          'Less research makes better pages. Give Claude the few things that matter.',
          'Don\'t try to get the page in one shot. Go back and forth.',
          'Show, don\'t tell. Claude can draw how your offer works.'
        ]),
        INTRO(`How we write an offer now, then the offer made on the call. Your ${A(LESSON.brief, '10/90 Launch Brief')} is the one page to fill in.`),
        NEXT(['Write your headline and your mechanism by hand. Give them to Claude with your offer. Ask it for a page outline.'])
      ] },
      { slug: 'oys-replay-qa', body: [
        LEAD('Premium offers, quiz funnels, client accounts, new niches and ad budgets.'),
        MOMENTS([['0:00', 'A premium offer instead?'], ['7:14', 'The quiet buyers in your market'], ['8:40', 'Does the install cover the back end?'],
          ['12:07', 'Quiz funnels and scorecards'], ['15:29', 'Building for clients'], ['17:20', 'Starting a new brand'],
          ['21:18', 'Not technical?'], ['22:46', 'Keeping GoHighLevel'], ['24:09', 'Where Edward fits'],
          ['25:58', 'Organizing your chats'], ['28:59', 'Let Claude sort your chats'], ['32:43', 'Ads, pixels and new domains'],
          ['36:34', 'The buyer math'], ['39:41', 'One funnel away'], ['43:48', 'Where to start in the course'],
          ['44:37', 'Which language and market'], ['48:50', 'How much to spend testing ads'], ['50:47', 'How fast the install turns around']]),
        HIGH([
          'Cheap offers alone make a hard business. Add one that pays you more per client.',
          'Skip quiz and webinar funnels until you spend big on ads. Go from the ad straight to the offer.',
          'Building for a client? Get access to their Cloudflare and build in their account.',
          'Starting a new niche? Run a paid live workshop first.',
          'A new domain is fine. Your pixel works on any domain.',
          'Clients you want each month, divided by 0.3, is about how many buyers you need.'
        ]),
        INTRO('Your questions, answered live. Find yours below, or jump to it in the video.'),
        NEXT(['Pick the question below that\'s closest to yours. Then ask your AI how it fits your offer.']),
        QA([
          ['Does it have to be a micro offer?', 'No. If you already sell well up front, build the premium offer next.'],
          ['What about quiz funnels?', 'Only when you spend a lot on ads. Fewer steps show you what\'s broken.'],
          ['Do I need a Claude account for each client?', 'No. Get access to their Cloudflare account and build there.'],
          ['I\'m starting a new brand. Where do I start?', 'A paid live workshop in the new niche.'],
          ['I\'m not technical. Will this work for me?', 'If you can download Claude, you\'ll be fine.'],
          ['Can I keep GoHighLevel?', 'Yes. Claude connects what you build to it, right in your browser.'],
          ['Where does Edward fit?', 'Build the page. Then give Edward the link to make and launch the ads.'],
          ['How do I keep my chats organized?', 'Any way you like. One messy folder works, with what you\'re working on pinned.'],
          ['Does a new domain need a new pixel?', 'No. Your pixel carries over to any domain.'],
          ['Which language should I start in?', 'Your own. Target people who speak it anywhere in the world.'],
          ['How much should I spend on ads?', 'Test with $150. Budget $300 to $450 for up to three tests.']
        ])
      ] }
    ]
  }
];

/* ---------------- write it ---------------- */

let n = 0, seconds = 0, order = 0;
const tree = { title: 'The Funnel Engine', sections: [], stats: null };

for (const sec of sections) {
  const lessons = [];
  const items = sec.video
    ? await Promise.all(sec.video.map(async ({ slug, body }) => {
        const m = bunnyMap[slug];
        if (!m) throw new Error(`no Bunny video for ${slug} - finish the upload first`);
        const v = await bunny(m.guid);
        return { title: m.title, guid: m.guid, length: v.length || 0, width: v.width, height: v.height, body };
      }))
    : sec.lessons;

  for (const l of items) {
    n += 1;
    const num = String(n).padStart(2, '0');
    const libId = `lesson:funnel-engine-${num}`;
    await retry(libId, () => upsertLibraryItem({
      id: libId, kind: 'lesson', course: SLUG, category: sec.label, title: l.title, description: null,
      // A video lesson carries its notes under the video, as Own Your Stack's do.
      bodyHtml: l.body ? l.body.join('') : null,
      sort: order, requires: FUNNEL_ENGINE, testersOnly: TESTERS_ONLY
    }));
    order++;
    const entry = { libId, lessonId: `fe-${num}`, title: l.title };
    if (l.guid) {
      entry.videoId = l.guid;
      entry.duration = mmss(l.length);
      entry.aspect = l.width && l.height ? Number((l.width / l.height).toFixed(4)) : 1.7778;
      seconds += l.length;
    } else {
      seconds += (l.minutes || 0) * 60;
    }
    lessons.push(entry);
    console.log(`  + ${libId}  ${l.guid ? `[${entry.duration}]` : '[text]'}  ${l.title}`);
  }
  tree.sections.push({ name: sec.name, label: sec.label, lessons });
}

tree.stats = { lessons: n, minutes: Math.round(seconds / 60), sections: sections.length };

await retry('course', () => upsertCourse({
  slug: SLUG, title: 'The Funnel Engine', lessonCount: n, sort: 6,
  data: tree, requires: FUNNEL_ENGINE, testersOnly: TESTERS_ONLY
}));

console.log(`\ndone - ${COURSE_ONLY ? 'files left as they were' : `${FILES.length} files`}, ${n} lessons in ${sections.length} sections, ~${tree.stats.minutes} min.`);
console.log(TESTERS_ONLY
  ? 'Course visible to the test account and staff only. Run again with --live when it goes on sale.'
  : `Live. Every member sees the course; only '${FUNNEL_ENGINE}' holders can open it.`);
