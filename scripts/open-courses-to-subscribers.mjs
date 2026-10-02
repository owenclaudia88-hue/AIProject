/**
 * Open every course to the members who already subscribe.
 *
 *   node --env-file=.env.local scripts/open-courses-to-subscribers.mjs            # dry run
 *   node --env-file=.env.local scripts/open-courses-to-subscribers.mjs --apply
 *   node --env-file=.env.local scripts/open-courses-to-subscribers.mjs --apply --undo
 *
 * The webhook grants all-access when an invoice is paid, so from now on this
 * happens by itself. It cannot reach backwards though: somebody who paid last
 * month has no new invoice to trigger it, and would be waiting until their next
 * renewal for courses they are already entitled to. This is that one catch-up.
 *
 * MUST run against live Stripe. A test-mode key sees test subscriptions and
 * would grant nothing, or the wrong people — so the mode is checked and the
 * script refuses rather than quietly doing nothing useful.
 *
 * Re-runnable: granting is an upsert, so running it twice changes nothing.
 */
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { grantEntitlement, revokeEntitlement } from '../lib/db.js';
import { ALL_ACCESS } from '../lib/products.js';

const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('STRIPE_SECRET_KEY is not set.'); process.exit(1); }

// A subscription that is live in any of these senses is one the member is
// entitled to their courses under. past_due is deliberate: somebody whose card
// failed this morning has not stopped being a member, and Stripe will retry.
const LIVE = new Set(['active', 'trialing', 'past_due']);

const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
const sql = neon(process.env.DATABASE_URL);

const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
console.log(`Stripe key is ${mode} mode.\n`);
if (mode !== 'live') {
  console.error('Refusing to run against test mode: the real subscriptions are live, and');
  console.error('this would grant nothing useful. Run it where the live key is set.\n');
  process.exit(1);
}

/* Who is subscribed, by email. One pass over subscriptions rather than a lookup
   per member: there are far fewer subscriptions than members, and this way a
   member with two customer records is still found. */
const subscribed = new Map();
for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] })) {
  if (!LIVE.has(sub.status)) continue;
  const email = typeof sub.customer === 'object' ? sub.customer?.email : null;
  if (!email) continue;
  const at = String(email).trim().toLowerCase();
  if (!subscribed.has(at)) subscribed.set(at, sub.status);
}

console.log(`subscriptions that are live: ${subscribed.size}`);

const held = new Set(
  (await sql`select email from entitlements where product = ${ALL_ACCESS}`)
    .map((r) => String(r.email).toLowerCase()));

if (UNDO) {
  console.log(`\nholding all-access now: ${held.size}`);
  if (APPLY) {
    for (const email of held) await revokeEntitlement(email, ALL_ACCESS);
    console.log(`revoked from ${held.size}.`);
  } else {
    held.forEach((e) => console.log('   would revoke:', e));
    console.log('\nDry run. Add --apply to write.\n');
  }
  process.exit(0);
}

const toGrant = [...subscribed.keys()].filter((e) => !held.has(e));
const already = [...subscribed.keys()].filter((e) => held.has(e));

console.log(`  already have the courses: ${already.length}`);
console.log(`  to be granted           : ${toGrant.length}`);
toGrant.forEach((e) => console.log('     ' + e + '  (' + subscribed.get(e) + ')'));

// Anyone holding it whose subscription has since gone is listed but not touched:
// they may have bought a course outright, and this script is not the place to
// decide that.
const stale = [...held].filter((e) => !subscribed.has(e));
if (stale.length) {
  console.log(`\n  holding all-access with no live subscription: ${stale.length}`);
  stale.forEach((e) => console.log('     ' + e + '  (left alone)'));
}

if (APPLY) {
  for (const email of toGrant) await grantEntitlement(email, ALL_ACCESS);
  console.log(`\ngranted to ${toGrant.length} member(s).`);
} else {
  console.log('\nDry run. Add --apply to write.\n');
}
