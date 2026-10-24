/**
 * The Funnel Engine introduction: seven emails over nine days, sent to every
 * member who does not own it - the members there were when it launched, and
 * every client who joins after (lib/fe-launch.js decides who and when).
 *
 * Written in the manner of Miles Stutz (curiosity subjects, one line per
 * sentence, "two kinds of people", the minute-by-minute day, a P.S. that
 * answers the doubt) and Zac (plain voice, owning versus renting, lifetime not
 * monthly, the 10% rule). Not borrowed: deadlines, price rises, or stories that
 * did not happen - nothing here may stop being true the week after it is sent.
 *
 * Plain data. {first} is the member's first name, {page} the sales page and
 * {checkout} the checkout; lib/email.js fills them in and draws the email.
 */

export const LAUNCH = [
  {
    day: 0,
    subject: "Meet The Funnel Engine (it's not another subscription)",
    preview: 'Tell Claude what you sell. It builds the rest.',
    heading: 'Meet The Funnel Engine',
    body: [
      'Hey {first},',
      'You know what you want to sell.',
      'The hard part was never the idea.',
      'It was everything after it: the page, the checkout, the payments, the emails, the automations.',
      'That\'s what <b>The Funnel Engine</b> is for.',
      'You tell Claude what you want to sell.',
      'Claude builds the sales page, the checkout, the order bumps, the upsells and the emails, and puts it live on your own domain.',
      'No funnel builder. No monthly fee. No tech skills.',
      '<b>What you get:</b><ul><li>The Funnel Engine, yours for life</li><li>The Quick Start skill, which connects your domain, payments and hosting</li><li>The /Integrate skill, which hooks it up to the email tool you already use</li><li>The full workshop recording, where a brand-new offer goes live in 30 minutes, clock on screen</li><li>Three bonuses: the Claude Code &amp; Codex 80/20 Sheet, the 10/90 Launch Brief and Claude From Your Phone</li></ul>',
      '<b>Two add-ons you can tick at checkout:</b><ul><li><b>Edward</b> ($47), your AI media buyer, who writes and builds your Meta ads with you</li><li><b>All 16 DFY AI Operators</b> ($197), who build the offer itself with you if you don\'t have one yet</li></ul>',
      'It\'s <b>$100, once</b>.',
      'And if within 72 hours you\'re not sure you can launch an offer with Claude, email us and you get every cent back.'
    ],
    cta: ['See The Funnel Engine', '{page}'],
    ps: 'For the next nine days I\'ll send you a few short emails on how it works and who it\'s for. Then I\'ll stop.'
  },
  {
    day: 1,
    subject: 'Two kinds of people sell online',
    preview: 'Which one are you this week?',
    heading: 'Which one are you?',
    body: [
      'Hey {first},',
      'There are two kinds of people selling online right now.',
      'The ones who spend their week <b>building</b> the funnel...',
      'And the ones who spend their week <b>selling</b>, while Claude builds the funnel for them.',
      'The first group knows the job well.',
      'Drag a block. Fix the spacing on mobile. Connect Stripe. Find out why the thank-you page didn\'t send the access email.',
      'Sit in a funnel builder at 11pm wondering why the checkout looks different on a phone.',
      'Nobody started a business to do that job.',
      'But somebody has to, and in most small businesses that somebody is you.',
      'The job never stays small, either.',
      'One offer becomes a bump. The bump needs an upsell. The upsell needs emails. The emails need a tag in your CRM.',
      'And the thing you\'re actually good at gets whatever\'s left of your week.',
      'The second group doesn\'t do any of that.',
      'They type what they want to sell into Claude. Claude builds it inside the Funnel Engine. They look at it on their phone and say yes.',
      'That\'s the whole switch.'
    ],
    cta: ['Switch groups · $100', '{page}'],
    ps: 'If part of you is thinking "I\'m not technical enough for this": that\'s exactly who it\'s for. You talk to Claude in plain English. Claude writes every line, and it does the setup with you one step at a time.'
  },
  {
    day: 2,
    subject: "You're renting your business",
    preview: 'And the rent goes up every month',
    heading: 'Rent, or own?',
    body: [
      'Hey {first},',
      'I\'ll be blunt about something.',
      'Most online businesses don\'t own their funnel. They rent it.',
      'A funnel builder at $97 to $297 a month.',
      'That\'s $1,164 to $3,564 a year, every year, for pages you can\'t take with you.',
      'Stop paying, and the pages go dark.',
      'For a long time that was the only way. Building your own meant hiring a developer.',
      'With Claude, it isn\'t anymore.',
      'The Funnel Engine is the funnel itself, as code you own: sales pages, checkout, bumps, upsells, buyer emails and a sales dashboard, in one folder.',
      'It runs on your own hosting at about $5 a month.',
      'Every sale goes straight to your own Stripe.',
      'And it\'s <b>$100 once</b>. Lifetime, not monthly.',
      'If you love the builder you\'re in, keep it. /Integrate connects the Funnel Engine to GoHighLevel, ClickFunnels, Kajabi, Kit and the rest.',
      'But if you\'re paying every month for something you hate logging into... you don\'t have to anymore.'
    ],
    cta: ['Own your funnel · $100', '{checkout}']
  },
  {
    day: 4,
    subject: "Here's what Tuesday looks like",
    preview: '9:00 coffee. 9:30 your offer is live.',
    heading: 'Tuesday, with the Funnel Engine',
    body: [
      'Hey {first},',
      'Here\'s what launching an offer looks like once your Funnel Engine is installed.',
      '<b>9:00.</b> You pour a coffee, open Claude and type: "A $47 workshop with a $27 bump."',
      '<b>9:04.</b> Your sales page is written: headline, offer, FAQ and guarantee, in your voice.',
      '<b>9:11.</b> It\'s designed, in your brand, built for phones first.',
      '<b>9:16.</b> Checkout is set up on your own Stripe: the $47 workshop and the $27 bump.',
      '<b>9:21.</b> It\'s published at yourdomain.com.',
      '<b>9:26.</b> /Integrate has set up the tags, five emails and the automation in your email tool.',
      '<b>9:30.</b> Test sale. $47 paid. First email landed.',
      'Your coffee isn\'t even cold.',
      'You don\'t have to take that on trust: in the workshop recording you watch a brand-new offer go live, with the clock on screen.',
      'The first time, you install it: tell Claude "Install my Funnel Engine" and do the logins it asks for. About an hour, once.',
      'Every offer after that looks like Tuesday.',
      '<b>And Wednesday?</b>',
      'Your offer is live. Now somebody has to send people to it.',
      'For most people that\'s where the next wall is: Ads Manager, angles, hooks, images, budgets, and a campaign that dies the week you stop watching it.',
      'That\'s what <b>Edward</b> is for. He\'s your AI media buyer, installed in Claude or ChatGPT:',
      '<ul><li>He writes 5 primary texts, 5 headlines and 5 descriptions for your offer, in your voice</li><li>He makes the images</li><li>He builds a clean $150 test in your ad account, switched off until you approve it</li><li>He reads your numbers every week, and tells you what to do when an ad dies: which of the three bottlenecks it is, and the fix</li></ul>',
      'He comes with the full Evergreen Ads 3.0 workshop and the ad templates.',
      'He\'s a <b>$47 add-on</b> at the Funnel Engine checkout: one tick, one payment.'
    ],
    cta: ['Get the engine (and Edward)', '{checkout}']
  },
  {
    day: 5,
    subject: '$79,805 in September',
    preview: 'On the same engine you\'d be getting',
    heading: 'Is it real? Here\'s the number.',
    body: [
      'Hey {first},',
      'We cleared <b>$79,805 in sales in September</b> on the Funnel Engine.',
      'Not on a funnel builder.',
      'Not with a developer.',
      'On the same engine, the same two skills and the same 30-minute process that\'s in the box.',
      'I\'m not telling you that so you expect the same number. Your offer, your audience and the work you put in decide yours.',
      'I\'m telling you because it answers the only question that matters before you buy anything like this:',
      '<i>Does it actually take real money?</i>',
      'It does. Real pages, real checkouts, real sales landing in a real Stripe account, month after month.',
      'The page also has screenshots buyers sent in, from moving their funnels off GoHighLevel to running a global brand\'s sites on it.',
      'Their words. Nothing retyped.'
    ],
    cta: ['See the page', '{page}'],
    fine: 'Sales figures are gross funnel sales across businesses owned or co-owned by our team, before fees, not profit. Results vary and no specific earnings are guaranteed.'
  },
  {
    day: 7,
    subject: 'You already did the hard 10%',
    preview: "It's sitting in your roadmap",
    heading: 'The 10% only you can do',
    body: [
      'Hey {first},',
      'Here\'s the rule the Funnel Engine is built on.',
      '<b>You do the 10% only you can do. Claude does the other 90%.</b>',
      'Your 10% is one page: who it\'s for, the one promise, the price, the proof you really have. We call it the 10/90 Launch Brief.',
      'It\'s also the part people get stuck on for weeks.',
      'But if you\'ve had your Personalised AI Roadmap, you\'ve already done most of it.',
      'To get it, you told us what you sell, who your customer is and the problem you solve for them.',
      'That\'s most of your 10%. Write those same answers into the brief, add your price and the proof you really have, and it\'s done. About five minutes.',
      'Roadmaps written from now on go one step further: they set your offer out as a Launch Brief, with a <b>Copy as my Launch Brief</b> button.',
      'Then paste it into Claude inside the Funnel Engine, and it builds the page, the checkout and the emails for that exact offer.',
      'No roadmap yet? It\'s in your member area and takes about ten minutes.',
      '<b>No offer yet at all?</b>',
      'Then the <b>16 DFY AI Operators</b> are the shortcut.',
      'All sixteen live in one Claude skill. You type <i>start micro offer</i>, and they walk you through it, one operator at a time:',
      '<ul><li>Your promise, your offer and your sales page</li><li>Your first buyers, your ad test and your emails</li><li>Your upsells, and more money per buyer once it sells</li></ul>',
      'They hand you the brief. The Funnel Engine builds it.',
      'They\'re a <b>$197 add-on</b> at the Funnel Engine checkout, with three short install lessons.'
    ],
    cta: ['Launch your offer · $100', '{checkout}']
  },
  {
    day: 9,
    subject: 'Why?',
    preview: 'Last one about the Funnel Engine',
    heading: 'Quick question',
    body: [
      'Hey {first},',
      'Quick question. What\'s holding you back?',
      '<b>If it\'s money:</b> it\'s $100 once. About what a funnel builder charges you for a single month.',
      '<b>If it\'s time:</b> the whole point is that Claude does the building. About an hour to install, about 30 minutes for every offer after.',
      '<b>If it\'s tech:</b> you talk to Claude in plain English. Your passwords and keys stay in your own accounts, and Claude never types them.',
      '<b>If it\'s "will this work for me":</b> that\'s what the 72-hour guarantee is for. Set it up. Not sure? Email us and you get every cent back.',
      '<b>If you want it done further for you:</b> at checkout you can add <b>Edward</b> ($47), an AI media buyer who writes your Meta ads and builds the campaign with you, and the <b>16 DFY AI Operators</b> ($197), who build the offer itself with you. Both optional.',
      'This is the last email I\'ll send about it.',
      'If not now, when?'
    ],
    cta: ['Get The Funnel Engine', '{page}'],
    ps: 'Questions before you decide? Just reply. We read every one.'
  }
];
