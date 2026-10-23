/**
 * Build the Funnel Engine's two order bumps in the member area.
 *
 *   node --env-file=.env.local scripts/ingest-funnel-engine-bumps.mjs "<folder with the afu files>" --course=edward
 *   node --env-file=.env.local scripts/ingest-funnel-engine-bumps.mjs "<folder with the afu files>" --course=operators
 *   ... add --course-only to rebuild the lessons without uploading the files again,
 *   ... add --live once they are on sale.
 *
 * Edward is the whole of Evergreen Ads 3.0: the Edward media-buyer skill, the ad
 * templates, the setup lessons and the live workshop. The operators bump is the
 * sixteen operators in one skill, with its three install lessons. Both moved
 * over from ai.productizedcoach.com, rebranded for AI Founder University (see
 * Claude outputs/funnel-engine/bumps-inventory.md), and gated the way the
 * Funnel Engine is: on their own entitlements, which the membership never lends.
 *
 * Testers-only until --live. Videos come from the maps written by
 * scripts/upload-funnel-engine-videos.mjs --course=edward|operators.
 */
import { put } from '@vercel/blob';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { upsertContent, upsertLibraryItem, upsertCourse } from '../lib/db.js';
import { EDWARD, DFY_OPERATORS } from '../lib/products.js';

