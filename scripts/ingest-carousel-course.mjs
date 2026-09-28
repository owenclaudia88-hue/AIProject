/**
 * Build the Claude Carousel Studio course in the member area.
 *
 *   node --env-file=.env.local scripts/ingest-carousel-course.mjs
 *
 * Writes one library row per lesson (kind 'lesson', gated on the
 * `carousel-studio` entitlement, which is what carries the body text) and one
 * courses row holding the section tree. Re-runnable: everything upserts by id,
 * so editing a lesson below and running again replaces it.
 *
 * Text-only by design — the player hides its video frame for a lesson with no
 * videoId, so these read as written pieces rather than empty players.
 */
import { upsertLibraryItem, upsertCourse } from '../lib/db.js';

const SLUG = 'claude-carousel-studio';
const ENTITLEMENT = 'carousel-studio';
const AFF = 'https://blotato.com/?ref=aifounderuniversity';

/* Kept out of the copy below so a rename is one edit, not fourteen. */
const P = (s) => `<p>${s}</p>`;
const H2 = (s) => `<h2>${s}</h2>`;
const H3 = (s) => `<h3>${s}</h3>`;
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
          P('Carousel Studio is a Claude plugin. You describe a post — or paste your website — and it writes the copy, designs every slide, renders them as real image files, and writes the caption to go with them. You get PNGs you can upload straight to Instagram, or a PDF for a LinkedIn document post.'),
          P('It is not a template pack and it is not a prompt. It is eight skills that Claude loads and runs for you.'),
          H2('What it makes'),
          UL([
            '<strong>Instagram carousels</strong> at 1080 × 1350, the 4:5 ratio that takes up the most room in the feed',
            '<strong>LinkedIn document posts</strong> at 1080 × 1080, exported as a PDF',
            '<strong>The caption</strong> for each post, written for both platforms, with the call to action',
            '<strong>A month at a time</strong> — topics, copy, images and a <code>schedule.csv</code> you can import into a scheduler'
          ]),
          H2('Why the slides are typography, not AI images'),
          P('Image models still cannot spell reliably at headline size. Every carousel that works is type laid out properly, so Carousel Studio renders each slide as real text in a browser and exports it at full resolution. Photographs sit <em>behind</em> the type, where a model is good.'),
          H2('The one thing to do first'),
          P('Set up your brand. It takes two minutes, you only do it once, and every carousel afterwards uses your colours, your voice, your logo and your calls to action automatically. Section 2 covers it.'),
          NOTE('Everything the plugin writes lands in whatever folder Claude has open. Make one folder for your content and point Claude at it, or you will be hunting for files later.')
        ]
      },
      {
        title: 'Install it',
        minutes: 4,
        body: [
          P('Two routes. The first is easier and works everywhere; the second is for people who live in the terminal.'),
          H2('Upload it to your Claude account — recommended'),
          P('Keep the zip as it is. Do not unzip it.'),
          OL([
            'Open the <strong>Claude desktop app</strong>',
            '<strong>Settings</strong> → <strong>Plugins</strong>',
            '<strong>Add</strong> (top right) → <strong>Upload plugin</strong>',
            'Choose <code>carousel-studio-for-claude.zip</code>'
          ]),
          P('It appears under <strong>Created by you</strong> and is now on your account — available in <strong>Chat, Cowork and Claude Code</strong>, on any machine you sign in to.'),
          H2('Or add it as a local plugin — Claude Code only'),
          P('Use this if you want to modify the plugin. A plugin added from a folder on your computer stays on that computer, so Chat and Cowork will not see it.'),
          PRE('claude plugin marketplace add C:\\Users\\YOURNAME\\Downloads\\carousel-studio-for-claude\nclaude plugin install carousel-studio-for-claude'),
          P('On a Mac, swap the path for <code>~/Downloads/carousel-studio-for-claude</code>.'),
          P('<strong>Then restart Claude Code.</strong> Plugins load at startup, and this is the step people skip.'),
          H2('Check it worked'),
          P('Ask for a carousel in plain words. If Claude knows what you mean, it is installed. In Claude Code you can also run <code>claude plugin list</code> and look for eight skills.'),
          H2('If the skills do not appear'),
          UL([
            '<strong>Restart Claude Code.</strong> Nothing happens until you do.',
            '<strong>"Unknown skill: carousel-studio…"</strong> — you installed it the local way, which is Claude Code only, and you are in Chat or Cowork. Upload the zip through Settings → Plugins instead.',
            '<strong>You updated the plugin and nothing changed.</strong> Installed plugins are a cached copy pinned to a version. Upload the new zip again.'
          ])
        ]
      }
    ]
  },

  {
    name: 'SECTION 2 · Set up your brand (once)',
    label: 'Section 2',
    lessons: [
      {
        title: 'Your brand in two minutes',
        minutes: 4,
        body: [
          P('This is the difference between carousels that look like yours and carousels that look like a tool. You do it once. Every carousel afterwards reads the profile automatically.'),
          H2('If you have a website — do this one'),
          P('Paste your URL:'),
          PRE('Read mysite.com and set up my brand'),
          P('It reads the site and fills in your products and prices, your voice, your audience, your brand colours, your logo and any real testimonials it finds. Faster and more accurate than answering questions, because it is reading what you already wrote.'),
          H2('If you do not have a site'),
          PRE('/carousel-studio:carousel-brand'),
          P('A couple of minutes of short questions. Answer briefly — it fills the gaps with sensible defaults and tells you which ones it used.'),
          H2('What it writes'),
          P('A file at <code>carousel-studio/brand-profile.md</code> in your folder. You can open and edit it by hand any time. The fields that do the most work are the unglamorous ones:'),
          UL([
            '<strong>Audience</strong> — be specific. "Founders" is not an audience. "Solo founders doing their own marketing, 0–3 staff" is.',
            '<strong>Never Say</strong> — words, claims and angles that are off limits. This is a hard filter, not a preference. Put the tired ones in: unlock, level up, game changer, dive in.',
            '<strong>Products</strong> — what is actually for sale, with real prices. This is what the calls to action point at.',
            '<strong>Preferred CTAs</strong> — the exact wording you use.'
          ]),
          H2('Proof — read this bit'),
          P('There are two fields for <strong>Testimonials</strong> and <strong>Ratings</strong>. Anything you put there gets used freely on review slides and star rows, without asking you again. Anything not there is never invented.'),
          P('That is deliberate. Fabricated testimonials and star ratings are a banned practice under the FTC\'s 2024 reviews rule and the UK\'s DMCC Act, and the liability lands on whoever posts them, not on the tool. If you want a placeholder to see how a review slide looks, ask for a sample one — it renders with a red dashed outline and a "Sample — replace" tag baked into the image, so you cannot post it by accident.'),
          NOTE('Paste testimonials one per line as: Name | Source | Stars | Quote')
        ]
      },
      {
        title: 'Colours, fonts and your logo',
        minutes: 4,
        body: [
          H2('Colours'),
          P('Hex codes or plain words both work. "Warm, earthy, low contrast" is usable direction; so is <code>#14110F on #FBF7F1, accent #FF5A1F</code>.'),
          P('Your brand colour always wins over the preset\'s. If your colour would be unreadable — a pale yellow on white — it keeps your colour and moves the background instead, and tells you it did.'),
          H2('Fonts'),
          P('Must be on Google Fonts, or they quietly fall back to Inter. If your brand font is not there, it uses Inter and says so.'),
          H2('Your logo — nobody volunteers this one'),
          P('Put a <strong>PNG with a transparent background</strong>, or an SVG, in your folder and say so:'),
          PRE('my logo is logo.png'),
          P('It goes in the lockup at the top of the cover and in the footer of every slide, and on a photo slide it knocks out to white automatically. Without one you get your brand initial in a coloured chip — fine, but generic.'),
          P('Keep the file in the same folder as your carousels. A logo living somewhere else on disk stops the PNG export working, because the browser will not let the page read an image from another location.'),
          H2('Changing it later'),
          P('Say what you want in plain words — "make my carousels use my new green", "my logo changed". It edits the profile and the change sticks for every carousel after.')
        ]
      },
      {
        title: 'Show it carousels you like',
        minutes: 5,
        body: [
          P('This is the setting most people skip and the one that stops your posts looking like everyone else\'s.'),
          P('Colours alone do not do it. Two brands on the same preset with different colours still read as the same template. What actually separates them is <strong>shape</strong> — corner radius, line weight, headline case, how much space there is.'),
          H2('Give it examples'),
          P('During brand setup, show it two or three carousels whose look you like. Screenshots pasted into the chat, Instagram links, or just a description:'),
          PRE('I like carousels that look like this: cream background, sharp square\ncorners, really thin hairline rules, big serif headlines in all caps,\nlots of white space'),
          P('It reads the shape off what you show it and writes a <strong>Style Recipe</strong> into your brand profile — one line that every future carousel starts from:'),
          PRE('preset: paper | radius: sharp | borders: hairline | headCase: upper | density: airy'),
          H2('The four questions, if you would rather just answer them'),
          UL([
            '<strong>Corners</strong> — square, softly rounded, or pill-round?',
            '<strong>Lines</strong> — hairlines that almost disappear, or thick confident strokes?',
            '<strong>Headlines</strong> — ALL CAPS, or sentence case?',
            '<strong>Space</strong> — wide margins with air, or edge to edge and packed?'
          ]),
          H2('Or pick a vibe'),
          P('<strong>Clean &amp; minimal</strong> · <strong>Bold &amp; punchy</strong> · <strong>Soft &amp; editorial</strong> · <strong>Playful &amp; colourful</strong> · <strong>Dark &amp; moody</strong>'),
          H2('Ten visual presets sit underneath'),
          P('<code>editorial</code>, <code>terminal</code>, <code>brutal</code>, <code>paper</code>, <code>midnight</code>, <code>mint</code>, <code>ink</code>, <code>marker</code>, <code>luxe</code> and <code>scrapbook</code>. It picks one from your niche — a developer post is not dressed like a wellness post — and then your recipe and your colours sit on top.'),
          H2('Changing it'),
          P('"Make my carousels rounder", "less shouty", "give them more air". Each maps to one field, and it updates the profile so the change lasts beyond one deck.'),
          NOTE('Reading the shape off a reference is not copying it. It never reproduces someone else\'s logo, photography or copy.')
        ]
      }
    ]
  },

  {
    name: 'SECTION 3 · Making carousels',
    label: 'Section 3',
    lessons: [
      {
        title: 'Your first carousel',
        minutes: 3,
        body: [
          P('Plain words. No format, no keywords, no prompt to memorise:'),
          PRE('carousel about the three mistakes people make when pricing a service'),
          P('It works out the format, writes the copy, designs the slides, builds the graphics and hands you a file. You do not have to say how many slides, which layout, or what style — that is the job.'),
          H2('Topics are optional'),
          P('If you do not have one, do not invent one:'),
          PRE('build me a carousel for my product'),
          P('It reads your brand profile and picks something worth posting.'),
          H2('Turning something you already have into a carousel'),
          PRE('turn this into a carousel: <paste an article, a newsletter, a transcript, a URL>'),
          H2('Asking for changes'),
          P('Say what is wrong in plain words — "slide 4 is weak", "make the cover hit harder", "too corporate". It edits the file in place and re-renders. It does not start over and it does not leave you with two versions.'),
          H2('What you get back'),
          P('A path like <code>carousel-studio/pricing-mistakes/pricing-mistakes.html</code>, plus <code>caption.md</code> next to it. The next lesson covers turning that into images.')
        ]
      },
      {
        title: 'A month in one go',
        minutes: 4,
        body: [
          P('This is where the plugin earns its keep.'),
          PRE('build me a month of carousels for my website and products'),
          P('It plans the calendar first — a mix of teaching, proof, story and offer posts rather than thirty variations of the same idea — then writes every post, renders every deck, and writes the captions.'),
          H2('You get'),
          UL([
            'One folder per post, each with its HTML deck and its caption',
            '<code>schedule.csv</code> — dates, times and captions, ready to import into Buffer, Later, Metricool or whatever you use',
            'A calendar you can look at before anything gets made, if you ask to see it first'
          ]),
          H2('Say what you want it built from'),
          PRE('a month of carousels for mysite.com — push the $37 pack in\nweek 2 and week 4, and keep Fridays personal'),
          H2('Do it in batches if you would rather'),
          P('"Give me the first week" works. So does "the calendar first, then we will do the copy".'),
          NOTE('A month is where sameness shows up fastest. If two posts come back looking like the same deck with different words, say so — that is a fair complaint and it will rebuild them.')
        ]
      },
      {
        title: 'Getting your images out',
        minutes: 4,
        body: [
          P('Open the HTML file it gave you — double-click it, it opens in your browser. You will see every slide laid out.'),
          H2('Two buttons at the top'),
          UL([
            '<strong>Download all PNGs</strong> — one image per slide, numbered in order, into your Downloads folder. This is what you post to Instagram.',
            '<strong>Save as PDF</strong> — for LinkedIn document posts.'
          ]),
          H2('PDF settings that matter'),
          P('In the print dialog set <strong>Margins: None</strong> and <strong>Background graphics: on</strong>. Miss either and you get white borders or missing colour. Chrome and Edge give the cleanest result; Safari margins are unreliable.'),
          H2('Upload them in order'),
          P('They are numbered <code>01</code>, <code>02</code>, <code>03</code>. Sort by name before you upload, or Instagram will take them in whatever order your file picker feels like.'),
          H2('Having it export for you'),
          P('In Claude Code you can skip the button:'),
          PRE('export the PNGs to disk yourself, don\'t make me click the button'),
          P('It runs a small local server, renders every slide and writes the files into the deck\'s own folder. This needs to run a process on your machine, so it works in Claude Code and not in Chat.'),
          H2('If the download does nothing'),
          P('The page needs a connection the first time, to load its fonts and the rendering library. Check you are online and reload.')
        ]
      },
      {
        title: 'Captions, CTAs and comment keywords',
        minutes: 4,
        body: [
          P('The carousel is half the post. Every deck comes with <code>caption.md</code> next to it, written for both platforms.'),
          H2('What a caption looks like'),
          P('Not a wall of prose. First line works as a hook on its own, blank lines between paragraphs, emoji as anchors rather than decoration, and the call to action on its own line. Instagram and LinkedIn versions are genuinely rewritten rather than copy-pasted — "link in bio" does not exist on LinkedIn.'),
          H2('The closing ask'),
          P('Every deck ends with <strong>one</strong> ask, matched to what the post is for:'),
          UL([
            '<strong>Saves</strong> — "Save this for the next time you…" Right for a genuine reference post.',
            '<strong>Leads</strong> — "Comment PRICING and I\'ll send it over." The strongest one on Instagram: the comment feeds reach and the DM starts a conversation.',
            '<strong>Traffic or sales</strong> — points at your product, named, not "link in bio" with no reason to click.',
            '<strong>Follows</strong> — says what they will get, not "follow for more tips".'
          ]),
          H2('Comment keywords change with the topic'),
          P('A pricing post asks for <code>PRICING</code>, a setup post asks for <code>SETUP</code>. The phrasing rotates too. The same word on every post reads as a bot.'),
          P('<strong>The word has to be backed by something that exists.</strong> If you have not got the guide, it will not invent one — it will point at a real product or ask a real question instead.'),
          H2('Ask for a different ask'),
          PRE('make the last slide push the course instead of a save'),
          NOTE('If every post comes back ending on "save this", say so. A brand with something to sell should not end every post on a save.')
        ]
      }
    ]
  },

  {
    name: 'SECTION 4 · Auto-schedule with Blotato',
    label: 'Section 4',
    lessons: [
      {
        title: 'Why Blotato',
        minutes: 3,
        body: [
          P('Once your carousels are exported as PNGs you still have to get them posted. <a href="' + AFF + '" target="_blank" rel="noopener">Blotato</a> is what I use — it connects directly to Claude as an MCP server, so you can schedule to Instagram, TikTok, LinkedIn and more without leaving the session you just built the carousels in.'),
          P('That is the part worth paying attention to. Most schedulers mean exporting files, opening another tab, uploading, pasting the caption and setting a time, for every post. With Blotato connected, you finish a month of carousels and then say "schedule these" in the same conversation.'),
          H2('What it covers'),
          UL([
            'Instagram, TikTok, LinkedIn, Facebook, X, YouTube, Threads, Pinterest and more',
            'Carousels as multi-image posts, which is the bit most tools get wrong',
            'Scheduling ahead, so a month of posts goes out on the dates you planned'
          ]),
          H2('Get an account'),
          P('<a href="' + AFF + '" target="_blank" rel="noopener"><strong>Sign up for Blotato here →</strong></a>'),
          P('You will need your <strong>API key</strong> from your Blotato account settings for the next lesson, so grab it while you are in there.')
        ]
      },
      {
        title: 'Connect Blotato to Claude',
        minutes: 5,
        body: [
          P('Pick the one that matches how you use Claude. You only do this once.'),
          H2('Claude Desktop / Claude Cowork'),
          OL([
            'Go to <strong>Settings → Connectors → Add Custom Connector</strong>',
            'Name: <code>Blotato</code>',
            'URL: <code>https://mcp.blotato.com/mcp</code>',
            'Press <strong>Connect</strong> and approve access'
          ]),
          H2('Claude Code (terminal)'),
          P('Paste this into a Claude Code session, then restart Claude Code:'),
          PRE('claude mcp add --transport http blotato https://mcp.blotato.com/mcp --header "blotato-api-key: INSERT API KEY"'),
          P('Replace <code>INSERT API KEY</code> with your key from your Blotato account settings.'),
          H2('Or via an MCP config file'),
          PRE('{\n  "mcpServers": {\n    "blotato": {\n      "type": "http",\n      "url": "https://mcp.blotato.com/mcp",\n      "headers": {\n        "blotato-api-key": "INSERT API KEY"\n      }\n    }\n  }\n}'),
          H2('Check it connected'),
          P('Ask Claude what social accounts it can see. If it lists yours, you are done. If it says it has no Blotato tools, restart Claude — connectors load at startup.'),
          NOTE('Your API key is a password for your social accounts. Do not paste it into a shared chat, a screenshot, or a file you commit to a repo.')
        ]
      },
      {
        title: 'Scheduling a carousel',
        minutes: 4,
        body: [
          P('With Blotato connected, posting is part of the same conversation:'),
          PRE('schedule the pricing carousel to Instagram for Tuesday at 9am,\nusing the caption from caption.md'),
          P('It picks up the PNGs in order, attaches the caption and sets the time.'),
          H2('A whole month'),
          PRE('schedule everything in carousel-studio/ across the next 4 weeks,\nTuesdays and Fridays at 9am, Instagram and LinkedIn'),
          P('If you built the month with the plugin you already have <code>schedule.csv</code> with the dates and captions in it, so you can point at that instead of re-deciding.'),
          H2('Before you let a month go out'),
          UL([
            '<strong>Look at the images.</strong> Open two or three of the PNGs. A blank slide is a perfectly valid PNG file.',
            '<strong>Check the order.</strong> Slide 1 has to be the cover.',
            '<strong>Read the captions.</strong> Particularly any comment keyword — make sure the thing it promises exists and you can send it.',
            '<strong>Check the first post manually</strong> in Blotato before trusting the rest of the batch.'
          ]),
          H2('Two different things'),
          P('Carousel Studio makes the posts. Blotato posts them. They are separate tools that happen to meet inside Claude — if Blotato is not connected, everything else in this course still works and you upload manually.'),
          NOTE('Scheduling posts to a live account is the one step here you cannot undo from a chat window. Give it dates you are happy with.')
        ]
      }
    ]
  }
];

