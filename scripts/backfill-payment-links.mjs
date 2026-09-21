/**
 * Link members to their Stripe payment where the row is missing it.
 *
 *   node --env-file=.env.local scripts/backfill-payment-links.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-payment-links.mjs --apply
 *
 * Early purchases predate storing the PaymentIntent (and customer) on the
 * customer row, so the admin refund picker had nothing to look up for them.
 * Stripe can't search charges by email, so this scans recent PaymentIntents,
 * matches on the email that paid, and fills in last_payment_intent — and the
 * customer id when the intent carries one. Only ever fills a blank.
 */
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';

const APPLY = process.argv.includes('--apply');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sql = neon(process.env.DATABASE_URL);

// email -> { intent, customer } from the most recent succeeded payment
const byEmail = new Map();
let startingAfter;
for (let page = 0; page < 6; page++) {
  const list = await stripe.paymentIntents.list({
    limit: 100, expand: ['data.latest_charge'],
    ...(startingAfter ? { starting_after: startingAfter } : {})
  });
  for (const pi of list.data) {
    if (pi.status !== 'succeeded') continue;
    const c = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const email = (pi.receipt_email || c?.billing_details?.email || '').toLowerCase();
    if (!email || byEmail.has(email)) continue;   // list is newest-first
    byEmail.set(email, { intent: pi.id, customer: typeof pi.customer === 'string' ? pi.customer : null });
  }
  if (!list.has_more || !list.data.length) break;
  startingAfter = list.data[list.data.length - 1].id;
}

const rows = await sql`select email, stripe_customer_id, last_payment_intent from customers
                        where last_payment_intent is null or stripe_customer_id is null`;
console.log(`${rows.length} member(s) with a missing link\n`);
let fixed = 0;

for (const r of rows) {
  const hit = byEmail.get(r.email);
  if (!hit) { console.log(`   —  ${r.email}  (no matching Stripe payment)`); continue; }
  const intent = r.last_payment_intent || hit.intent;
  const customer = r.stripe_customer_id || hit.customer;
  console.log(`   ok ${r.email}  →  intent ${hit.intent}${hit.customer ? ', customer ' + hit.customer : ''}`);
  fixed++;
  if (APPLY) {
    await sql`update customers
                 set last_payment_intent = ${intent},
                     stripe_customer_id  = ${customer},
                     updated_at = now()
               where email = ${r.email}`;
  }
}

console.log(`\n${fixed} of ${rows.length} linked`);
console.log(APPLY ? 'written.' : 'dry run — nothing written. Re-run with --apply to save.');