const SRC = process.argv.slice(2).find((a) => !a.startsWith('--'));
const WHICH = (process.argv.find((a) => a.startsWith('--course=')) || '').slice('--course='.length);
const TESTERS_ONLY = !process.argv.includes('--live');
const COURSE_ONLY = process.argv.includes('--course-only');
if (!SRC || !['edward', 'operators'].includes(WHICH)) {
  console.error('usage: ingest-funnel-engine-bumps.mjs <folder> --course=edward|operators [--course-only] [--live]');
  process.exit(1);
}
for (const k of ['BLOB_READ_WRITE_TOKEN', 'BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} is not set in .env.local`); process.exit(1); }
}

const SUPPORT = 'support@aifounderuniversity.com';
const HELP = 'ask in the community, under <strong>Ask for help</strong> in your menu';

const P = (s) => `<p>${s}</p>`;
const H2 = (s) => `<h2>${s}</h2>`;
const UL = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const OL = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const NOTE = (s) => `<p><em>${s}</em></p>`;
const PRE = (s) => `<pre><code>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;
const TABLE = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ---------------- the two courses ---------------- */

const COURSES = {
  edward: {
    slug: 'edward-evergreen-ads', title: 'Edward: Evergreen Ads 3.0', entitlement: EDWARD, kind: 'edward', sort: 7,
    videos: 'Claude outputs/funnel-engine/bunny-videos-edward.json', lessonPrefix: 'edward',
    files: [
      { file: 'edward.zip', title: 'Edward, your AI media buyer', type: 'application/zip',
        description: 'The Edward skill: install it in Claude or ChatGPT, then say hey Edward. He writes your ads, makes your images and builds your campaign with you.' },
      { file: 'original-ad-templates-editable.docx', title: 'The Original Ad Templates (editable)', type: DOCX,
        description: 'Every example ad, the writing guide, prompts, creative references and the launch checklist, as an editable document.' },
      { file: 'original-ad-templates.pdf', title: 'The Original Ad Templates (PDF)', type: 'application/pdf',
        description: 'The same templates as a PDF.' }
    ],
    sections: [
      { name: 'START · Start Here', label: 'Start Here', lessons: [
        { title: 'Get All The Templates', minutes: 2, files: [['original-ad-templates-editable.docx', 'Download the Ad Templates (editable)'], ['original-ad-templates.pdf', 'Download the Ad Templates (PDF)']], body: [
          P('This is the document with all our example ads.'),
          P('Use its tabs for the writing guide, prompts, ad examples, creative references and the launch checklist. Keep it open whenever you write new ads: it is built to come back to.')
        ] },
        { title: 'Start Here', video: 'eg3-start-here', files: [['original-ad-templates-editable.docx', 'Download the Ad Templates (editable)']], body: [
          P("You're in. Here is the whole picture in sixty seconds."),
          H2('What you have'),
          P('Three things. Use them in this order.'),
          UL([
            '<strong>Edward.</strong> He is in Part 1. A media buyer you install in Claude or ChatGPT. He writes your ads, makes your images and builds your campaign with you.',
            '<strong>The workshop replay.</strong> Part 3. Nine chapters plus the written playbook. It is how we run ads, and Edward runs on it.',
            '<strong>The Meta setup.</strong> Part 2. Twenty minutes, done once, before your first $150 test. Not today.'
          ]),
          H2('Do this now'),
          P('Go to Part 1, "Download Edward". Install him the way that lesson shows. Claude in a browser is the easiest route. Then say: <strong>hey Edward</strong>.'),
          P('Edward starts on your offer and your ads, not on your ad account. You do not need Meta connected for any of that.'),
          H2('The one thing people get wrong'),
          P('Do not drag the Edward folder into a browser chat. A browser tab cannot open a folder. In Claude, you upload the zip as a skill. In ChatGPT, you use the desktop app. The Download Edward lesson shows every click.'),
          H2('If you only have ten minutes today'),
          P('Install Edward and say hey Edward. That is the whole job.'),
          NOTE(`If you can only pick one AI tool, we pick ChatGPT for this. Stuck? ${HELP.charAt(0).toUpperCase() + HELP.slice(1)}.`)
        ] }
      ] },
      { name: 'PART 1 · Meet Edward', label: 'Meet Edward', lessons: [
        { title: 'Download Edward', minutes: 4, files: [['edward.zip', 'Download Edward']], body: [
          P('That file is Edward. He is a media buyer: our whole way of running ads, written down so Claude or ChatGPT can do the work with you. Install him once, in whichever you use, then say <strong>hey Edward</strong> and he takes it from there.'),
          NOTE('Do not drag the Edward folder into a browser chat. A browser tab cannot open a folder. Claude in a browser takes Edward as a skill instead, straight from the zip.'),
          H2('Claude in a browser. The easiest route.'),
          P('Do not unzip the file for this one.'),
          OL([
            'Open Settings, then Capabilities. Check Code execution and file creation is on.',
            'In the left sidebar, click Customize, then Skills.',
            'Click Add, then Upload skill. Pick the Edward zip. Click Save.',
            'Start a new chat. Say hey Edward.'
          ]),
          P('On a Mac, Safari may unzip the download for you. See only a folder? Right-click it and choose Compress, then upload that zip.'),
          P('A new chat cannot see your last chat\'s files. So Edward hands you a zip of your work at the end of each step. Download it. In your next chat, attach it and say hey Edward.'),
          H2('ChatGPT desktop app'),
          OL(['Unzip the file. Open the Edward folder in the app. Say yes when it asks for access.', 'In the box where you type, select <strong>Work locally</strong>.', 'Say hey Edward.']),
          P('Step 2 is the one people miss. Keep Work locally selected whenever the task needs files on your computer. Does your ChatGPT show Skills? Then you can upload the zip there instead.'),
          H2('Claude app for Mac or Windows'),
          P('Like a folder better? Unzip the file. In the left sidebar, click + next to Projects. Choose Use an existing folder on your computer and pick the Edward folder. Say hey Edward. Folder projects need a paid Claude plan.'),
          H2('Claude Code or Codex'),
          P('Unzip the file. Open the Edward folder and run <code>claude</code> or <code>codex</code> inside it. Type go.'),
          H2('Any other chat'),
          P('Open a new chat. Attach START-HERE.md and CLAUDE.md from the Edward folder. Then say:'),
          PRE('Follow these. Start me at 01-offer and ask me one question at a time.'),
          P('It works. It is slower, and you repeat it in every new chat.'),
          H2('If nothing happens'),
          PRE('Use the Edward skill. Read SKILL.md and CLAUDE.md, then start me.'),
          P('Still nothing? Your AI is not looking at Edward. In a browser, check Edward is switched on under Customize, then Skills. In ChatGPT, check Work locally is on. In the Claude app, check the project points at the Edward folder.'),
          H2('What is inside'),
          TABLE(['Folder', 'What you walk out with'], [
            ['00-setup', 'An ad account that can actually run ads, and your numbers connected to your AI'],
            ['01-offer', 'The exact words your buyers use, then an offer worth putting money behind'],
            ['02-ads', '5 primary texts, 5 headlines, 5 descriptions'],
            ['03-images', 'Your launch creative set, built from 27 image concepts and 40 real ads'],
            ['04-launch', 'A clean $150 test, built for you, switched off until you approve it'],
            ['05-diagnose', 'What is actually broken, with the evidence'],
            ['06-optimize', 'One decision per window, and never looking daily']
          ]),
          P('Two more folders do quieter jobs. <code>_library</code> holds the swipes, templates, frameworks and image concepts he pulls from. <code>your-work</code> is where everything you build lands. That folder is yours.'),
          H2('The deal'),
          P('Edward does the grunt work and builds your campaigns for you. Everything he builds arrives switched off. Nothing spends a penny until you look at it and turn it on yourself. That part never changes.'),
          H2('What you need'),
          UL(['Claude or ChatGPT. Claude Code counts on its own and needs no desktop app.', 'A Facebook Page and a Meta ad account. No account yet? Part 2 walks you through creating one.', 'About $150 to test with. That goes to Meta, not to us.']),
          P('No command line, unless you choose Claude Code or Codex.')
        ] }
      ] },
      { name: 'SETUP · Set up your agent', label: 'Set up your agent', lessons: [
        { title: 'How to install an agent', video: 'eg3-how-to-install-an-agent', body: [
          P('Follow the five-minute demo to get your Edward folder into the desktop setup shown in the video. The demo uses Edward; follow along with your own Edward folder.'),
          H2('Get your folder ready'),
          OL(['Download Edward from the previous lesson.', 'Unzip the download. Keep the whole folder together.', 'Open the desktop setup you use for your work.', 'Follow the video to use Downloads or your business folder.']),
          H2('Try this with Edward'),
          P('Paste this, and add the full folder path if needed:'),
          PRE("I downloaded Edward to my Downloads folder. Help me add him to my business folder and get started."),
          P('If your app cannot find the folder, copy the full folder path from your computer, paste it into your message and ask your app to check it. Keep the files together. You do not need a perfect folder setup to start.'),
          H2('Check that you are ready'),
          UL(['You can find the whole Edward folder.', 'Your app has confirmed which folder it is using.', 'You can start the first step with Edward.'])
        ] }
      ] },
      { name: 'PART 2 · Before The Workshop', label: 'Before The Workshop', lessons: [
        { title: 'Get Your Ad Account Ready', minutes: 4, body: [
          P('Edward writes your ads and makes your images without touching Meta. Launch is different. To build your campaign he needs an ad account that can spend, a pixel that can see your sales, and a way to read your numbers. That is this lesson: about twenty minutes, done once.'),
          H2('When to do this'),
          P('Before your first $150 test. Not before your first ads. Never run ads? Do this the day before you launch. Already run ads? Skip to the next lesson and connect your account. Five minutes.'),
          H2('Open Edward and say this'),
          PRE('set me up'),
          P('He asks if you have run ads before and routes you on the answer. Answer honestly. The beginner path creates everything from scratch.'),
          H2('What you walk out with'),
          UL([
            '<strong>A Facebook Page.</strong> Ads run from a Page, not from your personal profile. Already have one? You are done with this bit.',
            '<strong>An ad account that can spend.</strong> A Business Manager, an ad account inside it, and a card on file. This is the step people skip, and then they hit a wall on launch day.',
            '<strong>A pixel on your page, firing.</strong> This is what lets Meta see your sales. Without it your campaign cannot even be created as a sales campaign.',
            '<strong>Your numbers connected to your AI.</strong> That is the next lesson. Once it is live, Edward reads your account and builds campaigns for you instead of you copying settings by hand.'
          ]),
          H2('One PSA'),
          P('If your ad account is already disabled, we cannot help with that one. Get a friend, spouse or family member to create a new Business Manager, then move your pixel and Page across.'),
          H2('If you get stuck'),
          P('Tell your AI:'),
          PRE("I'm stuck, what do I do?"),
          P(`He has the map. Let him read. Whatever you cannot finish, email ${SUPPORT} and we will sort it out.`)
        ] },
        { title: 'Connect Your Ad Account To Your AI', video: 'eg3-connect-meta-mcp', body: [
          P('Your AI can write ads all day without ever seeing a number from your account. This is the connection that fixes that: about five minutes, done once. Do this setup yourself with the video; your AI can get the steps wrong.'),
          H2('The address'),
          P('Meta runs a server that hands your ad data to any AI that asks for it. You point your AI at it and give it permission to read. One address, and it never changes:'),
          PRE('https://mcp.facebook.com/ads'),
          H2('In Claude'),
          OL(['Open Settings, then Connectors.', 'Click Add, then Add custom connector.', 'Name it <strong>Meta Ads</strong>.', 'Paste the address above into the server URL box.', 'Click Add, then sign in with the Facebook account that owns your ad account.']),
          P('You will see Connected to Meta Ads, and Meta Ads appears in your connector list with a checkmark. If you get an error, find Meta Ads in your connectors and click Connect, then sign in with Facebook. Set the Meta Ads tools to always allow, so Claude can work in your ad account without asking each time.'),
          H2('In ChatGPT'),
          OL([
            'Open Settings, then Plugins. Click Developer mode at the bottom and turn it on.',
            'Go back to the Plugins directory and click Create app.',
            'Name: Meta Ads. Connection: Server URL. Server URL: https://mcp.facebook.com/ads. Authentication: OAuth. Leave the advanced OAuth settings as they are.',
            'Tick I understand and want to continue, click Create, then Sign in with Meta Ads and finish the Facebook sign-in.'
          ]),
          P('Check it worked: select Meta Ads from the Developer mode tools in a new chat and paste:'),
          PRE("Use Meta Ads to list my ad accounts. Don't make any changes."),
          P('If it lists your ad account, the connection works. If it returns no accounts, sign in again with the Facebook account that has access to your ads. If ChatGPT will not connect, use Claude for this part.'),
          H2('Why this matters'),
          P('Connected, your AI reads your real numbers and builds your campaigns against them. Not connected, you are copying settings across by hand.')
        ] }
      ] },
      { name: 'PART 3 · The Live Workshop', label: 'The Live Workshop', lessons: [
        { title: 'Evergreen Ads 3.0 Live', minutes: 2, body: [
          P('The full live workshop, two hours and fifteen minutes, cut into nine chapters so you can find the bit you need instead of scrubbing through a recording. Every chapter has captions.'),
          H2('Watch it in order'),
          P('Start at chapter 1 and go straight through. It is built as one arc.'),
          TABLE(['#', 'Chapter', 'What you walk out with'], [
            ['1', "Welcome + What We're Installing", 'Why this is one hour a week, and the prerequisites'],
            ['2', 'What Makes A Great Evergreen Ad', 'The 80/20, the hooks, video vs images'],
            ['3', 'Writing Your Ads With Edward', 'The live demo, start to finish'],
            ['4', 'Campaign Structure That Stays Simple', 'One campaign, two ad sets, no testing campaigns'],
            ['5', 'Validation, Windows & Velocity', 'The $150 test, the 4/7 day rule, 10% scaling'],
            ['6', 'Offer First, Ads Second', 'Where conversion actually comes from'],
            ['7', 'Building AI Into Your Offer', 'Making AI the angle instead of the tool'],
            ['8', 'What To Do When It Dies', 'The three bottlenecks and how to tell them apart'],
            ['9', 'Launching Live + Final Questions', 'Publishing, and the last round of questions']
          ]),
          P('Chapters 4, 5 and 8 are the ones worth rewatching. That is the whole operating system: how the account is built, when you are allowed to look at it, and what to do the day it stops working.'),
          H2('The written version'),
          P('The last lesson in this section is the full playbook in writing. Use the video to understand it and the playbook to run it.')
        ] },
        { title: "1. Welcome + What We're Installing", video: 'eg3-live-01-welcome' },
        { title: '2. What Makes A Great Evergreen Ad', video: 'eg3-live-02-great-ads' },
        { title: '3. Writing Your Ads With Edward', video: 'eg3-live-03-factory-live' },
        { title: '4. Campaign Structure That Stays Simple', video: 'eg3-live-04-campaign-structure' },
        { title: '5. Validation, Windows & Velocity', video: 'eg3-live-05-validation-velocity' },
        { title: '6. Offer First, Ads Second', video: 'eg3-live-06-offer-first' },
        { title: '7. Building AI Into Your Offer', video: 'eg3-live-07-ai-into-offer' },
        { title: '8. What To Do When It Dies', video: 'eg3-live-08-when-it-dies' },
        { title: '9. Launching Live + Final Questions', video: 'eg3-live-09-launching-live' },
        { title: 'The Workshop Playbook', minutes: 10, body: [
          P('Everything from the live workshop, in writing, in the order it was taught. Use the replay to understand it. Use this to run it.'),
          H2('The goal'),
          P('Get your ads flipping strangers into buyers in one hour per week.'),
          H2('What we installed'),
          UL(['How to create great ads.', 'How to get AI to do the grunt work for you.', 'What to do when something inevitably breaks.']),
          H2('Prerequisites'),
          UL(['A great offer. Your ads probably cannot scale because the offer is weak, or the average order value is.', '$150 to test. Ignore the agency line about needing a big testing budget.', 'MCP or CLI set up.', 'Edward on your computer, updated regularly.']),
          P('PSA: if your ad account is already disabled, we cannot help you. Get a friend, spouse or family member to create a new Business Manager, then move your pixel and Page across.'),
          H2('Part 1 — Creating great evergreen ads'),
          P('<strong>The 80/20:</strong> the first three lines of the ad, the image or video, and the headline.'),
          P('<strong>Video.</strong> Even if you are bad at video, do video. The best ads for this offer are all videos.'),
          P('<strong>Hooks</strong> are the only thing that really matters to start:'),
          UL(['"Stop ______"', '"If I had to get [result] in [time frame], this is what I\'d do"', '"If [negative action they are doing]..."']),
          P('<strong>The rest of the video:</strong> explain it, tell them to click the link (a lot), the guarantee, the bonuses, click the link.'),
          P('<strong>When you are launching:</strong> less polish. It could be a 30-second video. One client\'s best ad is a 10-minute video.'),
          P('<strong>Editing and publishing with AI.</strong> There is a free tool called Remotion. Send your AI a screenshot, past content, or content you like, with lots of screenshots. It builds a template. Then tell it to edit the video and it adds captions, writes the copy and publishes the ads. This does not replace a video editor. It replaces you not shipping.'),
          P('<strong>Images.</strong> AI images work. Lifestyle images still work well because they read as native content. Test with and without captions. One of our best ads is a plain lifestyle photo.'),
          P('<strong>What works best:</strong> video, hands down, even with poor editing and okay copy. Ranked by cost per purchase, the top of our own account is video top to bottom. Test lots of different combinations.'),
          P('<strong>Writing the ads:</strong> open Claude or ChatGPT, point it at the Edward folder, use the prompt, watch it work, make edits, launch. Go-to rule: lots of creatives. Launch 10 or more when testing, then just feed it.'),
          H2('Part 2 — Getting AI to do the setup and grunt work'),
          P('<strong>Account structure.</strong> One campaign per offer. Two ad sets inside it, both on Algo targeting:'),
          UL(['<strong>Broad</strong> — no interests, just countries. Almost always wins.', '<strong>Narrow</strong> — two or three bigger interests. A "narrow broad."']),
          P('The more narrow you go, the more expensive the campaign gets. No testing campaigns. None. It makes no sense to stop a great performing ad in one campaign and move it to another. Everything goes into the ad sets, and you kill the losers. Your AI can publish all of this for you through the Meta Ads connection.'),
          P('<strong>Validation.</strong> You can feel a winning offer. It takes off like a rocket. If it is a slog, kill it. Roll boulders downhill.'),
          UL(['$150 of spend and fewer than 3 buyers: kill it.', '$100 of spend and zero buyers: kill it.']),
          P('It takes the same time, attention and energy to focus on a winning offer as a losing one. Once you get consistent buyers, focus on average order value and new creative. AOV is what makes ads easy: if the average buyer gives you $60, you can spend $60 to get a buyer.'),
          P('<strong>Look in windows, not daily.</strong> Looking at your ad account every day is the most dangerous thing you can do. You ride emotional highs and lows off an external result, and turn the ads off because they look "broken" on a day they averaged well.'),
          TABLE(['Daily spend', 'Look every'], [['Above $500', '4 days'], ['Below $499', '7 days']]),
          P('<strong>Velocity.</strong> Scaling is 10% per day. Hitting 3X ROAS? Crank the budget and keep increasing.'),
          P('Routines worth setting up: one to pump out a new creative every day (ask your AI to look at the best performing ad and create a variation off the winner); one to kill losers (can also be a rule); one to increase budget (this one has to check Stripe).'),
          P('<strong>Advertising philosophies:</strong> offer and AOV before ads; more control to Meta rather than strong-arming the algorithm; lots of creatives; human plus AI, which go well together.'),
          H2('Part 3 — What to do when it dies'),
          P('First, figure out what happened. Ask your AI:'),
          PRE("We're down in sales in this past 4-day window. Compare the ads to the previous window."),
          P('Then look at your funnel stats. What changed? Something suddenly changed, and it is one of three things:'),
          OL([
            '<strong>Cost per link click went up</strong> — ad fatigue.',
            '<strong>Sales page conversion rate went down</strong> — offer fatigue.',
            '<strong>Average order value went down</strong> — either an anomaly, or you are reaching more problem-aware markets and your upsell and bump offers need to get better.'
          ]),
          P('<strong>Tips on upsells:</strong> the price goes up once they click out; you are getting them to say "maybe", because it has a great guarantee; guilt trip them hard with the "no" button; kill offers quick if they do not work.')
        ] }
      ] },
      { name: 'BONUS · Edit Your Videos with AI', label: 'Bonus', lessons: [
        { title: 'How to Edit Your Videos with AI', video: 'eg3-ai-video-editing-bonus', body: [
          P('Add captions, create an opening hook and turn your video into an ad with AI. Pair it with the Remotion tip in the Workshop Playbook.')
        ] }
      ] }
    ]
  },

  operators: {
    slug: 'dfy-ai-operators', title: 'DFY AI Operators', entitlement: DFY_OPERATORS, kind: 'operators', sort: 8,
    videos: 'Claude outputs/funnel-engine/bunny-videos-operators.json', lessonPrefix: 'operators',
    files: [
      { file: 'sell-while-you-sleep-all-16-operators-in-one-skill.zip', title: 'All 16 Operators In One Skill', type: 'application/zip',
        description: 'The whole system in one zip. Install it once, then type start micro offer: it walks you through your promise, offer, page, first buyers, ad test and more money per buyer.' }
    ],
    sections: [
      { name: 'YOUR UPGRADE · Your DFY AI Operators', label: 'Your DFY AI Operators', lessons: [
        { title: 'How to Install The Skills', video: 'install-the-skills', files: [['sell-while-you-sleep-all-16-operators-in-one-skill.zip', 'Download All 16 Operators In One Skill']], body: [
          P('One install. All sixteen operators. Then type <strong>start micro offer</strong>.'),
          H2('What changed since the video'),
          P("The video shows sixteen separate skills and a shared folder. That's gone. Now it's one skill that holds all sixteen operators. You install it once, and it walks you through them in order, one step at a time."),
          H2('Way 1: Claude in a browser. The easiest.'),
          P('Nothing to install. Works on every Claude plan, free included.'),
          OL(['Open Settings, then Capabilities. Turn on Code execution and file creation.', 'Click Customize in the left sidebar, then Skills.', 'Click Add, then Upload skill.', "Pick the zip you downloaded. The zip itself. Don't unzip it first.", 'Click Save.', 'Start a new chat and type <strong>start micro offer</strong>.']),
          P("On a Mac? Safari may unzip the download for you. If all you see is a folder, right-click it, choose Compress, and upload that zip. On a Team or Enterprise plan? Your admin may have to switch skills on first."),
          P("<strong>One thing about the browser:</strong> every new chat starts empty. So at the end of each step, the skill hands you one zip with all your work in it. Download it. In your next chat, attach it and type start micro offer. You pick up right where you stopped."),
          H2('Way 2: The Claude or ChatGPT desktop app'),
          OL(['Unzip the download. Put the folder somewhere you can find it.', 'Claude app: in the left sidebar click + next to Projects, choose Use an existing folder on your computer, and pick the folder. Folder projects need a paid Claude plan.', "ChatGPT app: open the folder, allow access, then select Work locally in the composer. That's the step people miss.", 'Type <strong>start micro offer</strong>.']),
          H2('Way 3: Claude Code or Codex'),
          OL(['Unzip the download.', 'Open the folder and run <code>claude</code> or <code>codex</code> inside it. Or drop the folder into your skills folder.', 'Type <strong>start micro offer</strong>.']),
          H2('Already installed the old version?'),
          P("It still works. Remove it first anyway, so two versions don't answer at once. The new one reads real pages that sold before it writes yours, sets up your $150 ad test with you click by click, and works in a browser."),
          H2('Words that work any time'),
          UL(['<strong>start micro offer</strong> starts or picks up your offer.', '<strong>gsd</strong> gives you one job for today, until your page is live and taking money.', "<strong>I'm stuck, what do I do?</strong> makes it read the map and tell you the next step."]),
          P('You can also use the old operator names: "Write my North Star Promise", "write my upsell page", "write my emails". They all still work.'),
          H2('Nothing happens?'),
          PRE('Read START-HERE.md and CLAUDE.md, then start me at 00-start.'),
          P(`Still nothing? Your AI isn't looking at the skill. In a browser, check the skill is switched on under Customize, Skills. In a desktop app, check your project points at the folder. Stuck for real? Email ${SUPPORT} with what you typed and what it said back.`)
        ] },
        { title: 'How to Use The Skills', video: 'use-the-skills', body: [
          P('AI does not have your experience, knowledge, insight or ideas. Your judgment steers the build, not the AI.'),
          H2('One way in now'),
          P('Type <strong>start micro offer</strong>. It asks where you are, then takes you to the right step.'),
          UL(['Starting from scratch? It starts at your promise.', 'Offer not selling? It sharpens your headline first, then reads your numbers.', 'Already selling? It goes straight to more money per buyer.']),
          P('The video shows the old way in, with sixteen separate skills. The loop is the same: the skill asks, you answer, and the page gets built from your answers.'),
          H2('Steal these'),
          UL([
            'Keep your proof, surveys, testimonials and transcripts ready. Paste them in when it asks.',
            "Don't know the market yet? Say that. Ask it to research or take its best guess.",
            'Use three clean notes: "Here\'s what I like." "This is wrong." "Expand upon this."',
            'Stuck on a day? Type <strong>gsd</strong>. It gives you one job for today.'
          ]),
          P("Your next step: type start micro offer, answer the first question, and don't stop until you have your promise.")
        ] },
        { title: 'How to Load Up The Skills (Live Walkthrough)', video: 'load-up-the-skills', body: [
          P("The download changed since this was recorded. It's one skill now, not sixteen; the steps are in How to Install The Skills. Install it, then type <strong>start micro offer</strong>."),
          P('The rest of this walkthrough still holds: one folder per offer, and your real proof loaded before you start.'),
          H2('Highlights'),
          UL([
            'A skill is like a step-by-step guide you hand to AI.',
            'Make one folder for each offer. Everything the AI writes or builds lives there.',
            'On a $20 budget, your usage goes further in Codex. Keep it on the default speed.',
            'Claude keeps working longer on big jobs. Codex can get lazy on long runs.',
            'The same skill works in Claude, Codex and Gemini.'
          ]),
          H2('Your next step'),
          OL(['Make one folder on your computer for your offer.', 'Open that folder in Claude or Codex and ask it to install the skill.', 'Type start micro offer and answer its questions.'])
        ] }
      ] }
    ]
  }
};

