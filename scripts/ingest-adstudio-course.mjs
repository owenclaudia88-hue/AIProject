/**
 * Build the Claude Ad Creative Studio course in the member area.
 *
 *   node --env-file=.env.local scripts/ingest-adstudio-course.mjs
 *
 * Writes one library row per lesson (kind 'lesson', gated on the
 * `ad-creative-studio` entitlement, which is what carries the body text) and
 * one courses row holding the section tree. Re-runnable: everything upserts by
 * id, so editing a lesson below and running again replaces it.
 *
 * Text-only by design — the player hides its video frame for a lesson with no
 * videoId, so these read as written pieces rather than empty players. The same
 * shape as the Carousel Studio course, because a member who bought both should
 * not have to learn two different kinds of page.
 *
 * Every figure below is taken from the plugin itself — its README, QUICKSTART,
 * meta-specs and quality bar — rather than from the sales copy, so the course
 * cannot promise something the thing they installed does not do.
 *
 * Written against plugin 1.2.0, which added the guided setup. The first draft
 * was written against 1.1.0 and told buyers to run the skills by hand; that is
 * now the long way round, and a course that teaches the long way round is
 * worse than no course because the buyer trusts it over the thing in front of
 * them. When the plugin changes again, this changes with it.
 */
import { upsertLibraryItem, upsertCourse } from '../lib/db.js';

const SLUG = 'claude-ad-creative-studio';
const ENTITLEMENT = 'ad-creative-studio';

/* Written for the test account first. A course row is visible to every member
   the moment it exists — locked, but visible — and a locked card for something
   not on sale yet is an announcement nobody meant to make.

   Pass --live to announce it to everyone. */
const TESTERS_ONLY = !process.argv.includes('--live');

