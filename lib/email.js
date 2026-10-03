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
 * Sent after a Claude Automation Engine purchase.
 *
 * Its own email rather than a branch inside the one above, because the two
 * products are delivered completely differently: the Specialists are a plugin
 * you install into the desktop app, the Engine is 59 routines you set up on
 * claude.ai. Sending an Engine buyer instructions for uploading a .zip would
 * lose them at the first step.
 *
 * The one thing that decides whether these get used is Start Here, so that is
 * the only instruction here. Everything else can wait until they are inside.
 */
export async function sendEngineWelcome(email, loginUrl, { name, existingMember } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      Your <strong style="color:#fff">Claude Automation Engine</strong> is ready — all 59 routines,
      in <strong style="color:#fff">Claude Routines</strong> in your member area${existingMember
        ? ', alongside everything you already had' : ', along with the rest of the library'}.
    </p>

    <p style="margin:0 0 26px">${button(loginUrl, 'Open your member area')}</p>

    <div style="background:#18181b;border:1px solid #26262b;border-left:3px solid #ffb020;
                border-radius:10px;padding:16px 18px;margin:0 0 24px">
      <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 6px">Read Start Here first</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0">
        It is the first item in the section and takes about two minutes. It covers what a Routine is,
        where to find them in Claude, and the two settings that catch everybody out. Every other
        page assumes you have read it.
      </p>
    </div>

    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 12px">
      Two things worth knowing before you start:
    </p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 12px">
      <strong style="color:#fff">You need Claude Pro or Max.</strong> Routines do not run on the free plan,
      and they run on Anthropic's computers rather than yours — so they work while your laptop is shut.
    </p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px">
      <strong style="color:#fff">Start with three, not fifty-nine.</strong> Start Here names the three to
      begin with. They only read your own data, they send nothing to anybody, and you will see the first
      results tomorrow morning.
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
    subject: "You're in — your 59 Claude routines are ready",
    html: shell('Your Automation Engine is ready', body)
  });
}

/**
 * Welcome for Claude Carousel Studio, bought as an add-on on the lifetime-access
 * checkout. The plugin is a download in the member area, gated on the
 * `carousel-studio` entitlement (scripts/upload-content.mjs, export/carousel-studio).
 */
