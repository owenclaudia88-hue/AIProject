/**
 * Test-mode only: pay a Funnel Engine checkout intent with Stripe's test card,
 * then hand the succeeded event to the local webhook, signed the way Stripe
 * signs it - so the whole order can be run without the Stripe CLI.
 *
 *   node --env-file=.env.local scripts/test-funnel-engine-order.mjs <pi_id> [--name="Fetest Buyer"] [--port=3000]
 *
 * Refuses to run on a live key.
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY || '';
if (!key.startsWith('sk_test_')) {
  console.error('Refusing: this only runs in Stripe test mode.');
  process.exit(1);
}
const args = Object.fromEntries(process.argv.slice(3)
  .map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=')]));
const id = process.argv[2];
const port = args.port || '3000';
const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

let pi = await stripe.paymentIntents.retrieve(id);
console.log('intent:', pi.id, pi.status, pi.amount, pi.metadata.source, pi.metadata.addons || '(no bumps)',
  pi.metadata.buyer_email || '(no email)');
if (pi.status !== 'succeeded') {
  pi = await stripe.paymentIntents.confirm(id, {
    payment_method_data: {
      type: 'card', card: { token: 'tok_visa' },
      billing_details: { name: args.name || 'Fetest Buyer', email: pi.metadata.buyer_email }
    },
    return_url: `http://localhost:${port}/funnel-engine/success.html`
  });
  console.log('confirmed:', pi.status);
}

const payload = JSON.stringify({
  id: `evt_test_${Date.now()}`, object: 'event', type: 'payment_intent.succeeded',
  livemode: false, data: { object: pi }
});
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
const res = await fetch(`http://localhost:${port}/api/stripe-webhook`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload
});
console.log('webhook:', res.status, (await res.text()).slice(0, 200));

const subs = await stripe.subscriptions.list({ customer: pi.customer, status: 'all', limit: 5 });
const cust = await stripe.customers.retrieve(pi.customer);
console.log('customer:', cust.email, cust.name, '| subscriptions:', subs.data.length);
