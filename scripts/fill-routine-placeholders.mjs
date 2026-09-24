/**
 * Give every empty settings field in a routine a visible placeholder.
 *
 *   node scripts/fill-routine-placeholders.mjs [--dry]
 *
 * The settings block at the end of each prompt is a form the buyer fills in.
 * Written as bare labels — "What we sell:" with nothing after it — it reads as
 * text that got truncated, especially on the last line of the prompt, and the
 * people this product is for are the least likely to assume otherwise.
 *
 * So each empty field gets a bracketed example on the same line. That makes it
 * unmistakably a blank to fill rather than a sentence that stops, and it shows
 * the shape of the answer, which is the part people actually get wrong.
 *
 * Re-runnable: a field that already has something after the colon is skipped,
 * so this will not double up if it is run twice.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'routines');
const DRY = process.argv.includes('--dry');
const MARKER = '--- EDIT BELOW THIS LINE ---';

// Keyed by the exact label text, without indentation or trailing spaces.
// Examples are deliberately concrete: a shape to copy beats an instruction.
const P = {
  // --- who you are and what you sell -------------------------------------
  'What we sell:': 'e.g. stock control software for small workshops, £49/mo',
  'What we sell now:': 'e.g. stock control software for small workshops, £49/mo',
  'What we sell, and the typical price range:': 'e.g. workshop fit-outs, £800 to £6,000',
  'What I do:': 'e.g. I help small workshops stop running on spreadsheets',
  'What I do, in one sentence:': 'e.g. I help small workshops stop running on spreadsheets',
  'What this business does:': 'e.g. we sell and fit commercial kitchen equipment',
  'Who it is for:': 'be specific — "people who run a shop and do their own books on a Sunday", not "small businesses"',
  'Who I am talking to:': 'be specific — "people who run a shop and do their own books on a Sunday"',
  'Who I am trying to reach:': 'be specific — "workshop owners with 3 to 15 staff"',
  'Who reads it:': 'e.g. owners of 5-to-20-person workshops who signed up for the guide',
  'Who our customers are, and what changes their world:': 'e.g. independent retailers — affected by card fees, business rates, supplier terms',
  'Who is a good fit for us:': 'e.g. 5 to 30 staff, already outgrown a spreadsheet, based in the UK',
  'Who is not, and should be deprioritised:': 'e.g. sole traders, students, anyone asking about a free plan',
  'What makes somebody a bad fit:': 'e.g. fewer than 3 staff, or they want us to do the work for them',
  'The business that is a perfect fit — industry, size, location, and what': null,
  'must be true about them:': 'e.g. joinery or cabinetmaking, 8 to 25 staff, UK, has a website and at least one manager',
  'The one thing that makes it different:': 'e.g. it works out the costs by itself, so nobody has to keep a second sheet',
  'What we do, and what we want them to eventually do:': null,
  'What I want them to eventually do:': 'e.g. book a call, or start a trial',
  'What I want them to feel at the end:': 'e.g. like somebody told them something true, not like they were sold to',
  'What the newsletter is about:': 'e.g. running a small workshop without drowning in admin',
  'What this quarter is for:': 'e.g. getting to 200 paying customers without hiring',
  'What matters most to this business right now:': 'e.g. converting the 14 open trials before month end',
  'Three things I believe that most people in my field do not:': 'e.g. 1) most software is bought to avoid a conversation 2) onboarding fails in week three, not week one 3) price is almost never the real objection',

  // --- voice --------------------------------------------------------------
  'Words and phrases I would never use:': 'e.g. leverage, synergy, "excited to share", "in today’s fast-paced world"',
  'Voice notes — how I write, and what I would never say:': 'e.g. plain and direct, short sentences, no exclamation marks, never "game-changer"',
  'Tone to avoid:': 'e.g. hype, urgency, anything that sounds like a webinar',
  'Our tone with customers:': 'e.g. plain, direct, no corporate softening. Apologise once and then fix it',
  'How I write to customers:': 'e.g. first names, short paragraphs, say the awkward thing plainly',
  'Two real subject lines of mine that did well:': 'paste two of your own — this does more for the output than any instruction about tone',

  // --- lists of things to ignore -----------------------------------------
  'Ignore these senders, domains and labels:': 'e.g. @yourcompany.com, noreply@, newsletters, label:Receipts',
  'Ignore these addresses and domains:': 'e.g. @yourcompany.com, noreply@, your accountant, your suppliers',
  'Ignore these senders:': 'e.g. noreply@, marketing@, anything with "newsletter" in the address',
  'Ignore emails from these addresses or domains:': 'e.g. @yourcompany.com, your suppliers, your accountant',
  'Ignore emails in these folders or with these labels:': 'e.g. label:Receipts, label:Newsletters, Spam',
  'Ignore these:': 'e.g. anything already cancelled, or contracts under £20/month',
  'Ignore meetings with these titles or attendees:': 'e.g. Standup, 1:1, Lunch, Dentist, anything with only me in it',
  'Ignore these companies or domains:': null,
  'Never contact these companies or domains:': 'e.g. existing customers, anyone who has asked us not to, competitors',
  'Never ask these customers:': 'e.g. anyone who has ever disputed a charge, anyone on a free arrangement',
  'Do not contact these addresses or domains:': 'e.g. @yourcompany.com, anyone who has unsubscribed',
  'Topics I never need to hear about:': 'e.g. funding rounds, predictions, "the future of" articles, AI news in general',
  'Things I never want flagged:': 'e.g. emoji-only replies, the same three people who comment on everything',
  'Things that are not worth reporting:': 'e.g. routine admin, anything already in the weekly report',
  'Things that genuinely do not matter for this role:': 'e.g. which accounting software they used before, whether they have a degree',
  'Documents to ignore — archives, drafts, old versions:': 'e.g. anything in /Archive, anything with "old" or "draft" in the name',
  'Known issues to ignore:': 'e.g. /old-pricing redirects on purpose, the blog has no contact link and that is fine',
  'Questions we have already answered this quarter:': 'add each one here after you publish it, so it stops being suggested',

  // --- our own identifiers ------------------------------------------------
  'Our own email addresses:': 'e.g. you@yourcompany.com, hello@yourcompany.com',
  'Our own email addresses and domains:': 'e.g. @yourcompany.com, you@gmail.com if you use it for work',
  'My own email address:': 'e.g. you@yourcompany.com',
  'Our domain:': 'e.g. yourcompany.com',
  'Our public site:': 'e.g. https://yourcompany.com',
  'Our name, and any variants and misspellings:': 'e.g. Northfield Makes, Northfield, "north field", Northfeild',
  'Our product names:': 'e.g. the Workshop Plan, the Starter Kit',
  "Our founders' names, if worth watching:": 'e.g. Priya Shah — leave blank if you would rather not',
  'How we refer to the product:': 'e.g. "your plan", not "your subscription"',
  'Link to send people back to:': 'e.g. https://yourcompany.com/checkout',
  'Where we want reviews (the link):': 'e.g. https://g.page/r/... or your Trustpilot link',

  // --- money and thresholds ----------------------------------------------
  'Fixed costs per month:': 'e.g. rent 1,200, salaries 8,400, software 310, insurance 150',
  'Typical deal value, if nothing has been discussed:': 'e.g. £1,500 — or leave blank so these stay uncounted',
  'Prices that should be consistent everywhere:': 'e.g. £49/mo, £490/year',
  'What we pay, and what is negotiable:': 'e.g. £32,000 to £38,000. The top is for someone who can take the accountant relationship on from day one. Hours are not negotiable',

  // --- sources, places, documents ----------------------------------------
  'Sources — public URLs, 4 to 8 of them:': 'e.g. a competitor blog, a trade publication, one community your customers use',
  'Sources — news sites, industry publications, regulator pages, platform': null,
  'changelogs, competitor blogs:': 'e.g. your payment provider’s changelog, your regulator’s announcements page, two trade publications',
  'Places to check specifically — forums, communities, review sites,': null,
  'subreddits, directories:': 'e.g. reddit.com/r/smallbusiness, your main trade forum, your Trustpilot page',
  'Terms that produce false matches:': 'e.g. the band with the same name, the town in Yorkshire',
  'Search terms — 8 to 15, in the words a customer would actually use:': 'e.g. "stock spreadsheet falling over", "inventory software small workshop"',
  'Country to check:': 'e.g. United Kingdom',
  'Competitor domains:': 'e.g. competitor-a.com, competitor-b.co.uk',
  'Competitors — name, then their pricing page, product page, and changelog': null,
  'if they have one:': 'e.g. Competitor A — /pricing — /features — /changelog',
  'Where our documentation lives:': 'e.g. the Help folder in Drive, or https://help.yourcompany.com',
  'Drive folders to check:': 'e.g. Processes, Handbook, Onboarding',
  'Drive folders with my plans or notes:': 'e.g. Planning, Weekly notes',
  'Drive folders to check sharing on:': 'e.g. Finance, Customer exports, Contracts',
  'Job description document:': 'e.g. Finance Manager JD — the document name in Drive',
  'Onboarding plan document:': 'e.g. Onboarding plan — the document name in Drive',
  'Inbox or Gmail label to read:': 'e.g. Support — or leave as Inbox',
  'Calendar events that are interviews — the titles or keywords:': 'e.g. Interview, Screening call, "Stage 2"',
  'Shared channels to read:': 'e.g. #general, #ops, #projects',
  'Channel to post the digest to:': 'e.g. #general',
  'Slack channels to read, if connected:': 'e.g. #support, #customers — leave blank if you do not use Slack',
  'Links we send often:': 'e.g. the help centre, the pricing page, the cancellation form',
  'Platforms I publish on:': 'e.g. LinkedIn, Instagram, email',
  'Platforms and formats I use:': 'e.g. LinkedIn short and long posts, Instagram carousels, a weekly email',
  'What we depend on — platforms, suppliers, payment providers,': null,
  'marketplaces, regulators:': 'e.g. Stripe, Shopify, Royal Mail, HMRC, your main supplier by name',

  // --- people and teams ---------------------------------------------------
  'People whose messages always matter:': 'e.g. your accountant, your landlord, your three largest customers by name',
  'Current people, with their company email addresses:': 'e.g. Priya Shah — priya@yourcompany.com',
  'Leavers and finished contractors — name, every address they used, and': null,
  'when they left:': 'e.g. J. Hart — j.hart@yourcompany.com, jhart88@gmail.com — left 14 March 2026',
  'Systems we use — name each one:': 'e.g. Stripe, Google Workspace, Xero, the ad platform, the website admin',
  'Current starters — name, start date:': 'e.g. J. Meyer — 2 September 2026',
  'Who owns what, by default:': 'e.g. Ops owns accounts and equipment. The manager owns everything else',
  'Current projects or workstreams:': 'e.g. Stock migration, Help centre, Card machine replacement',
  'Customers to always watch, whatever their score:': 'e.g. your five largest by revenue, named',
  'Already asked in the last 6 months — add names here as you go:': 'add a name and a date each time you ask, or people get asked twice',

  // --- process and judgement ---------------------------------------------
  'Things that always need me, whatever they look like:': 'e.g. anything from a journalist, anything mentioning a refund',
  'Things I always forget to ask:': 'everybody has two or three — e.g. who else has to approve this, what happens if they do nothing',
  'Things I always promise and often forget:': 'e.g. sending case studies, introductions, the follow-up breakdown',
  'What usually goes wrong on these calls:': 'e.g. I talk too long before asking what they actually need',
  'Priority rules — what makes one enquiry more urgent than another:': 'e.g. anyone naming a deadline, anyone with more than 10 staff, anyone who has already had a demo',
  'What usually triggers a business like this to need us:': 'e.g. they hire a fourth person, they move premises, they lose the person who ran the spreadsheet',
  'What we currently believe is the main reason people do not buy:': 'e.g. we think it is price — let the report tell you whether that is true',
  'What we currently believe is the main reason people leave:': 'e.g. we think they stop needing it — let the report tell you whether that is true',
  'What we have already decided against, and why:': 'e.g. a free tier — tried it in 2025, it filled support with people who never bought',
  'What we are already working on:': 'e.g. scheduled exports, the help centre',
  'Constraints — time, money, skills, anything that rules options out:': 'e.g. two people, no developer, under £500 a month to try anything',
  'How much time a month I am willing to spend on content:': 'e.g. about 8 hours',
  'Things our own customers keep asking us for:': 'e.g. scheduled exports, a phone view, multi-currency',
  'The internal words we use that customers might not:': 'e.g. we say "reporting cycle", they say "month end"',
  'Phrases that appear in our proposals:': 'e.g. "Scope of work", "Estimated total", "Valid for 30 days"',
  'Requirements, in order of importance — be specific and observable:': null,
  'Requirements, in order:': null,
  'Things about this job that are genuinely hard, and should be said out': null,
  'loud:': 'e.g. month end is four heavy days, the systems are old, nobody else in the building does this job',
  'Known answers — the question, then exactly how we answer it:': 'paste your real wording, not a tidied version',
  'Checkpoints — what should have happened, and by which day:': null,
  'Stages, and what puts somebody in each:': null,
  'Suppliers — name, what we buy, usual lead time:': 'e.g. Kestrel Supplies — oak panels — 10 working days',
  'Orders not placed by email — add them here:': 'e.g. anything ordered by phone or through a supplier portal',
  'Contracts not in the folder — who with, what for, cost, renewal date,': null,
  'notice period:': 'e.g. Fairbank Brokers — insurance — £1,840/yr — renews 14 Dec — 60 days',
  'Angles already used recently (add to this as you go):': 'paste last week’s angles here, or connect the content log so it remembers for you',
  'Things that are always in the calendar and are not work:': 'e.g. school run, gym, lunch, recurring personal appointments',
  'Weekly shape:': null,
  'Competitors:': null,
  'Pairings:': null,
  'What content is for, in one sentence — sales, trust, recruiting,': null,
  'reputation, or something else:': 'e.g. trust — people buy months later, so measuring it on this month’s sales is wrong',
  'Pages to check — the homepage, pricing, checkout, contact, and any page': null,
  'that matters:': 'e.g. https://yourcompany.com, /pricing, /checkout, /contact',
  'Current facts — keep this updated, it is what everything is checked': null,
  'against:': null,
  'People, and what they do:': 'e.g. Priya Shah — runs payroll and supplier payments',
  'People who have left, and when:': 'e.g. J. Hart — left 14 March 2026',
  'Tools we use now, and what they replaced:': 'e.g. Xero, replaced the old spreadsheet ledger in June',
  'Current prices:': 'e.g. standard plan £49/mo, annual £490',
  'Current suppliers:': 'e.g. Kestrel Supplies, Ardley Metals'
};

const files = [];
for (const d of (await readdir(ROOT, { withFileTypes: true })).filter((x) => x.isDirectory())) {
  for (const f of (await readdir(join(ROOT, d.name))).filter((x) => x.endsWith('.md'))) {
    files.push(join(ROOT, d.name, f));
  }
}
files.sort();

const indentOf = (l) => l.match(/^ */)[0].length;
let changed = 0, filled = 0;
const missing = new Map();