export async function sendCarouselWelcome(email, loginUrl, { name } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      Your <strong style="color:#fff">Claude Carousel Studio</strong> is ready. It turns ideas, articles,
      links and rough notes into Instagram and LinkedIn carousels — hooks, slide-by-slide copy, design
      and finished image files you can post.
    </p>

    <p style="margin:0 0 26px">${button(loginUrl, 'Download Carousel Studio')}</p>

    <div style="background:#18181b;border:1px solid #26262b;border-left:3px solid #ffb020;
                border-radius:10px;padding:16px 18px;margin:0 0 24px">
      <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 6px">Install it in two minutes</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0">
        Download the ZIP from your member area, then in Claude go to <strong style="color:#fff">Settings → Plugins</strong>
        and upload it. Start with <strong style="color:#fff">"set up my brand"</strong> — every carousel after that
        uses your colours, fonts and voice.
      </p>
    </div>

    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px">
      Then try: <em style="color:#fff">"Turn this article into a LinkedIn carousel"</em> or
      <em style="color:#fff">"Plan a month of Instagram carousels for my business."</em>
    </p>

    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px">
      The button above signs you straight in and works for 30 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: "You're in — Claude Carousel Studio is ready",
    html: shell('Your Carousel Studio is ready', body)
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
  name, amount, currency, chargeId, paidAt, card, address, lines
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
      ${(Array.isArray(lines) && lines.length ? lines : [{ label: '70 AI Specialists for Claude', cents: amount }])
        .map((l) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#a1a1aa;font-size:14px">
          ${l.label}
        </td>
        <td style="padding:12px 0;border-top:1px solid #26262b;color:#a1a1aa;font-size:14px;text-align:right">
          ${money(l.cents)}
        </td>
      </tr>`).join('')}
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

/**
 * The third and last of the sequence, a day after the second.
 *
 * The first two sell. This one explains, because by now the offer is not the
 * thing in the way — not knowing what the product actually does is. It opens
 * on the problem the sales page already named, so it reads as the rest of a
 * conversation rather than a fresh pitch.
 *
 * Names real specialists doing what they really do. Deliberately says nothing
 * about how many prompts or lessons are in there: counts are what a spec sheet
 * does, and a number nobody can picture persuades nobody.
 */
export async function sendThirdReminder(email, { name, checkoutUrl, unsubscribeUrl, priceLabel }) {
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';
  const p = 'color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px';

  // One specialist per line, the name carrying the job. Reads as a cast list,
  // which is the whole idea of the product.
  const who = (n, does) =>
    `<p style="color:#a1a1aa;font-size:15px;line-height:1.55;margin:0 0 9px">
       <strong style="color:#fff">${n}</strong> ${does}</p>`;

  const plugin = (n, does) =>
    `<p style="color:#a1a1aa;font-size:15px;line-height:1.55;margin:0 0 9px">
       <strong style="color:#fff">${n}</strong> &mdash; ${does}</p>`;

  const body = `
    <p style="${p}">${hello}</p>

    <p style="${p}">Claude isn't the bottleneck. The blank window is.</p>

    <p style="${p}">
      Every session starts the same way &mdash; explaining your business again, setting the role
      again, writing the brief before you can get anywhere near the actual work. Most people never
      get past that. It's why Claude ends up tidying emails instead of running anything.
    </p>

    <p style="${p}"><strong style="color:#fff">The 70 Specialists change where you start.</strong></p>

    <p style="${p}">
      Install the plugin and Claude gains 70 named roles, each already briefed for the job.
      You don't describe the work. You pick the person.
    </p>

    <div style="margin:0 0 20px">
      ${who('Cody', 'writes your landing pages, emails and sales copy.')}
      ${who('Celia', "writes the cold outreach &mdash; and tells you why the last one didn't land.")}
      ${who('Emmi', 'builds the spreadsheet. Formulas, pivots, the lot.')}
      ${who('Nora', 'raises the invoices and chases the ones going late.')}
      ${who('Sophie', 'tells you what your competitors are doing and where the gap is.')}
    </div>

    <p style="${p}">
      Run <strong style="color:#fff">/start-70</strong> once. Five questions about your business, and
      every specialist remembers the answers from then on &mdash; no more starting from scratch.
      After that it's <strong style="color:#fff">/ai-helper</strong>: say what you need in plain
      English, it picks the right specialist and gets on with it.
    </p>

    <p style="${p}">Five more plugins come with it:</p>

    <div style="margin:0 0 20px">
      ${plugin('Email Specialist', 'welcome sequences, cart abandonment, winbacks')}
      ${plugin('Carousel Post Specialists', 'LinkedIn and Instagram carousels')}
      ${plugin('Video Shorts Specialists', 'hooks and scripts for shorts')}
      ${plugin('Image Designers', 'product and social images')}
      ${plugin('AI Automation Specialists', 'the workflows that run without you')}
    </div>

    <p style="${p}">
      All of it comes with video training, so you're not left working it out on your own.
    </p>

    <p style="${p}">Still ${priceLabel}. Yours to keep.</p>

    <p style="margin:0 0 20px">${button(checkoutUrl, `Get access for ${priceLabel}`)}</p>

    <p style="color:#fff;font-size:15px;line-height:1.6;margin:0 0 8px">
      Install it tonight, use it in the morning.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 18px">
      If it isn't for you, one email and we'll refund it. No forms, no reason needed.
    </p>

    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you entered your email at our checkout.
      <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: 'The part nobody explains about Claude',
    html: shell('Why the blank window is the problem', body)
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
 *
 * It no longer signs off as the last of the sequence: the third one does.
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

/**
 * The first abandoned-checkout reminder, with the 24-hour bonus: the Claude
 * Automation Engine and Claude Carousel Studio included free with the $1
 * Specialists. The checkout link carries a signed token (lib/bonus.js) that
 * the payment endpoint checks, so the deadline stated here is the one the
 * server enforces.
 */
export async function sendBonusReminder(email, { name, checkoutUrl, unsubscribeUrl, deadline }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : 'Hi,';
  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0b">
<tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#111113;border:1px solid #26262b;border-radius:16px">
<tr><td style="padding:34px 34px 30px">

  <div style="font-size:13px;font-weight:700;color:#ffb020;letter-spacing:.02em;margin:0 0 22px">AI Founder University</div>

  <div style="display:inline-block;background:rgba(255,122,26,.14);border:1px solid rgba(255,122,26,.45);color:#ffb020;
              font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:6px 12px;margin:0 0 16px">
    ⏰ 24-hour bonus · for you only
  </div>

  <h1 style="color:#fff;font-size:27px;line-height:1.2;font-weight:800;margin:0 0 18px">
    Your $1 order just got a <span style="color:#ffb020">free upgrade.</span>
  </h1>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 14px">${hello}</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 14px">
    You got as far as the checkout for <strong style="color:#fff">70 AI Specialists for Claude</strong> and stopped.
    No pressure — but we'd really like you to see what this does for your business. So for the
    <strong style="color:#fff">next 24 hours</strong>, we're adding our two newest tools to your order,
    <strong style="color:#fff">free</strong>. Same $1. Nothing extra to pay.
  </p>

  <!-- stack -->
  <p style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin:26px 0 10px">What you get for $1 today</p>

  <!-- item 1 -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;border:1px solid #26262b;border-radius:12px;margin:0 0 10px">
  <tr><td style="padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="color:#fff;font-size:16px;font-weight:700">🧠 70 AI Specialists for Claude</td>
      <td align="right" style="color:#fff;font-size:15px;font-weight:700;white-space:nowrap">$1.00</td>
    </tr></table>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:6px 0 0">
      A copywriter, ad buyer, SEO pro, sales closer and 66 more — each one already knows the job. Ask in one line, get finished work back.
    </p>
  </td></tr></table>

  <!-- item 2 -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#15201a;border:1px solid #1f5a3d;border-radius:12px;margin:0 0 10px">
  <tr><td style="padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="color:#fff;font-size:16px;font-weight:700">⚡ Claude Automation Engine — 59 Routines</td>
      <td align="right" style="white-space:nowrap;font-size:15px;font-weight:800">
        <span style="color:#71717a;text-decoration:line-through;font-weight:500;font-size:13px">$4.99</span>
        <span style="color:#34d399">&nbsp;FREE</span>
      </td>
    </tr></table>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:6px 0 8px">
      <strong style="color:#fff">Wake up to work that's already done.</strong> Set each routine once and Claude runs it for you every morning or week — even with your laptop shut:
    </p>
    <p style="color:#d4d4d8;font-size:14px;line-height:1.7;margin:0">
      ✓ A morning brief with yesterday's numbers and today's top 3 priorities<br>
      ✓ An ad watchdog that catches a campaign burning money within hours<br>
      ✓ Unpaid invoices and abandoned checkouts — follow-ups drafted for you<br>
      ✓ Every new lead researched before you reply<br>
      <span style="color:#a1a1aa">+ 55 more across finance, content, sales, support and admin</span>
    </p>
  </td></tr></table>

  <!-- item 3 -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#15201a;border:1px solid #1f5a3d;border-radius:12px;margin:0 0 10px">
  <tr><td style="padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="color:#fff;font-size:16px;font-weight:700">🎨 Claude Carousel Studio</td>
      <td align="right" style="white-space:nowrap;font-size:15px;font-weight:800">
        <span style="color:#71717a;text-decoration:line-through;font-weight:500;font-size:13px">$4.99</span>
        <span style="color:#34d399">&nbsp;FREE</span>
      </td>
    </tr></table>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:6px 0 8px">
      <strong style="color:#fff">Scroll-stopping Instagram &amp; LinkedIn carousels in minutes.</strong> Turn any idea, article, link or rough notes into finished slides:
    </p>
    <p style="color:#d4d4d8;font-size:14px;line-height:1.7;margin:0">
      ✓ Hooks that stop the scroll + slide-by-slide copy<br>
      ✓ Your colours, fonts and voice on every post<br>
      ✓ Ready-to-post image files — or a whole month planned at once
    </p>
  </td></tr></table>

  <!-- total -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 6px;border-top:1px dashed #333338">
  <tr>
    <td style="padding:14px 0 4px;color:#a1a1aa;font-size:14px">Normal price for all three</td>
    <td align="right" style="padding:14px 0 4px;color:#71717a;font-size:14px;text-decoration:line-through">$10.98</td>
  </tr>
  <tr>
    <td style="padding:4px 0;color:#fff;font-size:17px;font-weight:800">Your price for the next 24 hours</td>
    <td align="right" style="padding:4px 0;color:#ffb020;font-size:24px;font-weight:800">$1</td>
  </tr>
  </table>

  <!-- why -->
  <p style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin:26px 0 10px">Why this is a no-brainer</p>
  <p style="color:#d4d4d8;font-size:14px;line-height:1.75;margin:0 0 6px">
    <strong style="color:#fff">The Specialists do the work you ask for.</strong> Ads, emails, offers, SEO, sales scripts — done in minutes, not days.<br>
    <strong style="color:#fff">The Routines do the work you forget.</strong> Reports, follow-ups and checks run on their own, on schedule.<br>
    <strong style="color:#fff">Carousel Studio gets you seen.</strong> Consistent, on-brand posts without a designer.
  </p>
  <p style="color:#a1a1aa;font-size:14px;line-height:1.65;margin:12px 0 0">
    Together that's a marketing team, an operations assistant and a content designer inside the Claude you already use — for the price of a chewing gum.
  </p>

  <!-- CTA -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 10px"><tr><td
    style="background:linear-gradient(90deg,#ff7a1a,#ffb020);background-color:#ff7a1a;border-radius:12px">
    <a href="${checkoutUrl}" style="display:inline-block;padding:16px 30px;color:#111;font-size:16px;font-weight:800;text-decoration:none">
      Claim my $1 bundle →
    </a>
  </td></tr></table>
  <p style="color:#ffb020;font-size:13px;font-weight:600;margin:0 0 22px">
    ⏰ Bonus ends ${deadline} — after that it's $1 for the Specialists only.
  </p>

  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 18px">
    🛡️ <strong style="color:#fff">Zero risk:</strong> try all three for 14 days. If they don't save you time, reply to this email and we'll refund your $1.
  </p>

  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 20px">
    Talk soon,<br><span style="color:#fff">The AI Founder University team</span>
  </p>

  <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
    <strong style="color:#a1a1aa">P.S.</strong> Your details are still saved — it takes about a minute to finish.
    The two extras are added to your order automatically when you use the button above.
  </p>

</td></tr></table>

<p style="color:#52525b;font-size:11px;line-height:1.6;margin:18px 0 0;max-width:600px">
  You're getting this because you started an order at aifounderuniversity.com.
  <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
</p>
</td></tr></table>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: 'Your $1 order just got a free upgrade (24 hours)',
    html
  });
}

/**
 * The last-hour reminder for the 24-hour bonus: sent 23 hours after the bonus
 * email, to people who still have not bought. Same signed checkout link, so
 * the bonus still applies until the deadline it states.
 */
export async function sendBonusLastHour(email, { name, checkoutUrl, unsubscribeUrl, deadline }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first},` : 'Hi,';
  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0b">
<tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#111113;border:1px solid #26262b;border-radius:16px">
<tr><td style="padding:34px 34px 30px">

  <div style="font-size:13px;font-weight:700;color:#ffb020;letter-spacing:.02em;margin:0 0 22px">AI Founder University</div>

  <!-- countdown block -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#3a1206,#1f0c05);background-color:#2a0f06;border:1px solid #7a2d10;border-radius:14px;margin:0 0 24px">
  <tr><td align="center" style="padding:20px 16px">
    <div style="color:#ff9a5c;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px">Your bonus ends in</div>
    <div style="color:#fff;font-size:44px;line-height:1;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums">1 hour</div>
    <div style="color:#fca97a;font-size:13px;margin:10px 0 0">at ${deadline}</div>
  </td></tr></table>

  <h1 style="color:#fff;font-size:26px;line-height:1.2;font-weight:800;margin:0 0 18px">
    Last call: your <span style="color:#ffb020">free upgrades</span> are about to disappear.
  </h1>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 14px">${hello}</p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 14px">
    Quick one — yesterday we added two tools to your order for free. That bonus closes in
    <strong style="color:#fff">one hour</strong>, and after that we won't be offering it again.
  </p>
  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 22px">
    Here's what's still sitting in your cart right now:
  </p>

  <!-- compact stack -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;border:1px solid #26262b;border-radius:12px;margin:0 0 8px">
  <tr><td style="padding:16px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:6px 0;color:#fff;font-size:15px;font-weight:700">🧠 70 AI Specialists for Claude</td>
        <td align="right" style="padding:6px 0;color:#fff;font-size:15px;font-weight:700;white-space:nowrap">$1.00</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#fff;font-size:15px;font-weight:700;border-top:1px solid #26262b">⚡ Claude Automation Engine — 59 Routines</td>
        <td align="right" style="padding:6px 0;white-space:nowrap;border-top:1px solid #26262b">
          <span style="color:#71717a;text-decoration:line-through;font-size:13px">$4.99</span>
          <span style="color:#34d399;font-weight:800;font-size:15px">&nbsp;FREE</span>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#fff;font-size:15px;font-weight:700;border-top:1px solid #26262b">🎨 Claude Carousel Studio</td>
        <td align="right" style="padding:6px 0;white-space:nowrap;border-top:1px solid #26262b">
          <span style="color:#71717a;text-decoration:line-through;font-size:13px">$4.99</span>
          <span style="color:#34d399;font-weight:800;font-size:15px">&nbsp;FREE</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;color:#fff;font-size:16px;font-weight:800;border-top:1px dashed #333338">Total for the next hour</td>
        <td align="right" style="padding:12px 0 0;color:#ffb020;font-size:24px;font-weight:800;border-top:1px dashed #333338">$1</td>
      </tr>
    </table>
  </td></tr></table>
  <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 24px">
    After ${deadline}, the $1 gets you the Specialists only — the two extras go back to $4.99 each.
  </p>

  <!-- what you'd miss -->
  <p style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px">What you'd be walking away from</p>
  <p style="color:#d4d4d8;font-size:14px;line-height:1.8;margin:0 0 6px">
    ✓ <strong style="color:#fff">A morning brief</strong> with yesterday's numbers and today's top 3 priorities — every day, automatically<br>
    ✓ <strong style="color:#fff">An ad watchdog</strong> that spots a campaign burning money within hours<br>
    ✓ <strong style="color:#fff">Follow-ups drafted for you</strong> for unpaid invoices and abandoned checkouts<br>
    ✓ <strong style="color:#fff">A month of Instagram &amp; LinkedIn carousels</strong>, on-brand, in one sitting<br>
    ✓ <strong style="color:#fff">70 specialists</strong> writing your ads, emails, offers and sales scripts on demand
  </p>

  <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:20px 0 0">
    That's a whole back office, a content designer and a marketing team — inside the Claude you already use —
    for <strong style="color:#fff">less than a coffee</strong>. It takes about a minute to finish, and your details are still saved.
  </p>

  <!-- CTA -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 10px"><tr><td
    style="background:linear-gradient(90deg,#ff7a1a,#ffb020);background-color:#ff7a1a;border-radius:12px">
    <a href="${checkoutUrl}" style="display:inline-block;padding:17px 32px;color:#111;font-size:17px;font-weight:800;text-decoration:none">
      Grab all 3 for $1 before it ends →
    </a>
  </td></tr></table>
  <p style="color:#ff9a5c;font-size:13px;font-weight:600;margin:0 0 22px">
    ⏰ Bonus closes ${deadline}. This is the last reminder about it.
  </p>

  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 18px">
    🛡️ <strong style="color:#fff">Still covered:</strong> 14-day money-back guarantee on everything. If it doesn't save you time, reply and we'll refund you.
  </p>

  <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0">
    Talk soon,<br><span style="color:#fff">The AI Founder University team</span>
  </p>

</td></tr></table>

<p style="color:#52525b;font-size:11px;line-height:1.6;margin:18px 0 0;max-width:600px">
  You're getting this because you started an order at aifounderuniversity.com.
  <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
</p>
</td></tr></table>`;
  return resend().emails.send({
    from: from(), to: email,
    subject: '[-1H] Your free upgrades are about to disappear',
    html
  });
}