const P = (s) => `<p>${s}</p>`;
const H2 = (s) => `<h2>${s}</h2>`;
const UL = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const OL = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
const PRE = (s) => `<pre><code>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;
const NOTE = (s) => `<p><em>${s}</em></p>`;

const sections = [
  {
    name: 'SECTION 1 · Start Here',
    label: 'Section 1',
    lessons: [
      {
        title: 'What you just bought',
        minutes: 3,
        body: [
          P('Ad Creative Studio is a Claude plugin. You tell it about your offer once, then ask for ads — and it gives you the image <em>and</em> every word that runs with it, ready to upload to Ads Manager.'),
          P('It is not a template pack and it is not a prompt. It is eight skills that Claude loads and runs for you.'),
          H2('What you get for every single ad'),
          UL([
            'The image in <strong>feed 4:5 (1080 × 1350)</strong> and <strong>story 9:16 (1080 × 1920)</strong>',
            '<strong>Primary text</strong> — one long version and two short ones, pain-led and outcome-led',
            'A <strong>headline</strong>, a <strong>description</strong> and the <strong>CTA button</strong> to pick',
            'The <strong>hook angle</strong> it is testing, so a losing ad still tells you something',
            'A row in <code>ads.csv</code>, and a test plan for the batch'
          ]),
          H2('Two ways the images are made'),
          P('<strong>Built-in designs</strong> are laid out as real type in a browser and exported at full resolution — receipts, value stacks, bold claims, step cards, comparisons. Every word is spelled right and every price is your price, because the text is text rather than something a model drew.'),
          P('<strong>AI images</strong> — product mockups, hands holding the thing, creator-style photos — use whatever image generator you have connected. No generator connected? You still get the ads, with the finished prompt to paste into ChatGPT, Ideogram or Midjourney.'),
          H2('The library behind it'),
          P('52 ad styles, 16 hook types and 5 copy structures, drawn from over 800 real ads for digital products, courses, books and AI tools — with the ones advertisers keep running for weeks given priority. It holds techniques and layouts, never anyone else’s actual ads.'),
          NOTE('Everything the plugin writes lands in whatever folder Claude has open. Make one folder for your ads and point Claude at it, or you will be hunting for files later.')
        ]
      },
      {
        title: 'Install it',
        minutes: 4,
        body: [
          P('Keep the zip exactly as it is. <strong>Do not unzip it.</strong> Claude wants the zip.'),
          OL([
            'Open the <strong>Claude desktop app</strong>',
            '<strong>Settings</strong> → <strong>Plugins</strong>',
            '<strong>Add</strong> (top right) → <strong>Upload plugin</strong>',
            'Choose <code>ad-creative-studio-for-claude.zip</code>'
          ]),
          P('It appears under <strong>Created by you</strong> and is now on your account — available in <strong>Chat, Cowork and Claude Code</strong>, on any machine you sign in to.'),
          H2('What you need'),
          UL([
            'A <strong>paid Claude account</strong> (Pro or higher)',
            'The <strong>Claude desktop app</strong> on Windows or Mac',
            '<em>Optional:</em> an image generator connected to Claude, for the photo-style ads'
          ]),
          H2('If you see “Unknown skill”'),
          P('That happens when the plugin was added from a folder rather than uploaded — a Claude Code-only route. Remove it and upload the zip through <strong>Settings → Plugins</strong> instead, and it will work everywhere.'),
          NOTE('There is nothing to download again later. Updates come as a new zip you upload the same way.')
        ]
      },
      {
        title: 'Make an Ads folder',
        minutes: 2,
        body: [
          P('Your ads are saved as real files — PNGs, the ad copy, a CSV for Ads Manager — so Claude needs somewhere to put them.'),
          OL([
            'Make a folder called <strong>Ads</strong>, in Documents or wherever suits',
            'Start a new <strong>Cowork task</strong> in Claude',
            'Click <strong>Add folder</strong> and choose <strong>Ads</strong>'
          ]),
          H2('What ends up in there'),
          PRE('ad-studio/\n  2026-03-14-launch/\n    ads.md          the copy for every ad\n    ads.csv         one row per ad, for Ads Manager\n    prompts.md      image prompts, when no generator is connected\n    *.png           the finished images\n    *.html          the page you export the images from'),
          P('Every batch gets its own dated folder, so last month’s ads are still there when you want to see what you ran.'),
          NOTE('Do this before setup rather than after. Setup checks for a folder as its first step, and without one your ads have nowhere to land.')
        ]
      },
      {
        title: 'Start here: type “set up ad studio”',
        minutes: 3,
        body: [
          P('This is the whole of getting started. In your Ads task, type:'),
          PRE('set up ad studio'),
          P('Claude then walks you through <strong>six short steps, one message at a time</strong>, and makes your first five ads at the end of it. About ten minutes, and you only do it once.'),
          H2('The six steps'),
          UL([
            '<strong>1 · Folder</strong> — nothing to do, Claude checks it',
            '<strong>2 · Your offer</strong> — paste your sales page link',
            '<strong>3 · Your proof</strong> — tick what you really have',
            '<strong>4 · Your look</strong> — confirm the colours it took from your page',
            '<strong>5 · Ads you like</strong> — send screenshots of ads worth copying the style of',
            '<strong>6 · Images</strong> — pick how the photo-style ads get made'
          ]),
          H2('Two things worth knowing'),
          UL([
            '<strong>Only step 2 is required.</strong> Everything else can be skipped, and it tells you at the end what each skipped step costs you.',
            '<strong>You can stop halfway.</strong> Progress is saved after every step, so you can close it and pick up later.'
          ]),
          H2('If you skip setup entirely'),
          P('Ask for ads without having set up, and it starts the guided setup for you rather than guessing at your offer. There is no way to get ads built on invented facts, which is the point.'),
          NOTE('The next three lessons walk through what each step is actually asking for, and why. You can do the setup first and read them after — they are the same six steps either way.')
        ]
      }
    ]
  },
  {
    name: 'SECTION 2 · The six setup steps',
    label: 'Section 2',
    lessons: [
      {
        title: 'Your offer, and what happens after purchase',
        minutes: 4,
        body: [
          P('Step 2, and the only one you cannot skip. Paste the link to your sales page and Claude reads it — your offer, the price, who it is for, the guarantee.'),
          H2('Then it asks you one question'),
          P('<strong>What happens after someone buys?</strong> A one-time purchase, a trial that becomes a subscription, or an upsell afterwards.'),
          P('This matters more than it looks. If your $1 offer starts a trial that bills monthly, the ad has to say so — an ad that hides it buys you chargebacks and a complaint to Meta. Answer it honestly and every ad states it clearly.'),
          H2('No sales page?'),
          P('One sentence about what you sell and the price is enough to get started. You can add the rest later.'),
          H2('When your price changes'),
          PRE('my price changed to $37'),
          P('That updates the setup. An out-of-date profile is the single most common reason an ad comes out with the wrong number in it.'),
          NOTE('If an ad ever shows a price you do not recognise, fix the setup rather than the ad — otherwise the next batch gets it wrong again.')
        ]
      },
      {
        title: 'Your proof, and what it will never say',
        minutes: 4,
        body: [
          P('Step 3 is a checklist of what you actually have: reviews, buyer numbers, results, testimonials. Tick what is real. <strong>“None yet” is a fine answer</strong> and handled properly.'),
          H2('Because it will not invent any of it'),
          UL([
            'Buyer counts, review counts or star ratings',
            'Income claims or earnings you have not evidenced',
            'Deadlines and scarcity that are not real',
            'Guarantees you did not say you offer'
          ]),
          P('Invented proof is the fastest route to a Meta rejection, a refund request, or a complaint you cannot answer. So if you want a number in your ads, it has to go in here.'),
          H2('It checks itself too'),
          P('Every ad is run against Meta’s most common rejection reasons before you see it — no personal attributes (“are you overweight?”), no income promises, no fake countdowns.'),
          NOTE('“1,900 members” in your setup becomes “1,900 members” in the ad. Nothing in your setup means nothing in the ad, which is the right failure.')
        ]
      },
      {
        title: 'Your look, and the ads you like',
        minutes: 5,
        body: [
          P('<strong>Step 4</strong> is quick: Claude shows you the colours it lifted from your page. Say “looks good”, or correct them. Then pick how much emoji you want — including none.'),
          H2('Step 5 is the one that matters most'),
          P('Send <strong>3–10 screenshots</strong> of ads whose style you would happily copy. This is the single biggest quality jump in the whole setup, because your ads start from layouts that are already selling rather than from a default.'),
          H2('Where to find ads worth sending'),
          UL([
            'Screenshot ads you actually stop on in your own feed. Saved posts count.',
            'Or go to <strong>facebook.com/ads/library</strong>, search a big name in your niche, and take the ones marked <strong>“Started running”</strong> more than 30 days ago — nobody keeps paying for an ad that does not sell.',
            '<strong>Your own best ads count most.</strong> Add what each cost per sale, if you know it.'
          ]),
          H2('It also asks your target cost per sale'),
          P('Give it a real number. It is what your results get judged against later, so “is this working?” has an answer rather than an opinion.'),
          H2('What it keeps from those screenshots'),
          P('The technique, never the ad. It stores the layout and the hook shape — not the brand, the image or the words — so what you get back is your offer in that style, not somebody else’s ad with your logo on it.'),
          NOTE('Skip this step and the ads still work. They are just generic, and you will feel it.')
        ]
      },
      {
        title: 'Images: with a generator, or without',
        minutes: 3,
        body: [
          P('Step 6. Claude checks whether you have an image generator connected and explains your options.'),
          H2('With one connected'),
          P('Photo-style ads — product mockups, hands holding the thing, creator-style shots — are generated for you, using whatever you have connected (Higgsfield, for example).'),
          H2('Without one'),
          P('You still get every ad. The built-in designs are laid out as real type in a browser, so those are finished either way. For the photo-style ones you get the finished prompt in <code>prompts.md</code> to paste into ChatGPT, Ideogram or any image tool.'),
          H2('Then it scores your setup'),
          P('At the end you get a setup score showing what each skipped step is costing you. It is worth reading — it tells you exactly which five minutes would most improve your ads.'),
          NOTE('And then it offers your first five ads. Say yes.')
        ]
      }
    ]
  },
  {
    name: 'SECTION 3 · Making ads',
    label: 'Section 3',
    lessons: [
      {
        title: 'Your first five ads',
        minutes: 5,
        body: [
          P('Setup ends by asking <strong>“Want your first 5 ads now?”</strong> Say yes, and you have them in about two minutes.'),
          P('After that, a fresh batch is one line:'),
          PRE('make 5 new ads'),
          P('It picks the angles, writes the hooks, writes the copy, makes the images and saves everything in a dated folder. Five is the right number — enough to tell you something, few enough to launch today.'),
          H2('What comes back'),
          UL([
            'Five ads, each testing a <strong>different hook type or a different style</strong> — never both the same',
            'At least <strong>three different styles</strong> in a batch of five, so the test is not five versions of one idea',
            '<code>ads.md</code> with the copy, <code>ads.csv</code> for upload, and the images'
          ]),
          H2('Asking for something specific'),
          PRE('make 5 ads, mostly receipts and value stacks\nmake 3 story-format ads for my webinar\nmore like ad 3'),
          P('It will follow the steer. Where you say nothing, it picks from the styles that tend to run longest for offers like yours.'),
          H2('The commands worth remembering'),
          PRE('make 5 new ads                      a fresh batch\nmore like ad 3                      new versions of a winner\nlearn from these ads  + screenshots new styles into your library\nmy price changed to $37             updates your setup\nhere are my results   + screenshot  what is working, what next'),
          NOTE('Do not ask for twenty ads on day one. You cannot read the results of twenty ads, and you will spend the budget learning nothing.')
        ]
      },
      {
        title: 'Hooks — what each ad is actually testing',
        minutes: 4,
        body: [
          P('A hook is the angle: the reason someone stops. Ad Creative Studio works from <strong>16 hook types</strong>, and every ad in a batch is tagged with the one it is testing.'),
          P('That tag is the point. Five ads with five hooks tells you which <em>argument</em> works. Five ads with one hook and five pictures only tells you which picture works, which is worth much less.'),
          H2('Seeing them before you commit'),
          PRE('give me 10 hooks for my offer'),
          P('You get them scored, so you can pick the strongest rather than the cleverest. The two are rarely the same.'),
          H2('Where a hook shows up'),
          P('One hook runs through the whole ad — the headline on the image, the first line of the primary text, and the headline field under it. They are three expressions of one idea, not three different ideas.'),
          H2('When one wins'),
          P('Make more ads with that hook and different styles. That is how you find out whether it was the argument or the picture, and it is the fastest way to a second winner.'),
          NOTE('If you only remember one thing: vary the hook, not the font.')
        ]
      },
      {
        title: 'The copy that runs with the image',
        minutes: 4,
        body: [
          P('Every ad comes with its full set of Meta copy, written to the shapes long-running ads actually use.'),
          H2('What you get'),
          UL([
            '<strong>Primary text, long</strong> — the full argument, for people who read',
            '<strong>Primary text, short ×2</strong> — one pain-led, one outcome-led',
            '<strong>Headline</strong>, 27–40 characters',
            '<strong>Description</strong>, 30 characters or fewer',
            'The <strong>CTA button</strong> to select'
          ]),
          H2('The first line does the work'),
          P('Meta truncates the primary text at roughly 125 characters. Line one has to stand on its own and <em>extend</em> the image rather than repeat it — if the image already says “$27”, line one should not.'),
          H2('Emoji as structure, not decoration'),
          P('Used the way the ads that keep running use them: ✅ for a list, 👉 pointing at the call to action, at most one per line and rarely in the opening line. Your profile decides how much of this you want, including none.'),
          H2('Changing it'),
          PRE('rewrite ad 3 shorter and angrier\ngive me two more versions of the primary text on ad 1'),
          NOTE('The price is named in the copy on purpose. Ads that hide the price buy you clicks from people who were never going to pay it.')
        ]
      },
      {
        title: 'Getting the images out',
        minutes: 4,
        body: [
          P('The batch folder has an <code>.html</code> file. That is the export page — open it in your browser.'),
          OL([
            'Tick the formats you want — <strong>feed 4:5</strong>, <strong>story 9:16</strong>, square',
            'Click <strong>Download all PNGs</strong>',
            'They land in your downloads folder, named to match the rows in <code>ads.csv</code>'
          ]),
          H2('The sizes, and why'),
          UL([
            '<strong>Feed 4:5 — 1080 × 1350.</strong> The default. Takes up the most room in the feed',
            '<strong>Story 9:16 — 1080 × 1920.</strong> Text is kept out of the top 250px and bottom 340px, where the profile bar and the CTA button sit',
            '<strong>Square 1:1 — 1080 × 1080.</strong> Marketplace and right column'
          ]),
          H2('If nothing downloads'),
          P('The export page needs an internet connection the first time, to load the fonts and the export library. Offline, the button does nothing.'),
          H2('If a photo-style ad came out as a design'),
          P('No image generator is connected. The finished prompt is sitting in <code>prompts.md</code> — paste it into ChatGPT, Higgsfield or Ideogram and drop the result back in the folder.'),
          NOTE('Check the spelling on any AI-generated image before it goes live. Generators swap digits — $1 becomes $7 — and the plugin flags it, but your eyes are the last check.')
        ]
      }
    ]
  },
  {
    name: 'SECTION 4 · Running them',
    label: 'Section 4',
    lessons: [
      {
        title: 'Launching: one ad set, three days',
        minutes: 4,
        body: [
          P('There is one right way to launch a batch of five, and it is not five ad sets.'),
          OL([
            'In Ads Manager, create <strong>one ad set with all five ads in it</strong>',
            'Use the budget from the test plan at the end of <code>ads.md</code>',
            'Copy each ad’s text from <code>ads.md</code> — <code>ads.csv</code> has one row per ad if you prefer to paste from a sheet',
            '<strong>Leave it alone for three days.</strong>'
          ]),
          H2('Why one ad set'),
          P('Most first tests fail because five ads were spread across five ad sets and none got enough budget to prove anything. One ad set lets Meta spend where it is working, and three days is the shortest honest read.'),
          H2('Feed and story in one ad'),
          P('When the ad set runs Advantage+ placements, upload <strong>both</strong> images into the same ad as placement-specific assets. One ad, two sizes — not two ads.'),
          H2('Before you spend'),
          UL([
            'Every price in the image matches what the page actually charges',
            'The link goes to the page the ad is about',
            'Recurring charges are disclosed if the offer has them'
          ]),
          NOTE('Keep the batch folder. When you come back in three weeks to ask what worked, the answer is in it.')
        ]
      },
      {
        title: 'Reading results and what to make next',
        minutes: 4,
        body: [
          P('After the three days, paste the numbers back in. A screenshot of Ads Manager is enough.'),
          PRE('what\'s working?'),
          P('It reads which ads won, says what it thinks they had in common — the hook, the style, or neither — and tells you what to make next.'),
          P('It tells you which ads won, which to turn off, and what to make next — judged against the target cost per sale you gave it during setup, so the answer is a number rather than an opinion.'),
          H2('What it is looking at'),
          UL([
            'Which <strong>hook types</strong> earned their spend, not just which ads did',
            'Whether a style is carrying several ads or just one',
            'Whether anything is fatiguing, and what to replace it with'
          ]),
          H2('The loop'),
          P('A winner is not the end of a test, it is the start of the next one. Take the hook that won and make new ads in different styles; take the style that won and run it against new hooks. That is how one good ad turns into a month of them.'),
          H2('Judging too early'),
          P('The commonest mistake, and the reason the last lesson said three days. An ad that looks dead on day one often is not, and killing it teaches you nothing.'),
          NOTE('Ask again whenever you have fresh numbers. It keeps your winners in your library, so later batches start from what already worked for you.')
        ]
      }
    ]
  }
];

/* ---------------- write it ---------------- */

let n = 0, minutes = 0, sort = 0;
const tree = { title: 'Claude Ad Creative Studio', sections: [], stats: null };

for (const sec of sections) {
  const lessons = [];
  for (const l of sec.lessons) {
    n += 1;
    minutes += l.minutes;
    const num = String(n).padStart(2, '0');
    const libId = `lesson:ad-creative-studio-${num}`;

    await upsertLibraryItem({
      id: libId,
      kind: 'lesson',
      course: SLUG,
      category: sec.label,
      title: l.title,
      description: null,
      bodyHtml: l.body.join(''),
      sort: sort++,
      requires: ENTITLEMENT,
      testersOnly: TESTERS_ONLY
    });

    lessons.push({ libId, lessonId: `as-${num}`, title: l.title });
    console.log(`  + ${libId}  ${l.title}`);
  }
  tree.sections.push({ name: sec.name, label: sec.label, lessons });
}

tree.stats = { lessons: n, minutes, sections: sections.length };

await upsertCourse({
  slug: SLUG,
  title: 'Claude Ad Creative Studio',
  lessonCount: n,
  // Straight after Carousel Studio, the other add-on course, and before the
  // membership's own courses.
  sort: 7,
  data: tree,
  requires: ENTITLEMENT,
  testersOnly: TESTERS_ONLY
});

console.log(`\ndone — ${n} lessons in ${sections.length} sections, ~${minutes} min.`);
if (TESTERS_ONLY) {
  console.log('Visible to the test account and staff only. Nobody else can see that it exists.');
  console.log('Run again with --live to announce it to everyone.\n');
} else {
  console.log(`Live. Open to anyone holding '${ENTITLEMENT}', which a membership now includes.\n`);
}
