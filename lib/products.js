/**
 * Which thing somebody was buying, and where to send them back to.
 *
 * There is more than one product now, and the only place that knows which one
 * a visitor was looking at is the page they were on. So the source is derived
 * from the URL rather than posted by the browser: the request body is already
 * trusted for an email address, but a product key decides which offer and which
 * price a stranger gets emailed, and that should not be settable from outside.
 *
 * Adding a product means adding a case to sourceFromUrl and an entry to
 * PRODUCTS. Anything unrecognised falls through to the original $1 offer,
 * which is also what the rows written before this existed get.
 */

export const DEFAULT_SOURCE = '70-ai-specialists-for-claude';

// The Engine's tag decides who gets the routines entitlement, so it lives here
// as one definition rather than as the same string typed into the webhook, the
// payment endpoints and the dashboard separately.
export const ENGINE_SOURCE = 'claude-automation-engine';

/** Leads and members who came through the membership checkout (/join.html). */
export const MEMBER_SOURCE = 'home-join';

export const PRODUCTS = {
  '70-ai-specialists-for-claude': {
    name: '70 AI Specialists for Claude',
    checkoutPath: '/checkout.html',
    priceAmount: () => Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10),
    priceCurrency: () => (process.env.PRICE_CURRENCY ?? 'usd').toUpperCase()
  },
  'lifetime-access': {
    name: '70 AI Specialists for Claude',
    // Same product and same price as above — a second landing page for it,
    // not a second offer. Only the page they came through differs, and being
    // returned to the one they recognise is the whole point.
    checkoutPath: '/lifetime-access/checkout.html',
    priceAmount: () => Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10),
    priceCurrency: () => (process.env.PRICE_CURRENCY ?? 'usd').toUpperCase()
  },
  'claude-automation-engine': {
    name: 'Claude Automation Engine',
    checkoutPath: '/checkout-engine.html',
    priceAmount: () => Number.parseInt(process.env.ENGINE_PRICE_AMOUNT ?? '2700', 10),
    priceCurrency: () =>
      (process.env.ENGINE_PRICE_CURRENCY ?? process.env.PRICE_CURRENCY ?? 'usd').toUpperCase()
  }
};

/** The product key for one of our own URLs. */
export function sourceFromUrl(url) {
  let path = '';
  try { path = new URL(String(url || ''), 'https://x.invalid').pathname.toLowerCase(); }
  catch { return DEFAULT_SOURCE; }

  if (path.startsWith('/lifetime-access/')
    || path.startsWith('/70-ai-specialists-for-claude-lifetime-access')) return 'lifetime-access';

  if (path.startsWith('/checkout-engine')
    || path.startsWith('/claude-automation-engine')) return 'claude-automation-engine';

  // The membership checkout. Its leads are people who wanted the membership,
  // not the $1 Specialists, so they must not be filed under the default.
  if (path === '/join' || path.startsWith('/join.html') || path.startsWith('/join/')) return MEMBER_SOURCE;

  return DEFAULT_SOURCE;
}

export function productFor(source) {
  return PRODUCTS[source] || PRODUCTS[DEFAULT_SOURCE];
}

