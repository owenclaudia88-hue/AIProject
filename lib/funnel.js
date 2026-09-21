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
