import Stripe from 'stripe';
import { getCustomer } from '../../lib/db.js';
import { readBillingToken, billingToken } from '../../lib/billing-token.js';
import { offerForSubscription } from '../../lib/offer.js';

/**
 * /api/billing/offer?t=…
 *
 * Takes the discount offered in the second-to-last payment reminder.
 *
 * GET asks, POST does it — the same rule as the unsubscribe page and for the
 * same reason: a link in an email is fetched by scanners, previewers and
 * security filters, and a GET that changes a subscription gets changed by all
 * of them. Here that would silently hand a discount to somebody who never
 * clicked.
 *
 * Applying it is two writes, not one. The coupon goes on the subscription, so
 * the next invoices are discounted and Stripe drops the discount by itself when
 * its months are up — nothing of ours has to remember to put the price back.
 * And it goes on the invoice that is currently failing, because the offer says
 * "from this payment onward", and a coupon that only reached future invoices
 * would leave them retrying the full amount they already could not pay.
 */
const page = ({ title, message, action = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — AI Founder University</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0b;color:#f4f4f5;
    font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:480px;background:#111113;border:1px solid #26262b;border-radius:16px;padding:32px;text-align:center}
  .brand{font-weight:800;color:#ffb020;font-size:14px;margin-bottom:18px}
  h1{font-size:20px;font-weight:600;margin:0 0 12px}
  p{color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px}
  p:last-child{margin-bottom:0}
  button{font:inherit;font-weight:700;font-size:15px;border-radius:999px;padding:13px 26px;cursor:pointer;
    border:0;background:linear-gradient(180deg,#ffb020,#ff7a1a);color:#1a0d00}
  .small{color:#71717a;font-size:13px}
  a{color:#ffb020}
</style></head>
<body><div class="card"><div class="brand">AI Founder University</div>
<h1>${title}</h1><p>${message}</p>${action}</div></body></html>`;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/** The subscription this offer is about, and the invoice that is failing on it. */
async function findSubscription(stripe, customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
    .catch(() => ({ data: [] }));
  // past_due first: that is the one the member was written to about.
  return subs.data.find((s) => s.status === 'past_due')
    || subs.data.find((s) => LIVE.has(s.status))
    || null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const sorry = (title, message) => res.status(200).end(page({
    title, message: message
      + ' Please reply to the email and we\'ll sort it out by hand.'
  }));

  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('t');
    const who = readBillingToken(token, 'offer');

    if (!who) {
      return res.status(400).end(page({
        title: 'That link has expired',
        message: 'Offers in payment emails last two weeks. Reply to any of our emails and we\'ll see what we can do.'
      }));
    }

    const key = process.env.STRIPE_SECRET_KEY;
    const customer = await getCustomer(who.email);
    if (!key || !customer?.stripe_customer_id) {
      return sorry('We couldn\'t find your subscription', 'There is no billing record on this address.');
    }

    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const sub = await findSubscription(stripe, customer.stripe_customer_id);
    if (!sub) {
      return sorry('That subscription has already ended', 'There is nothing here to apply the discount to.');
    }

    /* Described from the coupon itself, so this page cannot offer something
       different from what the email said or from what Stripe will do. */
    const offer = await offerForSubscription(stripe, sub);
    if (!offer) {
      return sorry('That offer is no longer available', 'We could not read the discount.');
    }

    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    const portal = `${site}/api/billing/update?t=${encodeURIComponent(billingToken(who.email, 'portal'))}`;

    if (req.method !== 'POST') {
      // Ask, and change nothing. Scanners stop here.
      return res.status(200).end(page({
        title: 'Keep your membership for less',
        message: `This applies <strong>${esc(offer.label)}</strong> to your membership, starting with the
          payment that is currently failing. After that it goes back to the normal price on its own.`,
        action: `<form method="post" action="/api/billing/offer?t=${esc(token)}">
                   <button type="submit">Apply my discount</button>
                 </form>
                 <p class="small" style="margin-top:16px">Nothing has changed yet.</p>`
      }));
    }

    /* The invoice that is failing comes first, because it is the bill in front
       of them and the one the offer is about. Without this the retry charges
       the full amount they already could not pay. */
    let invoiceFixed = false;
    try {
      const open = await stripe.invoices.list({
        customer: customer.stripe_customer_id, subscription: sub.id, status: 'open', limit: 1
      });
      if (open.data[0]) {
        await stripe.invoices.update(open.data[0].id, { discounts: [{ coupon: offer.coupon.id }] });
        invoiceFixed = true;
      }
    } catch (err) {
      console.error('[billing/offer] could not discount the open invoice:', err?.message || err);
    }

    /* And onto the subscription, for the months after it — but only where the
       offer says so. A yearly plan is deliberately left alone: its coupon is a
       single use that has just been spent on the invoice above, and putting it
       on the subscription as well would discount next year instead, which is
       both the wrong year and a second discount nobody offered. */
    if (offer.onSubscription && !(sub.discounts?.length || sub.discount)) {
      await stripe.subscriptions.update(sub.id, { coupon: offer.coupon.id });
    }

    console.log(`[billing/offer] ${who.email} took ${offer.coupon.id}`
      + ` (${offer.interval}ly${invoiceFixed ? ', open invoice discounted' : ''}`
      + `${offer.onSubscription ? ', carried onto the subscription' : ', this invoice only'})`);

    return res.status(200).end(page({
      title: 'Done — that\'s applied',
      message: `<strong>${esc(offer.label)}</strong>${invoiceFixed
        ? ', starting with the payment that was failing' : ''}. After that it returns to the
        normal price automatically, and we will not ask you again.`,
      action: `<p class="small">One thing left: the card still needs to work.</p>
               <p><a href="${esc(portal)}">Update your card</a></p>`
    }));
  } catch (err) {
    console.error('[billing/offer]', err);
    return sorry('Something went wrong', 'The discount was not applied.');
  }
}
