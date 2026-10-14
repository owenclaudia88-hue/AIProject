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
        title: 'Pick a folder for your ads',
        minutes: 2,
        body: [
          P('Ad Creative Studio writes real files: PNGs, the ad copy, a CSV for Ads Manager. They land in whatever folder Claude currently has open.'),
          P('Make one folder now — <code>Documents\\Ads</code> is fine — and connect Claude to it before you ask for anything.'),
          H2('What ends up in there'),
          PRE('ad-studio/\n  2026-03-14-launch/\n    ads.md          the copy for every ad\n    ads.csv         one row per ad, for Ads Manager\n    prompts.md      image prompts, when no generator is connected\n    *.png           the finished images\n    *.html          the page you export the images from'),
          P('Every batch gets its own dated folder, so last month’s ads are still there when you want to see what you ran.'),
          NOTE('Do this before your first batch rather than after. Moving files later breaks the links in ads.md.')
        ]
      }
    ]
  },
  {
    name: 'SECTION 2 · Your offer, once',
    label: 'Section 2',
    lessons: [
      {
        title: 'Your ad profile in two minutes',
        minutes: 4,
        body: [
          P('This is the one step that decides whether the ads are any good. Do it once, and every ad afterwards knows your price, your audience and your proof.'),
          H2('The fast way'),
          PRE('Read mypage.com and set up my ad profile'),
          P('It reads your sales page and fills in most of it. You correct what it got wrong.'),
          H2('Or answer the questions'),
          PRE('/ad-creative-studio:ad-brand'),
          H2('What it saves'),
          UL([
            'Your <strong>offer and its price</strong>, and what happens after someone buys',
            'Who it is for, and which <strong>countries</strong> you sell to',
            'Your <strong>real proof</strong> — numbers you can stand behind',
            'Your <strong>guarantee</strong>, if you have one',
            'Tone, how much emoji you want, and your <strong>colours</strong>'
          ]),
          P('Come back and run it again whenever your price changes. An out-of-date profile is the single most common reason an ad comes out with the wrong number in it.'),
          NOTE('Spend the two minutes. Every ad you ever make from here reads this file.')
        ]
      },
      {
        title: 'What it will never say',
        minutes: 3,
        body: [
          P('The plugin only uses facts from your profile. If something is not in there, it stays out of the ad — it does not fill the gap with something plausible.'),
          H2('It will not invent'),
          UL([
            'Buyer counts, review counts or star ratings',
            'Income claims or earnings you have not evidenced',
            'Deadlines and scarcity that are not real',
            'Guarantees you did not say you offer'
          ]),
          P('This matters more than it sounds. Invented proof is the fastest route to a Meta rejection, a refund request, or a complaint you cannot answer.'),
          H2('It also checks itself'),
          P('Every ad is run against Meta’s most common rejection reasons before you see it — no personal attributes (“are you overweight?”), no income promises, no fake countdowns.'),
          H2('So if you want proof in the ad, put it in the profile'),
          P('Real numbers belong in your profile where the ads can reach them. “1,900 members” in the profile becomes “1,900 members” in the ad. Nothing in the profile means nothing in the ad, which is the right failure.'),
          NOTE('If an ad ever shows a price or a claim you do not recognise, your profile is stale. Re-run ad-brand rather than editing the ad.')
        ]
      },
      {
        title: 'Show it ads you like',
        minutes: 4,
        body: [
          P('Optional, and the thing that makes the biggest difference after the profile. You can teach it from real ads — your own winners, or any ad you have saved.'),
          PRE('learn from these ads'),
          P('Then paste screenshots, or Meta Ad Library links. It breaks each one down into a reusable recipe — the layout, the hook type, how the copy is structured — and files it in <strong>your</strong> library. Later batches start from those first.'),
          H2('What is worth teaching it'),
          UL([
            'Your own ads that actually performed, so it makes more of what already works',
            'Competitor ads that have clearly been running a long time',
            'Any ad whose <em>look</em> you want, even from another industry'
          ]),
          H2('What it keeps'),
          P('The technique, never the ad. It stores the layout and the hook shape, not the brand, the image or the words — so what you get back is your offer in that style, not somebody else’s ad with your logo on it.'),
          NOTE('Three or four good examples is plenty to change the character of everything it makes.')
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
          P('With the profile done, this is the whole job in one line:'),
          PRE('make 5 ads for my $27 guide'),
          P('It picks the angles, writes the hooks, writes the copy, makes the images and saves everything in a dated folder. Five is the right first number — enough to tell you something, few enough to launch today.'),
          H2('What comes back'),
          UL([
            'Five ads, each testing a <strong>different hook type or a different style</strong> — never both the same',
            'At least <strong>three different styles</strong> in a batch of five, so the test is not five versions of one idea',
            '<code>ads.md</code> with the copy, <code>ads.csv</code> for upload, and the images'
          ]),
          H2('Asking for something specific'),
          PRE('make 5 ads, mostly receipts and value stacks\nmake 3 story-format ads for my webinar\nsame offer, 5 new angles — nothing like last batch'),
          P('It will follow the steer. Where you say nothing, it picks from the styles that tend to run longest for offers like yours.'),
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
        title: 'Launching in Ads Manager',
        minutes: 4,
        body: [
          P('Upload each image with its copy. <code>ads.csv</code> holds one row per ad so you are copying and pasting, not rewriting.'),
          PRE('ad_name, style, hook_type, image_feed, image_story,\nprimary_text_long, primary_text_short, headline,\ndescription, cta_button, url'),
          H2('Feed and story in one ad'),
          P('When an ad set runs Advantage+ placements, upload <strong>both</strong> images into the same ad as placement-specific assets. One ad, two sizes — not two ads.'),
          H2('How to group them'),
          P('The end of <code>ads.md</code> has a test plan: which ads belong in one ad set, what to spend, and when to judge them. Follow it rather than inventing a structure — most first tests fail because five ads were spread across five ad sets and none got enough budget to prove anything.'),
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
          P('When the numbers are in, paste them back in. A screenshot of Ads Manager is enough.'),
          PRE('here are my results, what\'s working?'),
          P('It reads which ads won, says what it thinks they had in common — the hook, the style, or neither — and tells you what to make next.'),
          H2('What it is looking at'),
          UL([
            'Which <strong>hook types</strong> earned their spend, not just which ads did',
            'Whether a style is carrying several ads or just one',
            'Whether anything is fatiguing, and what to replace it with'
          ]),
          H2('The loop'),
          P('A winner is not the end of a test, it is the start of the next one. Take the hook that won and make new ads in different styles; take the style that won and run it against new hooks. That is how one good ad turns into a month of them.'),
          H2('Judging too early'),
          P('The commonest mistake. Give the test plan’s window the chance to run before you switch anything off — an ad that looks dead on day one often is not, and killing it teaches you nothing.'),
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