/* ---------------- build ---------------- */

const C = COURSES[WHICH];
const retry = async (what, fn) => {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (err) {
      if (attempt >= 3) throw err;
      console.log(`    ${what}: ${String(err.message).slice(0, 80)}, trying again (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 10000 * attempt));
    }
  }
};
const keyOf = (file) => `${C.kind}/${file}`;
const dl = (file, label) => `<p><a href="/api/content/download?key=${encodeURIComponent(keyOf(file))}"><strong>⬇ ${label}</strong></a></p>`;

let sort = 0;
for (const f of COURSE_ONLY ? [] : C.files) {
  const full = path.join(SRC, f.file);
  const body = await readFile(full);
  const size = (await stat(full)).size;
  const { url } = await retry(f.file, () => put(`content/${keyOf(f.file)}`, body, {
    access: 'private', addRandomSuffix: true, contentType: f.type, token: process.env.BLOB_READ_WRITE_TOKEN
  }));
  await retry(`record ${f.file}`, () => upsertContent({
    key: keyOf(f.file), title: f.title, kind: C.kind, filename: f.file,
    blobUrl: url, sizeBytes: size, sort: sort++, requires: C.entitlement, description: f.description
  }));
  console.log(`  + file  ${(size / 1024).toFixed(0).padStart(6)} KB  ${keyOf(f.file)}`);
}

const map = JSON.parse(await readFile(path.resolve(C.videos), 'utf8'));
const bunny = async (guid) => {
  const r = await retry(`Bunny ${guid}`, () => fetch(`https://video.bunnycdn.com/library/${process.env.BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`,
    { headers: { AccessKey: process.env.BUNNY_STREAM_API_KEY, accept: 'application/json' } }));
  if (!r.ok) throw new Error(`Bunny ${guid}: ${r.status}`);
  return r.json();
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

let n = 0, seconds = 0, order = 0;
const tree = { title: C.title, sections: [], stats: null };
for (const sec of C.sections) {
  const lessons = [];
  for (const l of sec.lessons) {
    n += 1;
    const num = String(n).padStart(2, '0');
    const libId = `lesson:${C.lessonPrefix}-${num}`;
    const entry = { libId, lessonId: `${C.lessonPrefix.slice(0, 2)}-${num}`, title: l.title };
    if (l.video) {
      const m = map[l.video];
      if (!m) throw new Error(`no Bunny video for ${l.video} - upload it first`);
      const v = await bunny(m.guid);
      if (v.status !== 4) console.log(`    note: ${l.title} is still processing on Bunny (status ${v.status})`);
      entry.videoId = m.guid;
      entry.duration = mmss(v.length || 0);
      entry.aspect = v.width && v.height ? Number((v.width / v.height).toFixed(4)) : 1.7778;
      seconds += v.length || 0;
    } else {
      seconds += (l.minutes || 0) * 60;
    }
    const body = [...(l.files || []).map(([file, label]) => dl(file, label)), ...(l.body || [])];
    await retry(libId, () => upsertLibraryItem({
      id: libId, kind: 'lesson', course: C.slug, category: sec.label, title: l.title, description: null,
      bodyHtml: body.length ? body.join('') : null,
      sort: order, requires: C.entitlement, testersOnly: TESTERS_ONLY
    }));
    order++;
    lessons.push(entry);
    console.log(`  + ${libId}  ${entry.videoId ? `[${entry.duration}]` : '[text]'}  ${l.title}`);
  }
  tree.sections.push({ name: sec.name, label: sec.label, lessons });
}
tree.stats = { lessons: n, minutes: Math.round(seconds / 60), sections: C.sections.length };

await retry('course', () => upsertCourse({
  slug: C.slug, title: C.title, lessonCount: n, sort: C.sort,
  data: tree, requires: C.entitlement, testersOnly: TESTERS_ONLY
}));

console.log(`\ndone - ${COURSE_ONLY ? 'files left as they were' : `${C.files.length} files`}, ${n} lessons in ${C.sections.length} sections, ~${tree.stats.minutes} min.`);
console.log(TESTERS_ONLY
  ? 'Visible to the test account and staff only. Run again with --live when it goes on sale.'
  : `Live. Every member sees the course; only '${C.entitlement}' holders can open it.`);
