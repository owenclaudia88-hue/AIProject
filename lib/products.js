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
    priceAmount: () => Number.parseInt(process.env.ENGINE_PRICE_AMOUNT ?? '499', 10),
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