/* ---------------- write it ---------------- */

let n = 0, minutes = 0, sort = 0;
const tree = { title: 'Claude Carousel Studio', sections: [], stats: null };

for (const sec of sections) {
  const lessons = [];
  for (const l of sec.lessons) {
    n += 1;
    minutes += l.minutes;
    const num = String(n).padStart(2, '0');
    const libId = `lesson:carousel-studio-${num}`;

    await upsertLibraryItem({
      id: libId,
      kind: 'lesson',
      course: SLUG,
      category: sec.label,
      title: l.title,
      description: null,
      bodyHtml: l.body.join(''),
      sort: sort++,
      requires: ENTITLEMENT
    });

    lessons.push({ libId, lessonId: `cs-${num}`, title: l.title });
    console.log(`  + ${libId}  ${l.title}`);
  }
  tree.sections.push({ name: sec.name, label: sec.label, lessons });
}

tree.stats = { lessons: n, minutes, sections: sections.length };

await upsertCourse({
  slug: SLUG,
  title: 'Claude Carousel Studio',
  lessonCount: n,
  // After the six existing courses, so it does not displace the membership's own.
  sort: 6,
  data: tree,
  requires: ENTITLEMENT
});

console.log(`\ndone — ${n} lessons in ${sections.length} sections, ~${minutes} min.`);
console.log(`Visible only to members holding the '${ENTITLEMENT}' entitlement.\n`);
