import Stripe from 'stripe';

/**
 * The checkout funnel, read back from Stripe.
 *
 * Every attempt at checkout creates a PaymentIntent, whether or not the card
 * is ever charged, and each carries the email typed into the form and — once
 * the buyer gets as far as confirming — the name from billing details. That
 * makes Stripe the record of who started and who finished; nothing needs
 * storing on our side to know it.
 *
 * Intents that go nowhere are included deliberately: someone who typed their
 * address and did not buy is the most interesting row on the page.
 */

const stripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key);
};

/** An intent that never became money, but is not a live attempt either. */
const ABANDONED = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action', 'canceled']);

export async function checkoutFunnel({ limit = 500 } = {}) {
  const stripe = stripeClient();

  const attempts = [];
  let startingAfter;
  // Stripe pages at 100; walk until we have them all or hit the ceiling.
  while (attempts.length < limit) {
    const page = await stripe.paymentIntents.list({
      limit: Math.min(100, limit - attempts.length),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      expand: ['data.latest_charge']
    });
    for (const pi of page.data) {
      const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      attempts.push({
        id: pi.id,
        email: (pi.receipt_email || charge?.billing_details?.email || '').toLowerCase() || null,
        name: charge?.billing_details?.name || pi.shipping?.name || null,
        status: pi.status,
        paid: pi.status === 'succeeded',
        abandoned: ABANDONED.has(pi.status),
        amount: pi.amount,
        currency: pi.currency,
        refunded: !!charge?.refunded,
        amountRefunded: charge?.amount_refunded ?? 0,
        createdAt: new Date(pi.created * 1000).toISOString()
      });
    }
    if (!page.has_more || !page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  // One person can attempt several times. Count people, not attempts, or a
  // buyer whose first card was declined reads as a failure and a success.
  const byEmail = new Map();
  for (const a of attempts) {
    if (!a.email) continue;
    const prev = byEmail.get(a.email);
    if (!prev || (a.paid && !prev.paid) || (!prev.name && a.name)) {
      byEmail.set(a.email, { ...a, paid: a.paid || prev?.paid || false, name: a.name || prev?.name || null });
    }
  }

  const people = [...byEmail.values()];
  const converted = people.filter((p) => p.paid).length;

  return {
    attempts,
    people,
    stats: {
      attempts: attempts.length,
      people: people.length,
      converted,
      notConverted: people.length - converted,
      // Of everyone who put an address into the checkout, how many paid.
      conversionRate: people.length ? Math.round((converted / people.length) * 1000) / 10 : 0
    }
  };
}

/** Refund a payment. The caller has already established this is a real admin. */
export async function refundPayment(paymentIntentId) {
  const stripe = stripeClient();
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  return { id: refund.id, status: refund.status, amount: refund.amount, currency: refund.currency };
}

/* ---------------- one member's billing, for the admin ---------------- */

/**
 * The Stripe customer behind a member row. New purchases store it directly;
 * older one-offs predate that, so fall back to the customer on their saved
 * PaymentIntent. Returns null when there is simply no Stripe customer — an old
 * one-off charge with no customer attached.
 */
export async function resolveCustomerId(customerRow) {
  if (customerRow?.stripe_customer_id) return customerRow.stripe_customer_id;
  if (customerRow?.last_payment_intent) {
    const stripe = stripeClient();
    try {
      const pi = await stripe.paymentIntents.retrieve(customerRow.last_payment_intent);
      if (typeof pi.customer === 'string') return pi.customer;
      if (pi.customer?.id) return pi.customer.id;
    } catch { /* intent from another account or deleted — nothing to resolve */ }
  }
  return null;
}

const chargeItem = (c) => ({
  ref: c.id,
  amount: c.amount,
  currency: c.currency,
  date: new Date(c.created * 1000).toISOString(),
  // an invoice id means it came from the subscription; otherwise it's the
  // one-off purchase
  label: c.invoice ? 'Membership' : 'Purchase',
  isSubscription: !!c.invoice,
  refunded: (c.amount_refunded || 0) >= c.amount,
  amountRefunded: c.amount_refunded || 0,
  refundable: c.status === 'succeeded' && c.paid && (c.amount_refunded || 0) < c.amount
});

/**
 * Every payment this member has made — the $1 purchase and any membership
 * charges — newest first, each flagged with whether it can still be refunded.
 */
export async function memberPayments(customerRow) {
  const stripe = stripeClient();
  const customerId = await resolveCustomerId(customerRow);
  let items = [];

  if (customerId) {
    const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
    items = charges.data.map(chargeItem);
  } else if (customerRow?.last_payment_intent) {
    // legacy one-off with no customer: derive the single charge from the intent
    const pi = await stripe.paymentIntents.retrieve(customerRow.last_payment_intent, { expand: ['latest_charge'] });
    const c = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    if (c) items = [chargeItem(c)];
  }

  // Nothing linked — an early purchase from before we stored the customer or
  // intent on the row. Stripe can't search charges by email, so find it the
  // way the funnel does: scan recent PaymentIntents for a matching email. This
  // is what surfaces the $1 for members who bought before that wiring existed.
  if (!items.length && customerRow?.email) {
    const email = String(customerRow.email).toLowerCase();
    const seen = new Set();
    let startingAfter;
    for (let page = 0; page < 5; page++) {   // up to 500 recent intents
      const list = await stripe.paymentIntents.list({
        limit: 100, expand: ['data.latest_charge'],
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });
      for (const pi of list.data) {
        const c = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
        const em = (pi.receipt_email || c?.billing_details?.email || '').toLowerCase();
        if (c && em === email && !seen.has(c.id)) { seen.add(c.id); items.push(chargeItem(c)); }
      }
      if (!list.has_more || !list.data.length) break;
      startingAfter = list.data[list.data.length - 1].id;
    }
  }

  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { customerId, items };
}

/** Refund one charge by its id. */
export async function refundChargeById(chargeId) {
  const stripe = stripeClient();
  const r = await stripe.refunds.create({ charge: chargeId });
  return { id: r.id, status: r.status, amount: r.amount, currency: r.currency };
}

/** The subscriptions still worth cancelling — anything not already ended. */
export async function activeSubscriptions(customerId) {
  if (!customerId) return [];
  const stripe = stripeClient();
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  const live = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);
  return subs.data.filter((s) => live.has(s.status));
}

/** Cancel every live subscription for a customer. Returns the ids cancelled. */
export async function cancelActiveSubscriptions(customerId) {
  const stripe = stripeClient();
  const subs = await activeSubscriptions(customerId);
  const cancelled = [];
  for (const s of subs) {
    try { await stripe.subscriptions.cancel(s.id); cancelled.push(s.id); }
    catch (err) { console.error('[funnel] cancel subscription failed:', s.id, err.message); }
  }
  return cancelled;
}
