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
const HELP = 'Ask in the community, under <strong>Ask for help</strong> in your menu';

const sections = [
  {
    name: 'START · Start Here', label: 'Start Here',
    lessons: [{
      title: 'Start Here', minutes: 3,
      body: [
        P("You're in. The live call was on October 13, and all of it is here for you to watch."),
        H2('Watch Claude Code for Mortals first'),
        P("Start with its first lesson. It's Part 1 of the call, re-recorded as short lessons: you set up Claude Code and plug in your tools."),
        H2('Then watch The Replay'),
        P("It's the rest of the call, in five parts."),
        H2('Install your engine'),
        OL([
          'Download Your Funnel Engine and save the zip.',
          'Download the Quick Start skill and add it to Claude.',
          'Tell Claude to set up your engine with you.',
          'Download and set up the /Integrate skill. Run it after your funnel is live.'
        ]),
        P(`Stuck? Stop there. ${HELP}.`),
        H2('Have these ready'),
        UL(['A paid Claude plan', 'A free Stripe account', 'A domain', 'A Cloudflare account']),
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
          P('Download the Quick Start skill next. Claude sets up the engine with you, one step at a time.'),
          P('Then download and set up the /Integrate skill. It connects your email tool and your course after your funnel is live.'),
          P('Both skill lessons have a zip download. You can save both now. Run Quick Start first.'),
          NOTE('Rather watch first? Open <strong>Install the Funnel Engine</strong> in The Replay. Nothing saved? Tap the button again, then look in your Downloads folder.')
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
          P('Download and set up the /Integrate skill. It connects your email tool and your course.'),
          NOTE('Claude didn\'t start the setup? Say it again: "Use the Quick Start skill to set up my Funnel Engine."')
        ]
      },
      {
        title: 'The /Integrate Skill', minutes: 6,
        body: [
          dl('integrate-skill.zip', 'Download the /Integrate skill (zip)'),
          P('This skill connects your funnel to the tools you already use. You keep them. Claude does the setup for you while you watch.'),
          H2('Finish the Quick Start first'),
          P('/Integrate needs a live funnel. Run the Quick Start skill until Claude says you\'re live, then come back here.'),
          H2('Add the skill to Claude'),
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
            'Proves it with a test signup and a test purchase. You watch the first email land. The test purchase is on your own card; you refund it after.'
          ]),
          H2('What Claude builds, and what you click'),
          P('GoHighLevel, Kit, MailerLite, ActiveCampaign, Mailchimp and Systeme.io connect straight to your funnel. No Zapier. Every sale and every signup lands in your tool with the right tag.'),
          P('A tag is a label on a contact. An automation is the rule that sends your emails; each tool calls it something else, like a workflow, a rule or a flow.'),
          `<table><thead><tr><th>Your tool</th><th>Claude adds it directly</th><th>Claude clicks it in for you</th></tr></thead><tbody>
            <tr><td>Systeme.io</td><td>Tags, every email, and the rules</td><td>A check of what it built</td></tr>
            <tr><td>Kit</td><td>Tags, sequences and their emails</td><td>The rule that starts each sequence</td></tr>
            <tr><td>GoHighLevel</td><td>Tags, and every email as a template</td><td>The workflow</td></tr>
            <tr><td>MailerLite</td><td>Groups</td><td>The automation and its emails</td></tr>
            <tr><td>ActiveCampaign</td><td>Tags</td><td>The automation</td></tr>
            <tr><td>Mailchimp</td><td>Tags</td><td>The flow</td></tr></tbody></table>`,
          P('Systeme.io gets the most done for you. Kajabi on the Growth or Pro plan? Your funnel opens your course the moment someone pays, with no Zapier. No email tool? The funnel sends your emails itself.'),
          H2('Let Claude click for you in Chrome'),
          P('Claude in Chrome is Anthropic\'s extension for Chrome. It lets Claude click and type in your own Chrome while you watch. You need Chrome on a computer, a paid Claude plan and the extension; Claude offers to add it the first time it needs your browser. Say stop any time, or have Claude walk you through each click instead.'),
          H2('What only you do'),
          UL([
            'Log in. Claude never types a password.',
            'Make your keys, and paste them into your own Cloudflare account in a window of your own.',
            'Copy any webhook address the same way.',
            'Pay for anything. Claude never touches your billing.',
            'Say yes. Nothing switches on until you do.'
          ]),
          P('Your keys never go in the chat. Claude tells you where to paste them.'),
          H2('When you still need a paid Zapier plan'),
          UL([
            'ClickFunnels 2.0. It connects through Zapier. On its Scale plan and up, Claude also builds your ClickFunnels workflow directly.',
            'Kajabi on the Basic or Kickstarter plan, to open your course for each buyer.',
            'Sending your follow-ups from inside Kajabi.'
          ]),
          H2('Check your plan first'),
          P('Some free plans can\'t send a follow-up sequence at all: Kit and Mailchimp. MailerLite and Systeme.io have tight caps on their free plans. Claude tells you before it writes a word.'),
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
          P('Have your <strong>AI Roadmap</strong>? It already names your offer, your buyer and your goal, so most of the brief is done. Copy it across.'),
          NOTE(`Stuck on a box? Watch <strong>The 10/90 and the Install Offer</strong> in The Replay. Still stuck? Leave it blank and ${HELP.charAt(0).toLowerCase() + HELP.slice(1)}.`)
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
          NOTE(`Didn't work? Watch <strong>Bypass Permissions and Remote Control</strong> in Claude Code for Mortals. Still stuck? ${HELP}.`)
        ]
      }
    ]
  },
  {
    name: 'CLAUDE CODE · Claude Code for Mortals', label: 'Claude Code for Mortals',
    video: ['oys-cc-tony-stark', 'oys-cc-code-vs-chat', 'oys-cc-setup', 'oys-cc-skills', 'oys-cc-models',
      'oys-cc-bypass-remote', 'oys-cc-settings', 'oys-cc-browser', 'oys-cc-codex-claude', 'oys-cc-team-member', 'oys-cc-plug-in']
  },
  {
    name: 'REPLAY · The Replay', label: 'The Replay',
    video: ['oys-replay-new-way', 'oys-replay-install-engine', 'oys-replay-pages-live', 'oys-replay-ten-ninety', 'oys-replay-qa']
  }
];

/* ---------------- write it ---------------- */

let n = 0, seconds = 0, order = 0;
const tree = { title: 'The Funnel Engine', sections: [], stats: null };

for (const sec of sections) {
  const lessons = [];
  const items = sec.video
    ? await Promise.all(sec.video.map(async (slug) => {
        const m = bunnyMap[slug];
        if (!m) throw new Error(`no Bunny video for ${slug} - finish the upload first`);
        const v = await bunny(m.guid);
        return { title: m.title, guid: m.guid, length: v.length || 0, width: v.width, height: v.height };
      }))
    : sec.lessons;

  for (const l of items) {
    n += 1;
    const num = String(n).padStart(2, '0');
    const libId = `lesson:funnel-engine-${num}`;
    await retry(libId, () => upsertLibraryItem({
      id: libId, kind: 'lesson', course: SLUG, category: sec.label, title: l.title, description: null,
      // A video lesson is the video: no body, the same as the other paid courses.
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
