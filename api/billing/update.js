import Stripe from 'stripe';
import { getCustomer } from '../../lib/db.js';
import { readBillingToken } from '../../lib/billing-token.js';

/**
 * /api/billing/update?t=…
 *
 * The button in a payment reminder. Verifies the token, opens a Stripe billing
 * portal session for that customer and sends them straight there — no sign-in,
 * which is the whole point of the token.
 *
 * A GET is safe here, unlike the unsubscribe link: creating a portal session
 * changes nothing. A link scanner that follows this makes a session nobody
 * uses, and it expires on its own.
 *
 * The card never touches us. Stripe's portal collects it, which is also why
 * this is the only sensible destination for a long-lived link: the worst a
 * stolen one can do is show somebody a card's last four digits and let them
 * replace it with their own, and it cannot read the member area at all.
 */
const page = ({ title, message }) => `<!doctype html>
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
  p{color:#a1a1aa;font-size:15px;line-height:1.6;margin:0}
  a{color:#ffb020}
</style></head>
<body><div class="card"><div class="brand">AI Founder University</div>
<h1>${title}</h1><p>${message}</p></div></body></html>`;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const url = new URL(req.url, 'http://localhost');
    const who = readBillingToken(url.searchParams.get('t'), 'portal');

    if (!who) {
      return res.status(400).end(page({
        title: 'That link has expired',
        message: 'Payment links last two weeks. Reply to any of our emails and we\'ll send a fresh one.'
      }));
    }

    const key = process.env.STRIPE_SECRET_KEY;
    const customer = await getCustomer(who.email);
    if (!key || !customer?.stripe_customer_id) {
      console.error('[billing/update] no stripe customer for', who.email);
      return res.status(500).end(page({
        title: 'We couldn\'t open your billing',
        message: 'Please reply to any of our emails and we\'ll sort it out by hand.'
      }));
    }

    const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${site}/members/account.html`
    });

    res.setHeader('Location', session.url);
    return res.status(302).end('');
  } catch (err) {
    // The portal has to be switched on once in the Stripe dashboard. Until it
    // is, this is the error, and it is ours rather than the member's.
    console.error('[billing/update]', err?.message || err);
    return res.status(500).end(page({
      title: 'We couldn\'t open your billing',
      message: 'Please reply to any of our emails and we\'ll sort it out by hand.'
    }));
  }
}
