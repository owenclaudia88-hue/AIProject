import Stripe from 'stripe';
import { MEMBER_SOURCE } from '../../lib/products.js';

/**
 * POST /api/membership/join — start a membership from the homepage checkout.
 *
 * Every other way into the membership starts somewhere else: the $1 buyer is
 * enrolled by the webhook, and /api/membership/subscribe needs them signed in
 * already. This is the only door a stranger can walk through, so it does the
 * two things nothing else has done for them — makes the Stripe customer that
 * carries their email, and creates the subscription that pays for it.
 *
 * No trial. The page promises "charged today" for both plans, and a trial here
 * would contradict the sentence the buyer agreed to. The three-day trial
 * belongs to the $1 funnel, where it is the thing being offered.
 *
 * Called only after elements.submit() has passed Stripe's own card checks, so
 * a form somebody abandons leaves no customer and no subscription behind.
 *
 * Body: { name, email, plan: 'month'|'year', fbclid, fbclidAt, fbp, vid, landingUrl }
 * Returns one of:
 *   { clientSecret }    confirm this on the client to take the first payment
 *   { already: true }   that email is already a member; send them to sign in
 *   { error }           with a 4xx/5xx
 */

const PLANS = {
  month: { env: 'STRIPE_MONTHLY_PRICE_ID', label: 'monthly' },
  year: { env: 'STRIPE_ANNUAL_PRICE_ID', label: 'yearly' }
};

/* What counts as already a member, and so a reason to refuse rather than
   charge. `unpaid` is deliberately absent, for the same reason it is absent
   from /api/membership/subscribe: Stripe marks a subscription unpaid once its
   retries are exhausted, and the webhook has already taken all-access away by
   then. Treating it as live would tell somebody they are a member, refuse them
   a checkout, and leave them no way back in. */
const LIVE = new Set(['active', 'trialing', 'past_due']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Payments are not configured yet.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 320);
  const planKey = body.plan === 'year' ? 'year' : 'month';
  const plan = PLANS[planKey];

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });

  const price = process.env[plan.env];
  if (!price) {
    console.error(`[membership/join] ${plan.env} is not set.`);
    return res.status(500).json({ error: `The ${plan.label} plan is not configured yet.` });
  }

  /* The ad click that paid for this, kept on the subscription because by the
     time the webhook reports the sale the browser is long gone. The IP and
     user agent are read from the request rather than taken from the body: the
     webhook would otherwise see Stripe's, and these are what Meta matches on
     when there is no click id to match. */
  const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip'] || '';
  const clientUa = req.headers['user-agent'] || '';
  const landingUrl = (String(body.landingUrl || '') || String(req.headers.referer || '')).slice(0, 500);

  const attribution = {
    ...(body.fbclid ? { fbclid: String(body.fbclid).slice(0, 255) } : {}),
    ...(Number(body.fbclidAt) > 0 ? { fbclid_at: String(Math.round(Number(body.fbclidAt))) } : {}),
    ...(body.fbp ? { fbp: String(body.fbp).slice(0, 255) } : {}),
    ...(body.vid ? { vid: String(body.vid).slice(0, 255) } : {}),
    ...(clientIp ? { client_ip: String(clientIp).slice(0, 100) } : {}),
    ...(clientUa ? { client_ua: String(clientUa).slice(0, 255) } : {}),
    ...(landingUrl ? { landing_url: landingUrl } : {})
  };

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

    /* One customer per address. Somebody who bought the $1 months ago already
       has one, and making a second would split their history in two and leave
       the webhook granting access to a row nobody can sign in as. */
    const existing = await stripe.customers.list({ email, limit: 10 })
      .then((r) => r.data).catch(() => []);
    let customer = existing[0] || null;

    if (customer) {
      const subs = await stripe.subscriptions
        .list({ customer: customer.id, status: 'all', limit: 20 })
        .then((r) => r.data).catch(() => []);

      // Already paying. Charging again is the one outcome this must never
      // produce, and the page turns this into "sign in instead".
      if (subs.some((s) => LIVE.has(s.status))) {
        return res.status(200).json({ already: true });
      }

      /* An incomplete subscription from a card that was declined a minute ago,
         or from a double-tap. Its payment intent can still be confirmed with
         another card, so hand back the one that exists rather than stacking up
         a second subscription for every attempt. */
      const pending = subs.find((s) => s.status === 'incomplete'
        && s.items?.data?.some((i) => i.price?.id === price));
      if (pending) {
        const open = await stripe.subscriptions.retrieve(pending.id, {
          expand: ['latest_invoice.payment_intent']
        }).catch(() => null);
        const secret = open?.latest_invoice?.payment_intent?.client_secret;
        if (secret) {
          console.log('[membership/join] reusing incomplete subscription', pending.id, 'for', email);
          return res.status(200).json({ clientSecret: secret });
        }
      }
    }

    if (!customer) {
      customer = await stripe.customers.create({
        email,
        name,
        metadata: { source: MEMBER_SOURCE, ...attribution }
      });
    } else if (name && !customer.name) {
      // Known address, never named — the $1 checkout does not always get one.
      await stripe.customers.update(customer.id, { name }).catch(() => {});
    }

    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price, quantity: 1 }],
      /* The card is charged now and confirmed by the browser. default_incomplete
         is what gives us a payment intent to hand back: the subscription stays
         incomplete, and nothing is owed, until that intent succeeds. */
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      expand: ['latest_invoice.payment_intent'],
      /* `source` is what the webhook branches on to create the customers row
         and queue the one welcome — without it a member who never bought the
         $1 would have access and no way to sign in. The rest is the ad click,
         read back when the sale is reported. */
      metadata: {
        source: MEMBER_SOURCE,
        plan: planKey,
        name,
        ...attribution
      }
    });

    const pi = sub.latest_invoice?.payment_intent;
    if (!pi?.client_secret) {
      console.error('[membership/join] no payment intent on', sub.id);
      return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
    }

    /* The same ids on the payment intent as on the subscription. Everything
       that reports a sale today reads pi.metadata, and a value that lives in
       only one of the two places is a value somebody will later fail to find. */
    if (Object.keys(attribution).length) {
      await stripe.paymentIntents.update(pi.id, {
        metadata: { source: MEMBER_SOURCE, plan: planKey, buyer_email: email, ...attribution }
      }).catch((err) => console.error('[membership/join] could not tag the payment intent:', err.message));
    }

    console.log('[membership/join]', email, planKey, '->', sub.id);
    return res.status(200).json({ clientSecret: pi.client_secret });
  } catch (err) {
    console.error('[membership/join]', err);
    return res.status(500).json({ error: 'Could not start the membership. Please try again.' });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
