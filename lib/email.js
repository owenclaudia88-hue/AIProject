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

/**
 * Sent right after a successful purchase — by the Stripe webhook, or by the
 * admin dashboard when access is granted by hand.
 *
 * This is the only email most buyers will read, so it carries the one detail
 * that actually stops people using the product: the specialists run in the
 * Claude *desktop* app, inside Cowork, not in the browser. Someone who misses
 * that installs nothing, assumes it is broken, and asks for a refund.
 */
export async function sendPurchaseConfirmation(email, loginUrl, { name } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';

  const step = (n, html) => `
    <tr>
      <td style="width:26px;vertical-align:top;padding:0 10px 12px 0">
        <div style="width:22px;height:22px;border-radius:999px;background:#26262b;color:#ffb020;
                    font-size:12px;font-weight:700;text-align:center;line-height:22px">${n}</div>
      </td>
      <td style="vertical-align:top;padding:0 0 12px;color:#a1a1aa;font-size:15px;line-height:1.55">${html}</td>
    </tr>`;

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      Your <strong style="color:#fff">70 AI Specialists for Claude</strong> are ready, along with the
      prompt libraries, courses and every download. All of it is yours to keep.
    </p>

    <p style="margin:0 0 26px">${button(loginUrl, 'Open your member area')}</p>

    <div style="background:#18181b;border:1px solid #26262b;border-left:3px solid #ffb020;
                border-radius:10px;padding:16px 18px;margin:0 0 24px">
      <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 6px">One thing that trips people up</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0">
        The specialists run in the <strong style="color:#fff">Claude desktop app, inside Cowork</strong> —
        not the browser version. Install takes about 90 seconds.
      </p>
    </div>

    <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 12px">Getting set up</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px">
      ${step(1, `Download the plugin <strong style="color:#fff">.zip</strong> from
                 <a href="${site}/members/#downloads" style="color:#ffb020">Downloads</a> in your member area.`)}
      ${step(2, `Open the <strong style="color:#fff">Claude desktop app</strong> and go to <strong style="color:#fff">Cowork</strong>.`)}
      ${step(3, `<strong style="color:#fff">Customize → Add plugin → Upload file</strong>, and pick the .zip you just downloaded.`)}
      ${step(4, `Open a Cowork tab and type <strong style="color:#fff">/start-70</strong>. Tell it what your
                 business does in one line and it sets you up with a quick win and a 14-day plan.`)}
    </table>

    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px">
      After that, <strong style="color:#fff">/ai-helper</strong> is the one to remember — describe any task in
      plain words and it picks the right specialist for you. The full walkthrough is in
      <a href="${site}/members/#course-70-ai-specialists-for-claude-course" style="color:#ffb020">Install In 90 Seconds</a>,
      the third lesson of the course.
    </p>

    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px">
      The button above signs you straight in and works for 30 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: "You're in — here's how to install your 70 Specialists",
    html: shell('Your access is ready', body)
  });
}

/**
 * The purchase receipt, sent by us rather than by Stripe.
 *
 * Stripe's own receipt emails are switched off for this account, so this is the
 * only record of the payment the buyer ever gets — it has to stand on its own
 * as proof of purchase, and it is what they will forward to their accountant
 * or wave at their bank. Hence the deliberately plain layout: this one is a
 * document, not a pitch.
 *
 * Covers the one-off purchase only. The monthly membership charges get their
 * own receipt.
 */
