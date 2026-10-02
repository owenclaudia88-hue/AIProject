/**
 * The "About this course" overview shown above the lesson list.
 *
 * Authored here and written into each course's row by
 * scripts/set-course-about.mjs, so the copy lives in one place and the member
 * area reads it from the same tree it already loads for the player.
 *
 * House style: second person for the reader, never first person for the
 * instructor. "You build a landing page" — not "I'll show you how I built
 * mine". A course page is the university speaking, and a line written as "I"
 * reads wrong the moment somebody else records a lesson.
 *
 * Shape, every field optional — a block with nothing in it is not rendered:
 *   { summary, intro[], forWho{lead, items[]}, learn{lead, items[[t,d]]},
 *     why[], project{lead, items[]}, needs{lead, items[], note},
 *     instructor{name, bio[]} }
 */

export const ABOUT = {
  'business-builder': {
    summary:
      'A 7-stage system for taking an idea from concept to first sale in seven days, built with '
      + 'Claude. By the last lesson you have a launched business: a defined niche, a brand voice, '
      + 'a digital product, a live landing page, and a content engine driving traffic to the offer.',

    intro: [
      'Most creators trying to build an online business with AI are using the same tool, writing '
      + 'the same content, and quietly wondering why none of it is landing.',
      'This masterclass covers the AI most of them have not found yet — Claude — and walks through '
      + 'a 7-stage system that takes an idea from concept to first sale in seven days.',
      'It is not a course you watch. Every module pairs a short presentation with a live build, '
      + 'so the thing being explained is the thing getting made. By the end you have shipped '
      + 'something real.'
    ],

    forWho: {
      lead: 'This course is for anyone tired of theory and ready to actually build.',
      items: [
        'Aspiring online business owners who have not launched yet',
        'Creators who tried ChatGPT and found the output sounded like everyone else',
        'Solopreneurs who have spent on tools and courses with nothing live to show for it',
        'Side-hustlers who want a business that compounds, not another marketing gimmick',
        'Anyone curious why Claude is becoming the AI of choice for serious creators'
      ]
    },

    learn: {
      lead: 'The full 7-stage Claude Creator Business Blueprint, start to finish.',
      items: [
        ['Stage 1 — Niche &amp; Offer',
         'Find your niche with the Ikigai framework and design the one offer you will sell.'],
        ['Stage 2 — Brand &amp; Voice',
         'Build a Brand Voice Document that turns Claude into your ghostwriter rather than a generic one.'],
        ['Stage 3 — The Product',
         'Build a real digital product end to end with Claude — not an outline, the actual thing.'],
        ['Stage 4 — The Landing Page',
         'Write and ship a high-converting landing page in your own voice.'],
        ['Stage 5 — The Content Engine',
         'Multiply one pillar piece into 30 days of content across three platforms.'],
        ['Stage 6 — The Funnel',
         'Build the lead magnet and email sequences that turn viewers into buyers.'],
        ['Stage 7 — Skills &amp; System',
         'Turn everything you built into reusable Claude Skills that compound over time.']
      ]
    },

    why: [
      'Most online business courses teach theory. This one runs differently: every module pairs a '
      + 'short, focused presentation with a live demonstration where a real business gets built '
      + 'with Claude, prompt by prompt.',
      'You are not taking notes. You are building the same thing in your own Claude project, and '
      + 'by the end of the course you have shipped something real.',
      'The 7-stage Blueprint is the same system behind more than 60,000 students taught, 35 '
      + 'million content views, and three active creative businesses. What used to take six to '
      + 'twelve months of trial and error takes a few focused weeks, because Claude does the heavy '
      + 'lifting at every stage.'
    ],

    project: {
      lead: 'Ship the live version of your own online business, then write it up on one page.',
      items: [
        'Your niche and customer avatar',
        'Your brand voice document',
        'Your product name',
        'Your landing page URL',
        'Five to ten sample pieces of content'
      ]
    },

    needs: {
      lead: 'Everything needed to build along.',
      items: [
        'A free Claude account at claude.com — Pro recommended from Stage 5 onward',
        'A page builder of your choice: Carrd, Stan, Beehiiv, Framer or similar',
        'An email tool such as ConvertKit or Beehiiv — optional, useful from Stage 6',
        'Five to ten hours of focused build time across seven days'
      ],
      note: 'No coding, no design background, and no existing audience required.'
    },

    instructor: {
      name: 'Lambros',
      bio: [
        'A former doctor turned creator who left medicine six years ago to build content '
        + 'businesses from scratch. Since then: over 60,000 students taught, 35 million views '
        + 'generated, and three active creative businesses.',
        'The last two years have been spent inside the AI creator economy working out what '
        + 'actually works and what does not. This course is that, distilled into one system you '
        + 'can copy.'
      ]
    }
  }
};

/** The about block for a course key, or null. */
export const aboutFor = (key) => ABOUT[String(key ?? '')] || null;

/** Every course key that has an overview written. */
export const ABOUT_KEYS = Object.keys(ABOUT);