/**
 * Someone replied in the community.
 *
 * `items` is everything waiting for this member, so a thread that collected
 * four replies between runs produces one email naming the thread once.
 */
export async function sendReplyNotification(email, { name, items }) {
  const site = siteUrl();
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';

  // Grouped by thread, newest last, so the email reads in the order the
  // conversation happened. A group is a question or a set of replies — never
  // both, because a question is the first thing that happens to a thread.
  const threads = [];
  const seen = {};
  for (const it of items) {
    const key = String(it.threadId ?? 'x');
    if (!seen[key]) {
      seen[key] = { title: it.title, who: [], id: it.threadId, asked: it.kind === 'question' };
      threads.push(seen[key]);
    }
    if (it.kind === 'question') seen[key].asked = true;
    if (seen[key].who.indexOf(it.actor) < 0) seen[key].who.push(it.actor);
  }

  const list = threads.map((t) => {
    const who = t.who.length === 1 ? t.who[0]
      : t.who.length === 2 ? `${t.who[0]} and ${t.who[1]}`
      : `${t.who[0]} and ${t.who.length - 1} others`;
    const href = `${site}/members/#t-${t.id}`;
    return `
      <tr><td style="padding:0 0 14px">
        <a href="${href}" style="color:#ffb020;text-decoration:none;font-weight:600;font-size:15px">
          ${esc(t.title || 'your post')}</a>
        <div style="color:#a1a1aa;font-size:13px;margin-top:3px">${esc(who)} ${t.asked ? 'asked this' : 'replied'}</div>
      </td></tr>`;
  }).join('');

  const one = threads.length === 1;
  const allAsked = threads.every((t) => t.asked);
  const lead = one
    ? (threads[0].asked ? 'a member asked a question in the community.' : 'someone replied to you in the community.')
    : (allAsked ? 'there are new questions waiting in the community.'
                : 'there is new activity waiting for you in the community.');

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">${hello} ${lead}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px">${list}</table>
    <p style="margin:0 0 24px">${button(`${site}/members/#t-${threads[0].id}`,
      one ? (threads[0].asked ? 'Answer it' : 'Read the reply') : 'Open the community')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      You are getting this because you take part in the AI Founder University community.
      You can turn these off in
      <a href="${site}/members/account.html" style="color:#a1a1aa">your account settings</a>.
    </p>`;

  const subject = one
    ? (threads[0].asked
        ? `${threads[0].who[0]} asked: ${threads[0].title || 'a question'}`
        : `${threads[0].who[0]} replied to ${threads[0].title ? `"${threads[0].title}"` : 'your post'}`)
    : (allAsked ? `${threads.length} new questions in the community`
                : `${threads.length} new replies in the community`);

  return resend().emails.send({
    from: from(), to: email,
    subject,
    html: shell(one && threads[0].asked ? 'A new question' : one ? 'You have a reply' : 'New in the community', body)
  });
}

/** Minimal escaping for the one place in this file that interpolates names. */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * The week in the community.
 *
 * `week` is what weekInCommunity returned. The caller decides whether there is
 * enough to be worth sending; this just writes it.
 */
export async function sendCommunityDigest(email, { name, week }) {
  const site = siteUrl();
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';

  const SPACE_LABEL = {
    announcements: 'Announcements', intros: 'Introductions', help: 'Ask for help', wins: 'Wins'
  };

  const rows = week.threads.map((t) => {
    const bits = [];
    if (t.replies) bits.push(`${t.replies} ${t.replies === 1 ? 'reply' : 'replies'}`);
    if (t.likes) bits.push(`${t.likes} ${t.likes === 1 ? 'like' : 'likes'}`);
    const meta = [SPACE_LABEL[t.space] || t.space, ...bits].join(' \u00b7 ');
    return `
      <tr><td style="padding:0 0 16px">
        <a href="${site}/members/#t-${t.id}" style="color:#ffb020;text-decoration:none;font-weight:600;font-size:15px">
          ${esc(t.title || 'A post')}</a>
        <div style="color:#71717a;font-size:12px;margin-top:3px">${esc(meta)}</div>
      </td></tr>`;
  }).join('');

  const n = week.totals;
  const summary = [
    n.threads ? `${n.threads} new ${n.threads === 1 ? 'post' : 'posts'}` : '',
    n.replies ? `${n.replies} ${n.replies === 1 ? 'reply' : 'replies'}` : ''
  ].filter(Boolean).join(' and ');

  // An open question is an invitation to answer one, which is the single most
  // useful thing a member can do for the place.
  const nudge = week.unanswered
    ? `<p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px">
         ${week.unanswered === 1
           ? 'There is <strong style="color:#fff">one question</strong> nobody has answered yet.'
           : `There are <strong style="color:#fff">${week.unanswered} questions</strong> nobody has answered yet.`}
         If you know the answer to one, you will make somebody's week.</p>`
    : '';

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      ${hello} here is what happened in the community this week \u2014 ${esc(summary)}.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">${rows}</table>
    ${nudge}
    <p style="margin:0 0 24px">${button(`${site}/members/#c-all`, 'Open the community')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      You are getting this because you are an AI Founder University member.
      You can turn these off in
      <a href="${site}/members/account.html" style="color:#a1a1aa">your account settings</a>.
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: `This week in the community \u2014 ${summary}`,
    html: shell('This week in the community', body)
  });
}

/**
 * Their roadmap has been written and signed off.
 *
 * Short on purpose. The roadmap is the thing; this is the knock on the door,
 * and a summary here would only compete with it.
 */
export async function sendRoadmapReady(email, { name, headline } = {}) {
  const site = siteUrl();
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      ${hello} your Personalised AI Roadmap is ready. It was built from the answers you
      gave us, and it names the exact courses, prompts and tools in your membership to
      use at each step.
    </p>
    ${headline ? `<p style="color:#fff;font-size:17px;font-weight:600;line-height:1.45;margin:0 0 22px;
      padding:16px 18px;background:#161619;border:1px solid #26262b;border-radius:12px">
      ${esc(headline)}</p>` : ''}
    <p style="margin:0 0 24px">${button(`${site}/members/#roadmap`, 'Open your roadmap')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      It is laid out in three windows — the next 7 days, then 30, then 90. Start at the top.
      If something in it does not fit, say so in the community and we will adjust it.
    </p>`;

  return resend().emails.send({
    from: from(), to: email,
    subject: 'Your Personalised AI Roadmap is ready',
    html: shell('Your roadmap is ready', body)
  });
}
