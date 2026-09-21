import { Resend } from 'resend';

/**
 * Transactional email via Resend: the purchase confirmation (with the login
 * link) and the magic sign-in link.
 */

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

function from() {
  return process.env.EMAIL_FROM || 'AI Founder University <hello@aifounderuniversity.com>';
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
}

const shell = (heading, bodyHtml) => `
  <div style="background:#0a0a0b;padding:32px 0;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#111113;border:1px solid #26262b;border-radius:16px;padding:32px">
      <div style="font-weight:800;color:#ffb020;font-size:15px;letter-spacing:.02em;margin-bottom:20px">AI Founder University</div>
      <h1 style="color:#fff;font-size:22px;font-weight:600;margin:0 0 16px">${heading}</h1>
      ${bodyHtml}
    </div>
    <div style="max-width:520px;margin:16px auto 0;text-align:center;color:#71717a;font-size:12px">
      &copy; 2026 AI Founder University
    </div>
  </div>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:linear-gradient(180deg,#ffb020,#ff7a1a);color:#1a0d00;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px">${label}</a>`;

/** Sent by the Stripe webhook right after a successful purchase. */
export async function sendPurchaseConfirmation(email, loginUrl) {
  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      Thank you for your purchase — your account is ready. Everything you bought
      lives inside your member area: the Specialists, prompts, courses and downloads.
    </p>
    <p style="margin:0 0 24px">${button(loginUrl, 'Open your member area')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      This link signs you straight in and is valid for 30 minutes. After that,
      just enter your email at <a href="${siteUrl()}/members/login.html" style="color:#ffb020">${siteUrl().replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll email you a fresh one. No password to remember.
    </p>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: 'Your access is ready — AI Founder University',
    html: shell('You’re in. Welcome aboard.', body)
  });
}

/** Sent when a returning member requests a sign-in link. */
export async function sendMagicLink(email, loginUrl) {
  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      Here's your sign-in link. Click it to open your member area — no password needed.
    </p>
    <p style="margin:0 0 24px">${button(loginUrl, 'Sign in')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      The link is valid for 30 minutes and can be used once. If you didn't request
      it, you can safely ignore this email.
    </p>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: 'Your sign-in link — AI Founder University',
    html: shell('Sign in to your member area', body)
  });
}

/**
 * Sent by hand from the admin dashboard to someone who filled in the checkout
 * and never finished.
 *
 * No discount: the product is $1, and Stripe will not take less than $0.50, so
 * there is no room for one and pretending otherwise would be a lie in writing.
 * What it does instead is remove the friction — remind them what they were
 * buying, and hand them a link straight back to it.
 *
 * Carries an unsubscribe link because this is marketing rather than a receipt,
 * and the person never completed a purchase.
 */
export async function sendCheckoutReminder(email, { name, checkoutUrl, unsubscribeUrl, priceLabel }) {
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';
  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">
      You started setting up your order for <strong style="color:#fff">70 AI Specialists for Claude</strong>
      and didn't finish. Your details are still saved, so picking up where you left
      off takes about a minute.
    </p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      It's ${priceLabel} for the full suite &mdash; 70 pre-built specialists, the
      prompt libraries, the courses and every download, all yours for good.
    </p>
    <p style="margin:0 0 24px">${button(checkoutUrl, 'Finish your order')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 18px">
      If you changed your mind, that's genuinely fine &mdash; no hard feelings and
      we won't chase you about it.
    </p>
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you entered your email at our checkout.
      <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: 'You left something behind — AI Founder University',
    html: shell('Your order is still waiting', body)
  });
}
