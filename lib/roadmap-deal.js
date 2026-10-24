import crypto from 'node:crypto';
import { funnelEnginePrice } from './products.js';

/**
 * The roadmap members' price on the Funnel Engine: 20% off for 48 hours,
 * offered in a message under somebody's roadmap an hour after it is published.
 *
 * Like the 24-hour bonus (lib/bonus.js), the offer travels in the checkout
 * link as a signed token carrying the address and the moment it ends, and the
 * server checks both before it prices the order. The deadline in the message
 * is the one the checkout enforces, and the link cannot be edited into a
 * bigger discount or a longer one. Its own signing prefix, so a bonus token
 * can never pass for one of these or the other way round.
 *
 * The 20% is on the engine alone. Its two add-ons keep their prices.
 */

export const DEAL_HOURS = 48;
export const DEAL_PERCENT = 20;
export const DEAL_KIND = 'rm-fe-deal';            // outreach: when the message went up
export const DEAL_24H_KIND = 'rm-fe-deal-24h';     // outreach: the reminder with a day left
export const DEAL_1H_KIND = 'rm-fe-deal-1h';       // outreach: the reminder with an hour left

/** The engine's price on the deal, in cents. */
export const dealPrice = () => Math.round(funnelEnginePrice() * (100 - DEAL_PERCENT) / 100);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const sign = (payload) => crypto.createHmac('sha256', secret()).update('fedeal:' + payload).digest('base64url');

/** A token for this address, valid until endsAt (ms). */
export function dealToken(email, endsAt) {
  const payload = b64(`${String(email).trim().toLowerCase()}|${Math.round(endsAt)}`);
  return `${payload}.${sign(payload)}`;
}

/** { email, endsAt } for a genuine, unexpired token, otherwise null. */
export function readDealToken(token, now = Date.now()) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  let expected;
  try { expected = sign(payload); } catch { return null; }
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let email, end;
  try { [email, end] = unb64(payload).split('|'); } catch { return null; }
  const endsAt = Number(end);
  if (!email || !Number.isFinite(endsAt) || endsAt <= now) return null;
  return { email, endsAt };
}

/**
 * The engine's price on an order. The token is checked once, when the order is
 * created, and its deadline is kept on the intent; an order left open past it
 * goes back to the full price rather than keeping the discount for ever.
 */
export function engineBaseFor(metadata = {}, now = Date.now()) {
  const ends = Date.parse(String(metadata.deal_ends || ''));
  return Number.isFinite(ends) && ends > now ? dealPrice() : funnelEnginePrice();
}

/** The member's own checkout link for a deal that ends at endsAt. */
export function dealCheckoutUrl(site, email, endsAt) {
  return `${site}/funnel-engine/checkout.html?deal=${encodeURIComponent(dealToken(email, endsAt))}`;
}

/** "Sunday 26 October, 14:05 UTC" */
export function dealEndsLabel(endsAt) {
  const d = new Date(endsAt);
  return d.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: 'UTC'
  }).replace(' at ', ', ') + ' UTC';
}

const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/* What they said they can give this, quoted back: the whole argument is that
   a plan costs hours and this is where the hours go. */
function hoursLine(hours) {
  const h = String(hours || '').trim();
  if (!h) return 'Building it all yourself takes weeks of evenings. With the Funnel Engine it takes an afternoon.';
  if (/under 2|2.5/i.test(h)) {
    return `You told us you can give this ${h.toLowerCase()} hours a week. Building the funnel yourself would eat all of them for a month. With the Funnel Engine it takes one afternoon, and the rest of your hours go into selling.`;
  }
  if (/5.10/i.test(h)) {
    return `You told us you have ${h} hours a week. Spend them selling and delivering, not wiring up pages and checkouts.`;
  }
  return `You have the hours, ${h} a week. The Funnel Engine means they go into selling and delivering, not into setting up tech.`;
}

/**
 * The message that goes under the roadmap. Sanitisable HTML: p, b, ul, li, a.
 * Kept under the 4,000 characters a note may hold.
 */
export function dealNoteHtml({ name, offer, hours, url, endsAt }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first.charAt(0).toUpperCase() + first.slice(1)},` : 'Hi,';
  const named = offer && offer.name
    ? `, starting with <b>${escapeHtml(offer.name)}</b>${offer.price ? ` at ${escapeHtml(offer.price)}` : ''}`
    : ' and the goal you gave us';
  return [
    `<p>${hello}</p>`,
    `<p>Your roadmap is ready, and it's built around your business${named}.</p>`,
    '<p><b>What it gives you:</b> the plan, week by week, and the exact tools in your membership for each step. What to do, in what order, and what to ignore.</p>',
    '<p><b>What it can\'t do:</b> put the hours in for you. Every step still has to be built: the sales page, the checkout, the emails, the follow-ups. That\'s where most plans stall. Not because the plan is wrong, but because the building takes weeks nobody has.</p>',
    '<p>That\'s exactly what <b>The Funnel Engine</b> is for:</p>',
    '<ul>' +
      // Only a roadmap written with the "Your offer" section has the button to
      // point at; for any other, the brief is filled in from what it does say.
      (offer && offer.promise
        ? '<li>Click <b>Copy as my Launch Brief</b> under "Your offer" in your roadmap, and paste it into Claude.</li>'
        : '<li>Fill in the one-page 10/90 Launch Brief that comes with it, using what you told us for your roadmap (what you sell, who it\'s for and the problem it solves), and paste it into Claude.</li>') +
      '<li>Claude builds the sales page, checkout, order bumps, upsells and emails, and puts your offer live on your own domain.</li>' +
      '<li>About an hour to install the first time. About 30 minutes for every offer after.</li>' +
      '<li>Nothing technical. You talk to Claude in plain English and do the logins. No code, no funnel builder, no monthly fee.</li>' +
    '</ul>',
    `<p>${escapeHtml(hoursLine(hours))}</p>`,
    `<p><b>Because you have your roadmap, it's ${DEAL_PERCENT}% off for the next ${DEAL_HOURS} hours: ${money(dealPrice())} instead of ${money(funnelEnginePrice())}.</b> That price is for roadmap members only, and it ends ${escapeHtml(dealEndsLabel(endsAt))}.</p>`,
    `<p><a href="${url}">Get The Funnel Engine for ${money(dealPrice())}</a></p>`,
    '<p>You\'re still covered by the 72-hour money-back guarantee: set it up, and if you\'re not sure it\'s for you, email us and you get every cent back.</p>',
    '<p>Any question about your roadmap, or about this, ask right here underneath. We read every one.</p>'
  ].join('');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