for (const path of files) {
  const raw = await readFile(path, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const md = raw.replaceAll('\r', '');

  const fence = md.match(/```\n([\s\S]*?)```/);
  if (!fence) continue;
  const markerAt = fence[1].indexOf(MARKER);
  if (markerAt < 0) continue;

  const head = fence[1].slice(0, markerAt);
  const lines = fence[1].slice(markerAt).split('\n');
  let touched = false;

  for (let i = 0; i < lines.length; i++) {
    if (!/:\s*$/.test(lines[i])) continue;

    // A field is empty unless the next line with anything on it is indented
    // further, in which case that line is the field's own template and the
    // field is already showing its shape.
    //
    // Note this deliberately does not care what the next line *is*. An
    // earlier version only treated a field as empty when another bare label
    // followed it, which quietly skipped every field sitting above an
    // already-filled one — "Drive folders to check sharing on:" above
    // "Dormancy threshold: 90 days" was left bare.
    let k = i + 1;
    while (k < lines.length && !lines[k].trim()) k++;
    const next = k < lines.length ? lines[k] : null;
    if (next !== null && indentOf(next) > indentOf(lines[i])) continue;

    const label = lines[i].trim();
    if (!(label in P)) { missing.set(label, (missing.get(label) || 0) + basename(path)); continue; }
    const hint = P[label];
    if (hint === null) continue; // a wrapped label: the hint sits on its closing line

    lines[i] = lines[i].replace(/\s*$/, '') + ' [' + hint + ']';
    touched = true;
    filled++;
  }

  // The bracketed examples create a new failure mode: somebody pastes the
  // prompt with one still in place and Claude treats "[e.g. Planning,
  // Weekly notes]" as a real folder name. So say what brackets mean, and
  // make an unreplaced one announce itself rather than quietly becoming a
  // setting.
  const blockText = lines.join('\n');
  if (blockText.includes('[') && !blockText.includes('square brackets')) {
    const at = lines.findIndex((l) => l.includes(MARKER));
    if (at >= 0) {
      lines.splice(at + 1, 0,
        '',
        'Everything in [square brackets] below is an example. Replace it with',
        'your own and delete the brackets. If anything is still in brackets when',
        'this runs, it is not a real setting — ignore it and say so at the top of',
        'your output rather than treating the example as an instruction.');
      touched = true;
    }
  }

  if (!touched) continue;
  changed++;
  const rebuilt = head + lines.join('\n');
  const out = md.replace(fence[1], rebuilt).split('\n').join(eol);
  if (!DRY) await writeFile(path, out, 'utf8');
}

if (missing.size) {
  console.log('No placeholder written for these labels:');
  for (const [k] of missing) console.log('  ' + k);
  console.log('');
}
console.log(DRY
  ? `${filled} fields would be filled across ${changed} routines.`
  : `${filled} fields filled across ${changed} routines.`);
