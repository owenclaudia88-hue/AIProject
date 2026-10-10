import Stripe from 'stripe';
import { sessionEmail } from '../../lib/session.js';
import { getCustomer } from '../../lib/db.js';
import { resolveCustomerId } from '../../lib/funnel.js';
import { MEMBER_SOURCE } from '../../lib/products.js';

/**
 * The member's own subscription, and the four things they can do with it:
 * switch to the yearly plan, stop it at the end of the period, change their
 * mind about stopping it, and reach Stripe's billing portal for the card and
 * the invoices.
 *
 *   GET  /api/account/subscription            what they are on
 *   POST /api/account/subscription  { action }
 *        preview-annual   what switching would cost today — numbers only
 *        switch-annual    actually switch
 *        cancel           stop at the end of the period
 *        resume           undo that
 *        portal           a Stripe billing portal link
 *
 * This is the first member-facing write to a subscription, so two rules run
 * through all of it. Nothing is taken from the browser but the action: the
 * subscription acted on is always the one found from the signed-in member's
 * own Stripe customer, so a crafted request cannot reach anybody else's. And
 * nothing here ends access on the spot — cancelling sets the period end, which
 * is what the button says it does and what a member expects for money already
 * paid.
 */

/* Live enough to be worth showing and acting on. 'unpaid' is deliberately out:
   by the time Stripe marks a subscription unpaid the webhook has already taken
   the membership away, so offering to manage it would be offering to manage
   something that has gone. */
const LIVE = new Set(['active', 'trialing', 'past_due', 'paused']);

/**
 * Who this is for, and only who it is for.
 *
 * Two groups chose a recurring plan with their eyes open: the people who
 * bought the membership from the homepage, and the people who, on the offer
 * after the Specialists checkout, took either the three-day trial or the
 * twelve months. They are the ones with something of their own to manage.
 *
 * Everybody else — the earlier subscribers, the lifetime buyers, anybody whose
 * membership arrived another way — is left exactly as they were: the request
 * answers "nothing here", the panel never appears, and no Stripe call is made
 * on their behalf. The check sits in front of all of that on purpose.
 */
const CHOSE_A_PLAN = new Set(['trial', 'year']);

function eligible(customer) {
  if (!customer) return false;
  return customer.source === MEMBER_SOURCE || CHOSE_A_PLAN.has(customer.upsell_choice);
}

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'Please sign in first.' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Payments are not configured yet.' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const found = await findSubscription(stripe, email);

    // No subscription is not an error. A lifetime buyer who never took the
    // membership has nothing to manage, and the panel simply stays away.
    if (!found) return res.status(200).json({ has: false });

    if (req.method === 'GET') return res.status(200).json(await describeWithSaving(stripe, found));

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
    const action = String(body.action || '');

    if (action === 'portal') return portal(stripe, found, res);
    if (action === 'cancel' || action === 'resume') return setCancel(stripe, found, action, res, email);
    if (action === 'preview-annual') return previewAnnual(stripe, found, res);
    if (action === 'switch-annual') return switchAnnual(stripe, found, res, email);

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('[account/subscription]', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

/* ---------------- finding it ---------------- */

/**
 * The one subscription this member is on. Resolved from their own Stripe
 * customer every time rather than from anything the browser sent.
 */
async function findSubscription(stripe, email) {
  const customer = await getCustomer(email);
  // Checked before Stripe is touched: somebody this was not built for should
  // not cost a round trip, and must not be able to act on a subscription
  // through it either. Both the reads and the writes come through here.
  if (!eligible(customer)) return null;
  const customerId = await resolveCustomerId(customer);
  if (!customerId) return null;

  const subs = await stripe.subscriptions
    .list({ customer: customerId, status: 'all', limit: 20 })
    .then((r) => r.data)
    .catch(() => []);

  // Newest first, so somebody who restarted after cancelling manages the one
  // they are actually paying for.
  const live = subs
    .filter((s) => LIVE.has(s.status))
    .sort((a, b) => b.created - a.created)[0];
  return live ? { customerId, sub: live, item: live.items.data[0] || null } : null;
}

/* The period end moved onto the item in recent API versions and still exists on
   the subscription in older ones. Read both, because this has to be right: it
   is the date printed next to "renews on" and next to "access ends". */
const periodEnd = ({ sub, item }) => item?.current_period_end || sub.current_period_end || null;

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);

function planOf(item) {
  const price = item?.price || null;
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID;
  const interval = price?.recurring?.interval || null;
  return {
    priceId: price?.id || null,
    amount: price?.unit_amount ?? null,
    currency: price?.currency || 'usd',
    interval,
    isAnnual: !!(annual && price?.id === annual) || interval === 'year'
  };
}

function describe({ sub, item }) {
  const plan = planOf(item);
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID;
  const monthlyAmount = plan.interval === 'month' ? plan.amount : null;

  return {
    has: true,
    status: sub.status,
    plan,
    // Where the money next moves. For a trial that is the day it ends and the
    // first charge lands, which is the date somebody on a trial wants.
    renewsAt: iso(periodEnd({ sub, item })),
    trialEndsAt: iso(sub.trial_end),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    endsAt: sub.cancel_at_period_end ? iso(sub.cancel_at || periodEnd({ sub, item })) : null,
    // Offered only when there is somewhere to go: a monthly plan, a configured
    // yearly price, and not already on the way out.
    canSwitchToAnnual: !!annual && !plan.isAnnual && !sub.cancel_at_period_end && !!item,
    monthlyAmount
  };
}

/**
 * The same thing, plus what the year saves against twelve of these months.
 * Worked out from the live prices rather than written into the copy, so the
 * number on the button cannot drift away from the number on the invoice.
 */
