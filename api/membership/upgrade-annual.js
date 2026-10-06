import Stripe from 'stripe';

/**
 * POST /api/membership/upgrade-annual — take the yearly offer shown straight
 * after checkout.
 *
 * By this point the buyer has paid for the specialists and the webhook has put
 * them on the three-day membership trial. Taking the yearly plan means: charge
 * $199 for twelve months on the card they just used, then end the trial. Anyone
 * who keeps the trial does nothing and this is never called.
 *
 * Identified by the payment intent's client secret, not its id. Stripe hands
 * the secret to the buyer's browser and nowhere else, whereas an id travels in
 * logs and redirects - and the id alone, if it were enough, would let anybody
 * who saw one put $199 on somebody else's card.
 *
 * Body: { paymentIntentId, clientSecret }
 * Returns one of:
 *   { ok: true, subscription }         charged, trial ended
 *   { already: true }                  already on the yearly plan
 *   { url }                            the card needs authentication; send the
 *                                      browser here to finish
 *   { error }                          with a 4xx/5xx
 */

const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID;
  if (!key) return res.status(500).json({ error: 'Payments are not configured yet.' });
  if (!annual) {
    console.error('[upgrade-annual] STRIPE_ANNUAL_PRICE_ID is not set.');
    return res.status(500).json({ error: 'The yearly plan is not configured yet.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const paymentIntentId = String(body.paymentIntentId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();
  if (!paymentIntentId || !clientSecret) {
    return res.status(400).json({ error: 'Missing the order reference.' });
  }

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
    if (!pi) return res.status(404).json({ error: 'That order could not be found.' });

    // Constant-time-ish comparison is overkill for a value Stripe itself treats
    // as a bearer token in the URL, but a plain mismatch must still be a flat
    // refusal rather than a hint about which part was wrong.
    if (pi.client_secret !== clientSecret) {
      console.error('[upgrade-annual] client secret mismatch for', paymentIntentId);
      return res.status(403).json({ error: 'That order could not be verified.' });
    }
    if (pi.status !== 'succeeded') {
      return res.status(409).json({ error: 'That order has not completed yet.' });
    }

    const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
    if (!customerId) {
      console.error('[upgrade-annual] no customer on', paymentIntentId);
      return res.status(409).json({ error: 'That order has no customer on it.' });
    }

    const subs = await stripe.subscriptions
      .list({ customer: customerId, status: 'all', limit: 20 })
      .then((r) => r.data)
      .catch(() => []);

    // Already yearly — a second click, or a reload of the page. Charging again
    // is the one outcome this must never produce.
    const onAnnual = subs.find((s) => LIVE.has(s.status)
      && s.items.data.some((i) => i.price?.id === annual));
    if (onAnnual) return res.status(200).json({ already: true, subscription: onAnnual.id });

    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    const paymentMethod = typeof pi.payment_method === 'string'
      ? pi.payment_method : pi.payment_method?.id;

    let created = null;
    if (paymentMethod) {
      try {
        created = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: annual, quantity: 1 }],
          default_payment_method: paymentMethod,
          // Nobody is at a card form: they clicked a button on a page that
          // promised no card entry. error_if_incomplete turns "this card needs
          // the bank's say-so" into a failure we can answer with a checkout
          // link, instead of a subscription sitting unpaid and unmentioned.
          off_session: true,
          payment_behavior: 'error_if_incomplete',
          metadata: { source: 'post-purchase-upsell', payment_intent: pi.id }
        }, { idempotencyKey: `annual_${pi.id}` });
      } catch (err) {
        // A decline or an authentication demand both land here. Neither is an
        // error on our side, so fall through to hosted checkout rather than
        // telling somebody their payment broke.
        console.log('[upgrade-annual] off-session charge not possible for', customerId, '-', err.message);
      }
    }

    if (!created) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: annual, quantity: 1 }],
        customer: customerId,
        subscription_data: { metadata: { source: 'post-purchase-upsell', payment_intent: pi.id } },
        success_url: `${site}/success.html?annual=1&payment_intent=${encodeURIComponent(pi.id)}`,
        cancel_url: `${site}/success.html?payment_intent=${encodeURIComponent(pi.id)}`,
        metadata: { payment_intent: pi.id }
      });
      return res.status(200).json({ url: session.url });
    }

    // End the trial only once the year is actually paid for, and only the
    // monthly one. Cancelling first would leave a gap with nothing live on the
    // account, and the webhook revokes all-access the moment a member's last
    // subscription ends.
    const trials = subs.filter((s) => (s.status === 'trialing' || s.status === 'active')
      && s.id !== created.id
      && !s.items.data.some((i) => i.price?.id === annual));
    for (const t of trials) {
      await stripe.subscriptions.cancel(t.id).catch((err) =>
        console.error('[upgrade-annual] could not cancel', t.id, '-', err.message));
      console.log('[upgrade-annual] cancelled', t.status, t.id, 'after the yearly plan started');
    }

    return res.status(200).json({ ok: true, subscription: created.id, replaced: trials.length });
  } catch (err) {
    console.error('[upgrade-annual]', err);
    return res.status(500).json({ error: 'Could not start the yearly plan. Please try again.' });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
