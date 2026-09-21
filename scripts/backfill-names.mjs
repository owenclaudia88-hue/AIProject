/**
 * Fill in the names of members who bought before we started keeping them.
 *
 *   node --env-file=.env.local scripts/backfill-names.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-names.mjs --apply
 *
 * Checkout has always asked for a full name and sent it to Stripe as
 * billing_details.name — it just was not stored. Stripe still has it, so this
 * reads it back for anyone whose row has no name yet, looking at the
 * customer record first and then the payment they made.
 *
 * Only ever fills a blank. A member who has set their own display name keeps
 * it.
 */
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';

const APPLY = process.argv.includes('--apply');
const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('STRIPE_SECRET_KEY not set.'); process.exit(1); }
const stripe = new Stripe(key);
const sql = neon(process.env.DATABASE_URL);

const clean = (s) => String(s || '').trim().slice(0, 60);

const rows = await sql`
  select email, stripe_customer_id, last_payment_intent
    from customers
   where name is null or btrim(name) = ''
   order by created_at`;

console.log(`${rows.length} member(s) without a stored name\n`);
let found = 0;

for (const r of rows) {
  let name = '';
  let source = '';

  // 1. the Stripe customer record
  if (r.stripe_customer_id) {
    try {
      const c = await stripe.customers.retrieve(r.stripe_customer_id);
      if (!c.deleted && clean(c.name)) { name = clean(c.name); source = 'customer record'; }
    } catch (e) { /* deleted or from another account — fall through */ }
  }

  // 2. the payment they made, where checkout put the name
  if (!name && r.last_payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(r.last_payment_intent, { expand: ['latest_charge'] });
      const ch = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      const n = clean(ch?.billing_details?.name) || clean(pi.shipping?.name);
      if (n) { name = n; source = 'payment billing details'; }
    } catch (e) { /* ditto */ }
  }

  if (!name) { console.log(`   —  ${r.email}  (Stripe has no name either)`); continue; }

  console.log(`   ok ${r.email}  →  "${name}"   [${source}]`);
  found++;
  if (APPLY) {
    await sql`update customers set name = ${name}, updated_at = now()
               where email = ${r.email} and (name is null or btrim(name) = '')`;
  }
}

console.log(`\n${found} of ${rows.length} recovered from Stripe`);
console.log(APPLY ? 'written.' : 'dry run — nothing written. Re-run with --apply to save.');