async function describeWithSaving(stripe, found) {
  const out = describe(found);
  if (!out.canSwitchToAnnual || !out.monthlyAmount) return out;
  const price = await stripe.prices.retrieve(process.env.STRIPE_ANNUAL_PRICE_ID).catch(() => null);
  const year = price?.unit_amount;
  if (typeof year === 'number') {
    out.annualAmount = year;
    const saving = out.monthlyAmount * 12 - year;
    out.annualSaving = saving > 0 ? saving : null;
  }
  return out;
}

/* ---------------- the actions ---------------- */

async function portal(stripe, found, res) {
  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: found.customerId,
      return_url: `${site}/members/account.html`
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // The portal has to be switched on once in the Stripe dashboard. Until it
    // is, every call fails the same way, and a member should be told something
    // truthful rather than "try again" forever.
    console.error('[account/subscription] portal unavailable:', err.message);
    return res.status(503).json({
      error: 'The billing page is not available right now. Please email support and we will sort it out.'
    });
  }
}

async function setCancel(stripe, found, action, res, email) {
  const stop = action === 'cancel';
  const updated = await stripe.subscriptions.update(found.sub.id, { cancel_at_period_end: stop });
  console.log(`[account/subscription] ${email} ${stop ? 'set to end' : 'resumed'} ${found.sub.id}`);
  return res.status(200).json(describe({ sub: updated, item: updated.items.data[0] || null }));
}

/**
 * What switching would actually cost, asked of Stripe rather than worked out
 * here. A member is about to be charged, so the figure in front of them has to
 * be the figure on the invoice — including the credit for the days of the
 * month they have already paid for and will not use.
 */
/**
 * The yearly price, checked rather than assumed.
 *
 * Test and live Stripe have different ids for the same plan, and a key and a
 * price from different modes fail in a way that reads like a bug in here. This
 * turns that into one clear line in the log and one honest sentence to the
 * member, and - because it runs before anything is charged - it cannot put
 * somebody on the wrong plan.
 */
async function annualPrice(stripe, sub) {
  const id = process.env.STRIPE_ANNUAL_PRICE_ID;
  if (!id) {
    console.error('[account/subscription] STRIPE_ANNUAL_PRICE_ID is not set.');
    return { error: 'The yearly plan is not configured yet.' };
  }
  const price = await stripe.prices.retrieve(id).catch(() => null);
  if (!price) {
    console.error('[account/subscription] STRIPE_ANNUAL_PRICE_ID', id,
      'does not exist for this key — check it is the id for this Stripe mode.');
    return { error: 'The yearly plan is not configured yet.' };
  }
  if (price.livemode !== sub.livemode) {
    console.error('[account/subscription] mode mismatch: price', id, 'is',
      price.livemode ? 'live' : 'test', 'but the subscription is',
      sub.livemode ? 'live' : 'test');
    return { error: 'The yearly plan is not configured yet.' };
  }
  return { id, price };
}

async function previewAnnual(stripe, found, res) {
  const got = await annualPrice(stripe, found.sub);
  if (got.error) return res.status(500).json({ error: got.error });
  const annual = got.id;
  if (planOf(found.item).isAnnual) return res.status(200).json({ already: true });

  const up = await stripe.invoices.retrieveUpcoming({
    customer: found.customerId,
    subscription: found.sub.id,
    subscription_items: [{ id: found.item.id, price: annual, quantity: 1 }],
    subscription_proration_behavior: 'always_invoice'
  });

  const lines = up.lines?.data || [];
  const credit = lines.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0);
  let charges = lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0);

  /* During a trial every line on that invoice is zero — the trial itself is
     the only thing on it — so the honest figure for "twelve months" is the
     price of the year, taken from the price rather than from an invoice that
     has not been raised yet. Reporting Stripe's zero here would have told a
     member the year costs nothing. */
  const keepsTrial = found.sub.status === 'trialing';
  if (keepsTrial) charges = got.price.unit_amount ?? charges;

  return res.status(200).json({
    currency: up.currency,
    charges,
    credit,                       // negative, or 0
    dueToday: up.amount_due,
    // A trial keeps its free days: Stripe bills nothing today and takes the
    // year when the trial ends. Said plainly rather than left to be discovered.
    keepsTrial,
    chargedOn: keepsTrial ? iso(found.sub.trial_end) : null
  });
}

async function switchAnnual(stripe, found, res, email) {
  const got = await annualPrice(stripe, found.sub);
  if (got.error) return res.status(500).json({ error: got.error });
  const annual = got.id;

  // A second click, or a reload. Charging a second year is the one outcome
  // this must never produce.
  if (planOf(found.item).isAnnual) return res.status(200).json({ already: true });

  const updated = await stripe.subscriptions.update(found.sub.id, {
    items: [{ id: found.item.id, price: annual, quantity: 1 }],
    proration_behavior: 'always_invoice',
    expand: ['latest_invoice']
  }, { idempotencyKey: `annual_${found.sub.id}_${found.item.id}` });

  console.log(`[account/subscription] ${email} switched ${found.sub.id} to the yearly plan`);

  /* The invoice is raised and charged in the same breath. When the card wants
     the bank's say-so it stays open instead, and the member needs somewhere to
     go and finish it — otherwise they are on the yearly plan on paper with an
     unpaid invoice nobody mentioned. */
  const inv = updated.latest_invoice && typeof updated.latest_invoice === 'object'
    ? updated.latest_invoice : null;
  const needsPayment = inv && inv.status === 'open' && inv.amount_due > 0;

  return res.status(200).json({
    ...describe({ sub: updated, item: updated.items.data[0] || null }),
    switched: true,
    needsPayment: !!needsPayment,
    payUrl: needsPayment ? inv.hosted_invoice_url : null
  });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
