import Stripe from 'stripe';
import { sessionEmail } from '../../lib/session.js';
import { getCustomer, entitlementsFor } from '../../lib/db.js';
import { ALL_ACCESS } from '../../lib/products.js';

const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/**
 * POST /api/membership/subscribe — start the $39/month membership.
 *
 * Returns a Stripe Checkout URL for the browser to go to. Hosted Checkout
 * rather than a card form of our own: it carries 3-D Secure, wallets and
 * retries without any of that living here, and a subscription is the one place
 * where getting authentication wrong means a member who thinks they paid and
 * has not.
 *
 * No trial. Somebody arriving here has already been a member and has chosen to
 * come back, so a week of free access would only delay the thing they asked
 * for.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'Please sign in first.' });

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!key) return res.status(500).json({ error: 'Payments are not configured yet.' });
  if (!price) {
    console.error('[membership/subscribe] STRIPE_MONTHLY_PRICE_ID is not set.');
    return res.status(500).json({ error: 'The membership is not configured yet.' });
  }

  try {
    // Already in. Sending them to pay again is the one thing this must not do.
    const held = await entitlementsFor(email);
    if (held.has(ALL_ACCESS)) return res.status(200).json({ already: true });

    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    // Reuse the customer we already have, so a returning member keeps one
    // billing history rather than collecting a new customer per attempt.
    const known = await getCustomer(email);
    let customerId = known?.stripe_customer_id || null;

    if (customerId) {
      // The stored id can be stale — a customer deleted in Stripe, or one from
      // a different mode. Checked before it is used, because passing a bad id
      // to Checkout fails the whole thing and leaves somebody unable to pay for
      // a reason they can do nothing about. Falling back to the email just
      // makes a fresh customer, which is recoverable; refusing is not.
      const known = await stripe.customers.retrieve(customerId).catch(() => null);
      if (!known || known.deleted) {
        console.error('[membership/subscribe] stale customer for', email, '-', customerId);
        customerId = null;
      }
    }

    if (customerId) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
        .catch(() => ({ data: [] }));
      const live = subs.data.find((s) => LIVE.has(s.status));
      // Paying already but the entitlement has not caught up — the webhook will
      // see the next invoice. Charging again would be worse than waiting.
      if (live) return res.status(200).json({ already: true, status: live.status });
    }

    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: email }),
      // No trial_period_days: this is a deliberate restart, not a first look.
      subscription_data: { metadata: { source: 'members-join', email } },
      success_url: `${site}/members/?joined=1`,
      cancel_url: `${site}/members/join.html?cancelled=1`,
      allow_promotion_codes: true,
      metadata: { email }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[membership/subscribe]', err);
    return res.status(500).json({ error: 'Could not start the subscription. Please try again.' });
  }
}
