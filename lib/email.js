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