/** "$1.00" / "$4.99", from the same figures the checkout charges. */
export function priceLabelFor(source) {
  const p = productFor(source);
  const amount = p.priceAmount();
  const currency = p.priceCurrency();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/* ---------------- checkout add-ons (order bumps) ---------------- */

/**
 * Extras offered as tick-boxes on the lifetime-access checkout, paid in the
 * same charge as the $1. Each one grants an entitlement, which is what gates
 * its content in the member area (a library/content row whose `requires`
 * names it).
 *
 * The price lives here and in env only. The browser says which boxes are
 * ticked; the server decides what that costs.
 */
export const ADDONS = {
  engine: {
    name: 'Claude Automation Engine — 59 Routines',
    short: 'Claude Automation Engine',
    // The same entitlement the standalone Engine checkout grants, so an add-on
    // buyer sees exactly what an Engine buyer sees.
    entitlement: 'routines',
    priceAmount: () => Number.parseInt(process.env.ADDON_ENGINE_AMOUNT ?? '499', 10)
  },
  carousel: {
    name: 'Claude Carousel Studio — Instagram & LinkedIn',
    short: 'Claude Carousel Studio',
    entitlement: 'carousel-studio',
    priceAmount: () => Number.parseInt(process.env.ADDON_CAROUSEL_AMOUNT ?? '499', 10)
  }
};

/** The known add-on keys in a comma list or array, de-duplicated, in a fixed order. */
export function parseAddons(value) {
  const asked = new Set(
    (Array.isArray(value) ? value : String(value || '').split(','))
      .map((s) => String(s).trim().toLowerCase())
  );
  return Object.keys(ADDONS).filter((k) => asked.has(k));
}

/** Sources whose checkout offers the add-ons. */
export const ADDON_SOURCES = new Set(['lifetime-access']);


/* ---------------- the courses behind the membership ---------------- */

/**
 * The courses that are not part of the base membership.
 *
 * Their rows and lessons are already in the member area, each one gated by the
 * entitlement named here, so a member sees a course only once something grants
 * it. `collection` is the Bunny collection the lessons were built from, kept
 * beside the entitlement so the ingest script and the gate cannot disagree
 * about what a course is.
 *
 * No prices here: how these are sold is not settled, and a price written down
 * before it is decided is a price something will eventually charge by accident.
 */
export const COURSES = {
  'business-builder': {
    name: 'Claude Business Builder: From Idea to First Sale',
    short: 'Claude Business Builder',
    entitlement: 'course-business-builder',
    collection: '3bcac850-b7cf-423b-ac11-fe4f2d0336e6',
    lessons: 16, minutes: 305
  },
  'business-agents': {
    name: 'Claude AI Business Agents: Build Your AI Team & Scale Smarter',
    short: 'Claude AI Business Agents',
    entitlement: 'course-business-agents',
    collection: '1aa371cf-938a-4268-804d-1c88a4859699',
    lessons: 20, minutes: 135
  },
  'business-automation': {
    name: 'Claude AI Business Automation: Automate Tasks & Save Hours Every Week',
    short: 'Claude AI Business Automation',
    entitlement: 'course-business-automation',
    collection: 'f54c9b2b-ee62-4e1c-9aa1-a75bf920a731',
    lessons: 18, minutes: 132
  },
  'ai-marketing': {
    name: 'AI Marketing for Entrepreneurs: Grow Your Business Smarter',
    short: 'AI Marketing for Entrepreneurs',
    entitlement: 'course-ai-marketing',
    collection: '61a81d35-2412-4b41-a5f9-b4dafda82e48',
    lessons: 15, minutes: 73
  },
  'messenger-automation': {
    name: 'Facebook Messenger Automation: Capture Leads & Grow Your Email List',
    short: 'Facebook Messenger Automation',
    entitlement: 'course-messenger-automation',
    collection: 'b5266b12-1169-4785-85da-bbe0ebd1a465',
    lessons: 16, minutes: 61
  },
  'course-business': {
    name: 'AI Course Business: License, Launch & Sell',
    short: 'AI Course Business',
    entitlement: 'course-course-business',
    collection: '5296ec16-24af-459a-92cf-3c1819bd94a4',
    lessons: 9, minutes: 120
  }
};

/** Held by anyone on an active or trialing membership. */
export const ALL_ACCESS = 'all-access';

/**
 * What the membership lends rather than sells.
 *
 * Content carrying this is open while somebody subscribes and locked when they
 * stop. It is deliberately separate from ALL_ACCESS: that one says "this person
 * subscribes", this one says "this item needs a subscription", and keeping them
 * apart is what lets a cancelled member keep everything they actually bought.
 */
export const MEMBERSHIP_ONLY = 'membership';

/** A course by key, or null. */
export const courseFor = (key) => COURSES[String(key ?? '')] || null;

/** The course a given entitlement belongs to, for the admin and the webhook. */
export function courseByEntitlement(entitlement) {
  const key = Object.keys(COURSES).find((k) => COURSES[k].entitlement === entitlement);
  return key ? { key, ...COURSES[key] } : null;
}

export const COURSE_ENTITLEMENTS = Object.values(COURSES).map((c) => c.entitlement);

/**
 * Everything the membership opens.
 *
 * A subscription is meant to show a member the whole member area, not only the
 * courses — so the separately sold products are in here too. Buying one of them
 * outright still writes its own entitlement row, which is what keeps it after a
 * subscription ends.
 */
export const MEMBERSHIP_UNLOCKS = [
  MEMBERSHIP_ONLY,
  ...COURSE_ENTITLEMENTS,
  'routines',
  'carousel-studio'
];