export async function sendReceipt(email, {
  name, amount, currency, chargeId, paidAt, card, address
} = {}) {
  const site = siteUrl();
  const cur = String(currency || 'usd').toUpperCase();
  const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur })
    .format((Number(cents) || 0) / 100);
  // UTC, and said so. The buyer's timezone is not knowable from here, and a
  // receipt whose timestamp is ambiguous is worse than one that is merely not
  // local.
  const paidOn = new Date(paidAt || Date.now()).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC'
  }) + ' UTC';

  // A short, human receipt number in Stripe's own #1234-5678 shape, derived
  // from the charge id so it never changes — the same payment quoted twice
  // must give the same number, or it is no use to anyone reconciling it.
  const digits = String(chargeId || '').split('')
    .reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const number = `${String(digits % 10000).padStart(4, '0')}-${String((digits >>> 13) % 10000).padStart(4, '0')}`;

  const paidWith = card?.brand
    ? `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)} &ndash; ${card.last4}`
    : 'Card';

  // Only the parts of the address they actually gave us, so a sparse address
  // doesn't render as a column of stray commas.
  const addrLines = [address?.line1, address?.line2,
    [address?.city, address?.postal_code].filter(Boolean).join(' '),
    address?.country].filter(Boolean);

  const cell = (label, value) => `
    <td style="vertical-align:top;padding:0 14px 0 0">
      <div style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.08em;
                  text-transform:uppercase;margin:0 0 5px">${label}</div>
      <div style="color:#fff;font-size:14px;font-weight:600">${value}</div>
    </td>`;

  const body = `
    <p style="color:#71717a;font-size:13px;margin:0 0 24px">Receipt #${number}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 26px">
      <tr>
        ${cell('Amount paid', money(amount))}
        ${cell('Date paid', paidOn)}
        ${cell('Payment method', paidWith)}
      </tr>
    </table>

    <div style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.08em;
                text-transform:uppercase;margin:0 0 10px">Summary</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border-collapse:collapse;margin:0 0 26px">
      <tr>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#a1a1aa;font-size:14px">
          70 AI Specialists for Claude
        </td>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#a1a1aa;font-size:14px;text-align:right">
          ${money(amount)}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#fff;font-size:14px;font-weight:700">
          Amount paid
        </td>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#fff;font-size:14px;font-weight:700;text-align:right">
          ${money(amount)}
        </td>
      </tr>
    </table>

    <div style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.08em;
                text-transform:uppercase;margin:0 0 8px">Billed to</div>
    <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0 0 26px">
      ${[name, email].filter(Boolean).join('<br>')}${addrLines.length ? '<br>' + addrLines.join('<br>') : ''}
    </p>

    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px;border-top:1px solid #26262b;padding-top:20px">
      Your access and the install steps are in a separate email. You can sign in any time at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Questions about this payment? Reply to this email and we'll sort it out.
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: `Your AI Founder University receipt [#${number}]`,
    html: shell('Receipt from AI Founder University', body)
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

/**
 * The second nudge, a day after the first. No new offer — the launch price is
 * the offer — so this one earns its place by explaining what the thing
 * actually is, which the first email deliberately does not.
 */
export async function sendSecondReminder(email, { name, checkoutUrl, unsubscribeUrl, priceLabel, regularPriceLabel }) {
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';
  const rising = regularPriceLabel
    ? `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
         It's still <strong style="color:#fff">${priceLabel}</strong> at the launch price.
         That goes up to ${regularPriceLabel} once the launch ends &mdash; one payment either
         way, no subscription.
       </p>`
    : `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
         It's still <strong style="color:#fff">${priceLabel}</strong> &mdash; one payment, no subscription.
       </p>`;

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">
      Most people who move to Claude end up staring at an empty chat box. The model
      is capable, but a blank page still asks you to know exactly what to say.
    </p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">
      <strong style="color:#fff">70 AI Specialists for Claude</strong> removes that step.
      Each one is already set up for a particular job &mdash; writing your emails,
      planning content, handling spreadsheets, researching, building automations &mdash;
      so you pick the one you need and start, rather than working out how to ask.
    </p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">
      It comes with the prompt libraries, the courses that show you how each piece
      works, and every download. Yours for good, and yours to keep using long after
      you've forgotten where you got it.
    </p>
    ${rising}
    <p style="margin:0 0 24px">${button(checkoutUrl, 'Get it at the launch price')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 18px">
      This is the last we'll write to you about it.
    </p>
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you entered your email at our checkout.
      <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: 'What the 70 Specialists actually do — AI Founder University',
    html: shell('Still worth a look', body)
  });
}
