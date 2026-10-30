import { Resend } from 'resend';
import { adminEmails } from './admin.js';
import { unsubscribeUrl } from './outreach.js';
import { deliveryFor, getSettings } from './db.js';
import { LAUNCH } from './funnel-engine-launch.js';
import { dealPrice, DEAL_PERCENT, DEAL_HOURS, dealEndsLabel } from './roadmap-deal.js';

/**
 * Transactional email via Resend: the purchase confirmation (with the login
 * link) and the magic sign-in link.
 */

/**
 * Addresses we never write to again, for any reason — not a sign-in link, not
 * a receipt. Kept apart from the unsubscribe list, which only stops marketing:
 * a member who unsubscribes still needs their sign-in links. This one is set by
 * hand, in the `email_never` setting, one address per line or comma.
 *
 * A lookup that fails lets the send through. Blocking every email on the site
 * because the database had a slow second is worse than the rare email that
 * should not have gone.
 */
async function withoutNever(to) {
  const list = Array.isArray(to) ? to : [to];
  try {
    const raw = (await getSettings()).email_never || '';
    const never = new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean));
    if (!never.size) return list;
    return list.filter((e) => !never.has(String(e).trim().toLowerCase()));
  } catch (err) {
    console.error('[email] could not read the never-email list -', err.message);
    return list;
  }
}

/** Every send goes through here, so the never-email list cannot be missed. */
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const client = new Resend(key);
  return {
    emails: {
      async send(payload) {
        const to = await withoutNever(payload.to);
        if (!to.length) {
          console.log('[email] not sent: the address is on the never-email list');
          return { data: null, error: null, skipped: 'never-email' };
        }
        return client.emails.send({ ...payload, to: Array.isArray(payload.to) ? to : to[0] });
      }
    }
  };
}

/**
 * Send to a member, at every address that reaches them.
 *
 * Some company mail servers refuse everything we send. Support adds a second
 * address to that member, and from then on their mail goes to both — the one
 * on the order and the one they can actually read — because an address added
 * for exactly this reason is no use if the next email still goes only to the
 * inbox that bounces.
 *
 * Used for a member's own mail: the welcome, the receipt, the sign-in link,
 * the Monday report. Not for the pre-purchase reminders, which are written to
 * leads who have no account to carry a second address, and not for the admin
 * notices, which go to staff.
 *
 * The lookup is never allowed to stop an email going out. If it fails, the
 * original address is used and the send proceeds: one address is worse than
 * two, and far better than none.
 */
async function deliver(payload) {
  let to = payload.to;
  try {
    const all = await deliveryFor(payload.to);
    if (all.length > 1) to = all;
  } catch (err) {
    console.error('[email] could not look up alternate addresses for', payload.to, '-', err.message);
  }
  return resend().emails.send({ ...payload, to });
}

function from() {
  return process.env.EMAIL_FROM || 'AI Founder University <hello@aifounderuniversity.com>';
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
}

/**
 * The frame every email sits in.
 *
 * `bare` drops the small brand line and the heading, for a message that brings
 * its own masthead. The weekly report does: with a heading here, a banner, a
 * card and a line in the body, its title was being said four times before the
 * reader reached a word of the news.
 */
/* The side padding is what keeps the card off the edge of a phone screen. With
   none, the 520px card is simply the width of the screen, its border and its
   rounded corners cut off against both edges and the text starting a thumb's
   width from nothing. The two emails that build their own frame already do
   this; this is the same 14px. */
const shell = (heading, bodyHtml, opts = {}) => `
  <div style="background:#0a0a0b;padding:32px 14px;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#111113;border:1px solid #26262b;border-radius:16px;padding:32px">
      ${opts.bare ? '' : `<div style="font-weight:800;color:#ffb020;font-size:15px;letter-spacing:.02em;margin-bottom:20px">AI Founder University</div>`}
      ${opts.bare || !heading ? '' : `<h1 style="color:#fff;font-size:22px;font-weight:600;margin:0 0 16px">${heading}</h1>`}
      ${bodyHtml}
    </div>
    <div style="max-width:520px;margin:16px auto 0;text-align:center;color:#71717a;font-size:12px">
      &copy; 2026 AI Founder University
    </div>
  </div>`;

/* The solid colour is not decoration. Outlook and Hotmail drop the gradient,
   and without a colour under it the button is near-black text on the
   near-black card: a buyer on Hotmail wrote in that his sign-in link "doesn't
   work", and in his copy of the email the button could barely be seen. */
const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:linear-gradient(180deg,#ffb020,#ff7a1a);background-color:#ff8c1a;color:#1a0d00;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px">${label}</a>`;

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
      prompt libraries, courses and downloads available in your member area.
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
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  return deliver({
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
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  const subject = "You're in — your 59 Claude routines are ready";
  const html = shell('Your Automation Engine is ready', body);
  const out = await deliver({ from: from(), to: email, subject, html });
  return { ...out, sent: { subject, html } };
}

/**
 * Welcome for The Funnel Engine, sent by the webhook the moment it is paid for.
 *
 * Its own email because it is its own purchase: no membership, no trial and,
 * for most buyers, no Specialists - so nothing from the $1 welcome applies.
 * `bumps` is the list of order bumps bought with it (FUNNEL_ENGINE_BUMPS keys),
 * each named here so nobody goes looking for something they did not get, or
 * misses something they did.
 */
export async function sendFunnelEngineWelcome(email, loginUrl, { name, existingMember, bumps = [] } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';
  const p = (html, gap = 16) =>
    `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 ${gap}px">${html}</p>`;

  const BUMP_LINES = {
    edward: `${w('Edward, your AI media buyer')} &mdash; the Evergreen Ads 3.0 workshop, Edward himself and
      the ad templates. Start with "Start Here" in the course.`,
    operators: `${w('All 16 DFY AI Operators')} &mdash; one skill with all sixteen inside. Install it,
      then type <em>start micro offer</em> in Claude.`
  };
  const extras = bumps.filter((k) => BUMP_LINES[k]);

  const body = `
    ${p(hello)}
    ${p(`Your ${w('Funnel Engine')} is ready in your member area${existingMember
      ? ', alongside everything you already had' : ''}: the engine, the Quick Start and /Integrate
      skills, the full workshop recording and your three bonuses.`, 20)}

    <p style="margin:0 0 26px">${button(loginUrl, 'Open my Funnel Engine')}</p>

    ${extras.length ? `
    <div style="background:#18181b;border:1px solid #26262b;border-radius:10px;padding:16px 18px;margin:0 0 24px">
      <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 10px">Also in your order</p>
      ${extras.map((k) => `<p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0 0 8px">${BUMP_LINES[k]}</p>`).join('')}
    </div>` : ''}

    <div style="background:#18181b;border:1px solid #26262b;border-left:3px solid #ffb020;
                border-radius:10px;padding:16px 18px;margin:0 0 24px">
      <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 6px">Watch "Start Here" first</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0">
        It is the first lesson in the course. Then download the files, open Claude and say
        ${w('"Install my Funnel Engine"')}. The first install takes about an hour, most of it telling
        Claude about your offer. Every offer after that takes about 30 minutes.
      </p>
    </div>

    ${p(`${w('What you need:')} a paid Claude plan, Chrome on a computer, a Stripe account, a domain,
      a hosting account (about $5 a month) and the email tool you already use. New to Stripe? Open the
      account today: approval can take a few days.`, 24)}

    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px">
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      You're covered by our 72-hour money-back guarantee. Stuck on anything? Reply to this email and we'll help.
    </p>`;

  const subject = "You're in — your Funnel Engine is ready";
  const html = shell('Your Funnel Engine is ready', body);
  const out = await deliver({ from: from(), to: email, subject, html });
  return { ...out, sent: { subject, html } };
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
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//,'')}/members/login.html</a>
      and we'll send a fresh link.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: "You're in — Claude Carousel Studio is ready",
    html: shell('Your Carousel Studio is ready', body)
  });
}

/* ------------------------------------------------------------------ *
 * The one welcome.
 *
 * Somebody buying the $1 Specialists with both add-ons used to receive three
 * welcomes within the same second, each with its own sign-in link, each opening
 * "You're in". The links being single-use forced separate LINKS, never separate
 * emails: one email carrying one link covers everything.
 *
 * Built from blocks rather than as a template per combination, because there
 * are sixteen reachable combinations and there will be more. A product section
 * appears only if it was bought. The membership section appears only for
 * somebody who CHOSE a membership on the offer after checkout - the year, or
 * the trial taken deliberately. Everybody is enrolled in a trial whether they
 * asked or not, so saying so to the people who declined would be telling them
 * about something they turned down.
 * ------------------------------------------------------------------ */

const eyebrow = (n, text) => `
  <p style="color:#ffb020;font-size:12px;font-weight:800;letter-spacing:.08em;
            text-transform:uppercase;margin:0 0 9px">${n} &middot; ${text}</p>`;

const callout = (html) => `
  <div style="background:#18181b;border:1px solid #26262b;border-left:3px solid #ffb020;
              border-radius:10px;padding:14px 16px;margin:0 0 12px">
    <p style="color:#a1a1aa;font-size:14px;line-height:1.55;margin:0">${html}</p>
  </div>`;

const para = (html, gap = 24) => `
  <p style="color:#a1a1aa;font-size:14.5px;line-height:1.6;margin:0 0 ${gap}px">${html}</p>`;

const rule = `<div style="height:1px;background:#26262b;margin:0 0 18px"></div>`;
const w = (t) => `<strong style="color:#fff">${t}</strong>`;

/** "A, B and C" — for the opening line, which names what they actually bought. */
function listOf(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const DAY = { day: 'numeric', month: 'long' };
const stampDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', DAY) : null;

/**
 * @param {object} bought   { engine, carousel, course } — Specialists are assumed
 * @param {string|null} membership  'year' | 'trial' | null
 * @param {Date|number|null} until  trial end, or the date the year runs to
 */
export async function sendWelcome(email, loginUrl, {
  name, bought = {}, membership = null, until = null, price = null
} = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';

  // Joined the membership from the homepage: no Specialists, no add-ons.
  if (bought.member) return sendMemberWelcome(email, loginUrl, { hello, site, membership, until, price });

  const names = ['your ' + w('70 AI Specialists')];
  if (bought.engine) names.push('the ' + w('Claude Automation Engine'));
  if (bought.carousel) names.push(w('Carousel Studio'));
  if (bought.adstudio) names.push(w('Ad Creative Studio'));
  if (bought.course) names.push(w('Claude Business Builder'));

  const opening = membership === 'year'
    ? `${listOf(names)} — plus a full year of the membership.`
    : `${listOf(names)}, along with the prompt libraries, courses and downloads in your member area.`;

  let n = 0;
  const sections = [];

  n += 1;
  sections.push(
    eyebrow(n, 'Your 70 AI Specialists') +
    callout(`They run in the ${w('Claude desktop app, inside Cowork')} — not the browser version. This is the one thing that catches people out.`) +
    para(`Download the plugin ${w('.zip')} from <a href="${site}/members/#downloads" style="color:#ffb020">Downloads</a>, then in the desktop app go to ${w('Cowork → Customize → Add plugin → Upload file')}. Open a Cowork tab, type ${w('/start-70')}, and tell it what your business does in one line.`)
  );

  if (bought.engine) {
    n += 1;
    sections.push(
      eyebrow(n, 'Claude Automation Engine') +
      callout(`Read ${w('Start Here')} first — two minutes, and every other page assumes you have.`) +
      para(`All 59 routines are in ${w('Claude Routines')} in your member area. They need Claude Pro or Max, and they run on Anthropic's computers rather than yours — so they keep working while your laptop is shut.`)
    );
  }

  if (bought.carousel) {
    n += 1;
    sections.push(
      eyebrow(n, 'Carousel Studio') +
      callout(`Download the ZIP, then in Claude go to ${w('Settings → Plugins')} and upload it.`) +
      para(`Start with ${w('"set up my brand"')} — every carousel after that uses your colours, fonts and voice.`)
    );
  }

  if (bought.adstudio) {
    n += 1;
    sections.push(
      eyebrow(n, 'Ad Creative Studio') +
      callout(`Download the ZIP, then in Claude go to ${w('Settings → Plugins')} and upload it. Then type ${w('"set up ad studio"')}.`) +
      /* The one line it is worth being specific in. "Makes ads" tells a buyer
         nothing; what arrives per ad, and that the setup is ten minutes and
         happens once, is the difference between opening it tonight and leaving
         it in the downloads folder. The command is the 1.2 one — the older
         "set up my ad profile" still works but is the long way round now. */
      para(`It walks you through six short steps — about ten minutes, once — then makes your first five ads. Every ad comes with the image in feed and story sizes, the full text, a headline and the hook it is testing. There is a ${w('14-lesson course')} under ${w('Courses')} if you would rather read first.`)
    );
  }

  if (bought.course) {
    n += 1;
    sections.push(
      eyebrow(n, 'Claude Business Builder') +
      para(`All 16 lessons are under ${w('Courses')} in your member area, about five hours end to end. It is yours for good — start with lesson one and build as you watch.`)
    );
  }

  // Only for somebody who chose a membership. Everybody else has a trial they
  // did not ask for, and telling them about it here would be answering a
  // question they did not ask.
  let membershipBlock = '';
  if (membership === 'year') {
    membershipBlock = rule +
      `<p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 7px">Your membership</p>` +
      para(`Paid in full${until ? ` until ${w(stampDate(until))}` : ' for the next twelve months'}. Nothing to cancel and nothing else to pay this year.`, 22);
  } else if (membership === 'trial') {
    membershipBlock = rule +
      `<p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 7px">Your membership trial</p>` +
      para(`Everything in the library is open to you free${until ? ` until ${w(stampDate(until))}` : ' for the next three days'}. After that it is $39 a month unless you cancel, which takes one click in your account.`, 22);
  }

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">${opening}</p>

    <p style="margin:0 0 28px">${button(loginUrl, 'Open your member area')}</p>
    ${sections.length > 1 ? rule : ''}
    ${sections.join('\n')}
    ${membershipBlock}
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px">
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//, '')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  // One list run through listOf once. Building it as "Specialists and <list>"
  // produced "the Engine and Carousel Studio and a year of membership".
  const items = ['your Specialists'];
  if (bought.engine) items.push('the Engine');
  if (bought.carousel) items.push('Carousel Studio');
  if (bought.adstudio) items.push('Ad Creative Studio');
  if (bought.course) items.push('the course');
  const subject = membership === 'year'
    ? `You're in — ${listOf([...items, 'a year of membership'])}`
    : items.length > 1
      ? `You're in — ${listOf(items)}`
      : "You're in — here's how to install your 70 Specialists";

  // Resend reports a refusal by returning one, not by throwing. Left unchecked,
  // a send that never happened looks exactly like a send that did — and for a
  // queued welcome that is the difference between the sweep retrying it and the
  // buyer never hearing from us at all.
  const html = shell('Your access is ready', body);
  const out = await deliver({ from: from(), to: email, subject, html });
  if (out?.error) {
    throw new Error(out.error.message || out.error.name || 'the mail service refused it');
  }
  return { ...out, sent: { subject, html } };
}

/**
 * The welcome for somebody who joined the membership straight from the
 * homepage. Same look and the same one-time sign-in link as the main welcome;
 * the content is the membership alone.
 */
async function sendMemberWelcome(email, loginUrl, { hello, site, membership, until, price = null }) {
  const sections = [
    eyebrow(1, 'Get your AI roadmap') +
      para(`Open ${w('Roadmap')} in your member area and tell us about your business in a few lines. You get back what to do in the next ${w('7, 30 and 90 days')} — start there.`),
    eyebrow(2, 'Use the library') +
      para(`Lessons, tutorials, 1,300+ prompts, skills, agents and Claude routines — all searchable, and new content is added every week.`),
    eyebrow(3, 'Say hello in the community') +
      para(`Ask what to use for anything you are working on. Founders and our team answer, and you can request content we have not made yet.`)
  ];
  /* What Stripe is actually charging, read off the subscription rather than
     written into the sentence. The founding price is meant to move, and an
     email quoting an amount somebody was never charged arrives back as a
     refund request. Whole amounts lose the ".00" so this reads like the rest
     of the copy; if the subscription could not be read at all the yearly line
     simply omits the figure rather than inventing one. */
  const cur = String(price?.currency || 'usd').toUpperCase();
  const money = (cents) => {
    const n = (Number(cents) || 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: cur, minimumFractionDigits: Number.isInteger(n) ? 0 : 2
    }).format(n);
  };
  const paid = price?.amount == null ? null : money(price.amount);

  const plan = membership === 'year'
    ? `${paid ? `${w(paid + ' for the year')} — paid in full` : 'Paid for the year'}${until ? `. It renews on ${w(stampDate(until))}` : ''}. You can turn off renewal any time from your account.`
    : `${w((paid || '$39') + ' a month')} at the founding price, locked for as long as you stay${until ? `. Next payment ${w(stampDate(until))}` : ''}. Cancel any time in two clicks from your account.`;

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">Welcome to ${w('AI Founder University')}. Your membership is active and everything is unlocked.</p>
    <p style="margin:0 0 28px">${button(loginUrl, 'Open your member area')}</p>
    ${rule}
    ${sections.join('\n')}
    ${rule}
    <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 7px">Your membership</p>
    ${para(plan, 22)}
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 10px">
      The button above signs you straight in and works for 15 minutes. After that, enter your email at
      <a href="${site}/members/login.html" style="color:#a1a1aa">${site.replace(/^https?:\/\//, '')}/members/login.html</a>
      and we'll send a fresh link. There is no password to remember.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Stuck on anything? Reply to this email and we'll help.
    </p>`;

  const subject = "You're in — welcome to AI Founder University";
  const html = shell('Your membership is active', body);
  const out = await deliver({ from: from(), to: email, subject, html });
  if (out?.error) throw new Error(out.error.message || out.error.name || 'the mail service refused it');
  return { ...out, sent: { subject, html } };
}

/* ------------------------------------------------------------------ *
 * The welcome again, exactly as it was sent.
 *
 * A welcome is kept with its sign-in link swapped for this marker, because
 * that link lasts fifteen minutes and the copy is kept for good. A resend puts
 * a fresh one back wherever the old one stood, and changes nothing else.
 * ------------------------------------------------------------------ */
const LOGIN_LINK = '{{login_link}}';

/** What to keep of a welcome that just went out: the same email, link marked. */
export function welcomeCopyOf(sent, loginUrl) {
  if (!sent?.subject || !sent?.html) return null;
  return { subject: sent.subject, html: sent.html.split(loginUrl).join(LOGIN_LINK) };
}

/** Send a kept welcome, with a working link, to one of the member's addresses. */
export async function sendWelcomeCopy(email, copy, loginUrl) {
  const out = await deliver({
    from: from(), to: email, subject: copy.subject, html: copy.html.split(LOGIN_LINK).join(loginUrl)
  });
  if (out?.error) throw new Error(out.error.message || out.error.name || 'the mail service refused it');
  return out;
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

  return deliver({
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
      The link works once, for 15 minutes. Asked for more than one? Use the newest
      email: older links stop working. If you didn't request it, you can safely
      ignore this email.
    </p>`;
  /* A number of its own in every subject. With one subject for all of them,
     Gmail stacks every sign-in email in a single thread, and members kept
     pressing the button in the oldest - spent - one and landing back on the
     sign-in page. A different subject keeps each email apart. */
  const code = String(Math.floor(1000 + Math.random() * 9000));
  /* The one member email that is never copied anywhere.
     It carries a working credential, so it goes to the address that asked for
     it and to no other — if somebody types their work address, the link
     arrives at their work address. An address that cannot receive is handled
     by typing the other one, which signs into the same account. */
  return resend().emails.send({
    from: from(), to: email,
    subject: `Your sign-in link (${code}) — AI Founder University`,
    html: shell('Sign in to your member area', body)
  });
}

/**
 * The four emails for somebody who started the Funnel Engine checkout and did
 * not pay. Their own sequence (FE_STEPS in lib/reminders.js) because it is
 * their own product: $100, no trial, a 72-hour guarantee - none of which the
 * $1 reminders say.
 *
 * In order: a short nudge, the questions people actually ask, what another
 * month without it costs, and a last, no-pressure note. No invented deadline
 * and no discount: the price is the price, and the guarantee is the reason to
 * stop thinking about it.
 */
const FE_REMINDERS = {
  1: {
    subject: 'Your Funnel Engine is still in your cart',
    heading: 'You were one step away',
    body: (p) => `
      ${p(`You were about to grab ${w('The Funnel Engine')}. You even put your details in&hellip;`)}
      ${p('&hellip;and then stopped before the card.')}
      ${p(`It happens. A tab gets closed, the kids need something, the coffee goes cold. Your order is
        still here, and finishing it takes about a minute.`)}
      ${p(`Quick reminder of what it is: you tell Claude what you want to sell, and it builds the whole
        offer for you. Sales page, checkout, order bumps, upsells and emails, live on your own domain.
        No funnel builder, no tech skills.`)}
      ${p(`It's ${w('$100, one time')}. A funnel builder charges that every month.`, 20)}`
  },
  2: {
    subject: 'Your questions, answered',
    heading: 'The five questions everybody asks',
    body: (p) => `
      ${p("Most people who pause at the checkout have one of these questions. Here are straight answers.")}
      ${p(`${w('1. Do I need to know how to code?')}<br>No. You talk to Claude in plain English, the way
        you'd brief an assistant. Claude writes every line.`)}
      ${p(`${w('2. How long does it take?')}<br>About an hour the first time, and most of that is telling
        Claude about your offer. Every offer after that goes from idea to live in about 30 minutes.`)}
      ${p(`${w('3. What do I need?')}<br>A paid Claude plan, Chrome on a computer, a Stripe account, a domain
        and hosting (about $5 a month). New to Stripe? Open the account today, approval can take a few days.`)}
      ${p(`${w('4. Do I have to leave the tools I use?')}<br>No. Keep GoHighLevel, Kajabi, ClickFunnels,
        Mailchimp, whatever you like. The /Integrate skill connects your new funnel to them.`)}
      ${p(`${w("5. What if it doesn't work for me?")}<br>Then you don't pay. Set it up, and if within
        72 hours you're not sure you can build and launch an offer with Claude, email us and you get
        every cent back. No forms, no hoops.`, 20)}`
  },
  3: {
    subject: 'What another month without it costs',
    heading: 'The offer that never goes live',
    body: (p) => `
      ${p("Let's be honest about the alternative for a second.")}
      ${p(`Most good offers don't die because they're bad. They die at the step called "now build the
        funnel". The page, the checkout, the payments, the emails, the automations. It goes on the
        list for next week. Then the week after.`)}
      ${p(`Six months later the idea is still in a notes app, and somebody with a worse version of it
        is selling theirs.`)}
      ${p(`That step is exactly what The Funnel Engine removes. You describe the offer, Claude builds it
        on code you own, and it goes live on your domain. ${w('We cleared $79,805 in sales in September')}
        on the same engine you'd be getting.`)}
      ${p(`One payment of ${w('$100')}, and the 72-hour money-back guarantee if it isn't for you.`, 20)}`,
    fine: 'Sales figures are gross funnel sales across businesses owned or co-owned by our team, before fees, not profit. Results vary and no specific earnings are guaranteed.'
  },
  4: {
    subject: 'Is everything okay?',
    heading: 'Last one from us about this',
    body: (p) => `
      ${p('A few days ago you were ready to get The Funnel Engine, and you didn\'t.')}
      ${p("No hard feelings. This is the last email we'll send you about it, so here's the short version.")}
      ${p(`${w("If it's the money:")} it's $100 once, about what a funnel builder costs for a single month.`)}
      ${p(`${w("If it's time:")} the point is that Claude does the building. About an hour the first time,
        about 30 minutes for every offer after.`)}
      ${p(`${w("If it's \"will this work for me\":")} that's what the 72-hour guarantee is for. Set it up,
        and if you're not sure, email us for every cent back. The risk is ours.`)}
      ${p('If not now, when?', 20)}`
  }
};

export const FE_REMINDER_STEPS = Object.keys(FE_REMINDERS).map(Number);

/** One reminder, rendered. Sends nothing, so previews use it too. */
export function funnelEngineReminder(step, { name, checkoutUrl, unsubscribeUrl }) {
  const r = FE_REMINDERS[step];
  if (!r) throw new Error('no Funnel Engine reminder ' + step);
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey,';
  const p = (html, gap = 16) =>
    `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 ${gap}px">${html}</p>`;
  const body = `
    ${p(hello)}
    ${r.body(p)}
    <p style="margin:0 0 24px">${button(checkoutUrl, step === 4 ? 'Get The Funnel Engine' : 'Finish my order')}</p>
    ${p('The AI Founder University team', 18)}
    ${r.fine ? `<p style="color:#52525b;font-size:11px;line-height:1.5;margin:0 0 14px">${r.fine}</p>` : ''}
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you entered your email at our checkout.
      <a href="${unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  return { subject: r.subject, html: shell(r.heading, body) };
}

export async function sendFunnelEngineReminder(email, step, opts) {
  const { subject, html } = funnelEngineReminder(step, opts);
  return resend().emails.send({ from: from(), to: email, subject, html });
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

  return deliver({
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

  return deliver({
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
export async function sendRoadmapReady(email, { name, headline, funnelEngine = false } = {}) {
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
    ${funnelEngine ? `<p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 18px">
      It starts with your offer, written as a Launch Brief. When you want it live,
      <a href="${site}/funnel-engine" style="color:#ffb020">The Funnel Engine</a> has Claude build the
      page, checkout and emails for it.
    </p>` : ''}
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      It is laid out in three phases — days 1-30, 31-60 and 61-90 — with the week-by-week
      steps inside each one. Start at the top. If something in it does not fit, there is a
      box underneath the roadmap: ask there and we will answer and adjust it.
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: 'Your Personalised AI Roadmap is ready',
    html: shell('Your roadmap is ready', body)
  });
}

/**
 * The team has written under somebody's roadmap.
 *
 * Sent whether or not they asked first: an unprompted note is the more
 * valuable of the two, and it is the one nobody would otherwise see until they
 * happened to open the page again.
 */
export async function sendRoadmapNote(email, { name, body: note } = {}) {
  const site = siteUrl();
  const hello = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : 'Hi,';
  // The comment is sanitised HTML by the time it is stored, but it is quoted
  // here as text: an email is a nudge, not the canonical rendering, and
  // trimming HTML to a preview length cuts tags in half.
  const quoted = String(note || '')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px">
      ${hello} there is a new comment from the AI Founder University team on your
      Personalised AI Roadmap.
    </p>
    ${quoted ? `<p style="color:#e4e4e7;font-size:15px;line-height:1.65;margin:0 0 22px;
      padding:16px 18px;background:#161619;border:1px solid #26262b;border-left:3px solid #ff7a1a;
      border-radius:0 12px 12px 0;white-space:pre-wrap">${esc(quoted.slice(0, 600))}${
        quoted.length > 600 ? '…' : ''}</p>` : ''}
    <p style="margin:0 0 24px">${button(`${site}/members/#roadmap`, 'See what is new')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      You can reply in the same place, underneath your roadmap.
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: 'A new comment on your AI Roadmap',
    html: shell('A comment on your roadmap', body)
  });
}

/* ---------------- the weekly AI report ---------------- */

/**
 * A new report is out.
 *
 * The three lines of the summary go in the email itself: somebody who reads
 * only this has still had the week, and the ones who want the detail click.
 */
/**
 * The Monday email.
 *
 * It never shows the report's number. The number is how we file these; to a
 * reader it is a serial on something they did not ask to be counted, and
 * "Report 1" in a subject line says nothing about whether to open it. The
 * title does that. The number still addresses the link, because the route
 * reads it off the front of the slug.
 *
 * It carries a one-click unsubscribe, because this arrives every week whether
 * or not anybody asked that week.
 */
export async function sendReportPublished(email, { name, number, slug, title, dek, sixty = [] } = {}) {
  const site = siteUrl();
  const hello = name ? `Hey ${esc(String(name).trim().split(/\s+/)[0])},` : 'Hey there,';
  const link = `${site}/members/#report-${encodeURIComponent(slug || number)}`;
  const stop = unsubscribeUrl(email);

  /* A masthead rather than the week's headline.
     The headline is in the subject line, where it does the work of earning the
     open. Repeating it on a banner, then again as a heading, then again as the
     first line of the body told the reader nothing they had not read in their
     inbox - and left the message itself looking like a template with their
     name missing from it.

     Built from text and a background colour rather than an image, because an
     image is the first thing a mail client refuses to load and a masthead that
     only appears for some readers is not a masthead. */
  const banner = `
    <div style="background:#0a0a0b;border:1px solid #26262b;border-radius:14px;padding:26px 24px 22px;margin:0 0 26px">
      <div style="color:#ffb020;font-weight:800;font-size:23px;line-height:1.2;letter-spacing:-.02em">
        AI Founder University</div>
      <div style="color:#71717a;font-size:12px;letter-spacing:.14em;margin-top:8px;
        font-family:ui-monospace,SFMono-Regular,Menlo,monospace">THE WEEKLY AI REPORT</div>
      <div style="height:3px;width:56px;background:#ff7a1a;border-radius:2px;margin-top:16px"></div>
    </div>`;

  const body = `
    ${banner}
    <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 22px">${esc(dek || '')}</p>
    ${sixty.length ? `<p style="color:#71717a;font-size:12px;letter-spacing:.12em;margin:0 0 10px;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace">IN 60 SECONDS</p>
    <ul style="color:#e4e4e7;font-size:15px;line-height:1.7;margin:0 0 24px;padding-left:20px">
      ${sixty.slice(0, 3).map((s) => `<li style="margin-bottom:9px">${esc(s)}</li>`).join('')}
    </ul>` : ''}
    <p style="margin:0 0 24px">${button(link, 'Read the full report')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 16px">
      Every item links to the announcement it came from. One report a week, and nothing in between.
    </p>
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you're a member of AI Founder University.
      <a href="${esc(stop)}" style="color:#71717a">Unsubscribe from the weekly report</a>
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: title,
    html: shell('', body, { bare: true }),
    headers: {
      // One click, from the mail client's own chrome, without opening anything.
      'List-Unsubscribe': `<${stop}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  });
}

/**
 * Nothing went out this week, and why.
 *
 * To staff, not to members. A pipeline that fails quietly is one that has been
 * broken for a month before anybody notices, so the one person who can fix it
 * hears on the morning it happens.
 */
/* The shelf each kind lives on, so every line in the email goes somewhere a
   member can actually use rather than to the library's front door. */
const SHELF = {
  course: { label: 'New Courses', glyph: '🎓', hash: 'courses' },
  prompt: { label: 'New Prompts', glyph: '💬', hash: 'prompt' },
  image_prompt: { label: 'New Image & Video Prompts', glyph: '🎨', hash: 'image_prompt' },
  skill: { label: 'New Agents & Skills', glyph: '🤖', hash: 'skill' },
  gpt: { label: 'New AI Assistants', glyph: '🧠', hash: 'gpt' },
  automation: { label: 'New Automations', glyph: '⚡', hash: 'automation' },
  guide: { label: 'New Guides', glyph: '📖', hash: 'guide' },
  video: { label: 'New Tutorials', glyph: '🎬', hash: 'video' },
  // Sold on its own rather than opened by the membership: the Funnel Engine
  // and its bumps. Its own heading, so nobody reads it as already theirs, and
  // each item links to the page that sells it.
  offer: { label: 'New to add to your library', glyph: '🚀', hash: 'courses' },
  // A tool built into the member area itself, rather than something on a shelf.
  feature: { label: 'New Member Tools', glyph: '🧰', hash: 'dashboard' }
};
/* The order the sections appear in: what somebody is most likely to open first.
   A course leads, because it is the biggest thing we ever ship and the one a
   member is most likely to have been waiting for. It also therefore takes the
   subject line, which is picked by this same order. */
const SHELF_ORDER = ['feature', 'course', 'video', 'skill', 'automation', 'gpt', 'image_prompt', 'prompt', 'guide', 'offer'];

/* An icon for the item rather than for its shelf.
   Nine tutorials all wearing the same clapperboard is a list you scan past;
   the eye is looking for the one thing it wants, and the icon is the fastest
   thing on the line to read. So it comes from what the item is actually
   about - its tags first, which carry the subject ("ai voice agent",
   "higgsfield", "ukiyo-e"), then its category, which every item has.

   Most specific wins, so the order of this list is the rule. Chosen rather
   than generated: a fixed table gives the same item the same icon every week,
   where anything cleverer would quietly reshuffle them. */
const ICON_BY_SUBJECT = [
  [/voice agent|receptionist|phone/, '📞'],
  [/motion director|video prompt|claude code video|claude motion/, '🎞️'],
  [/higgsfield|runway|veo|sora|video generat/, '🎥'],
  [/podcast/, '🎙️'],
  [/spreadsheet|excel|csv/, '📊'],
  [/tool stack|tech stack/, '🧰'],
  [/sub-agent|\bagents?\b|\bdots?\b|plugin|mcp|connector/, '🤖'],
  [/learn|teach|course|study/, '🎓'],
  [/cost|price|bill|cheaper|budget|spend/, '💸'],
  [/ukiyo|japan|woodblock/, '🎌'],
  /* \beco\b, not eco — "Art Deco" contains it, and the Art Deco prompts came
     out wearing a sprig of greenery. Every short word here is bounded for the
     same reason. */
  [/solarpunk|\beco\b|garden|green architecture/, '🌿'],
  [/art deco|machine age|streamline|monument/, '🏛️'],
  [/noir|dither|1-bit|monochrome/, '🌓'],
  [/horror|liminal|vhs|found footage/, '📼'],
  [/risograph|zine|halftone|\bprint\b/, '🖨️'],
  [/portrait|photo|camera|lens/, '📷'],
  [/whatsapp|messenger|\bchat\b|inbox/, '💬'],
  [/email|newsletter/, '✉️'],
  [/\bseo\b|search|ranking/, '🔍'],
  [/ecommerce|e-commerce|\bshop\b|product page|\bsales\b/, '🛒'],
  [/social|instagram|linkedin|tiktok|twitter/, '📱'],
  [/invoice|accounting|finance|payroll/, '🧾'],
  [/legal|contract|policy/, '⚖️'],
  [/research|analysis|data|analytics|report/, '📈'],
  [/write|copy|blog|article|script/, '✍️'],
  [/brand|logo|design|colour|color/, '🎨'],
  [/automat|workflow|zapier|make\.com|n8n/, '⚙️'],
  [/strategy|planning|roadmap|decision/, '🧭'],
  [/productivity|faster|time/, '⚡']
];

const ICON_BY_CATEGORY = {
  'Marketing': '📣', 'Social Media': '📱', 'Image': '🎨', 'Copywriting': '✍️',
  'Business Strategy': '🧭', 'SEO & Content': '🔍', 'Productivity': '⚡',
  'Sales & E-commerce': '🛒', 'Creative & Design': '🎨', 'Prompt Engineering': '🧪',
  'General': '✨', 'Video': '🎬', 'Business Operations': '⚙️',
  'Data & Analytics': '📈', 'Content & Copywriting': '✍️', 'Strategy & Planning': '🧭',
  'Client & Sales': '🤝', 'Branding & Design': '🎨', 'Email Marketing': '✉️',
  'Events & Education': '🎓', 'HR & Team': '👥', 'Video & Podcast': '🎬', 'SEO': '🔍'
};

/** The icon for one item: its subject, then its category, then its shelf. */
export function iconFor(item) {
  if (item.icon) return item.icon;
  const subject = [item.title, ...(item.tags || [])].join(' ').toLowerCase();
  for (const [re, icon] of ICON_BY_SUBJECT) if (re.test(subject)) return icon;
  if (item.category && ICON_BY_CATEGORY[item.category]) return ICON_BY_CATEGORY[item.category];
  return SHELF[item.kind]?.glyph || '✨';
}

/**
 * What landed in the library this week.
 *
 * Sent on a Friday evening, after the week's additions are in, and shaped the
 * way a member reads a list like this: grouped by what the thing is, one line
 * each saying what it does rather than that it exists, and every title its own
 * link into the member area. The description is the item's own - the thing it
 * says about itself on its card - so the email cannot promise something the
 * page then does not say.
 *
 * `items` is already filtered and grouped by the caller; this only writes it.
 */
/**
 * The Promise Builder, announced: once to everybody, in two versions. Members
 * on a trial or the paid membership are sent straight to it; everybody else is
 * told the same thing and offered the membership that opens it. Written to get
 * it used: what it is in one line, four things to do with it today, and why
 * it beats a blank page.
 */
export function promiseBuilderEmail(member, { name, unsubscribe } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${esc(first.charAt(0).toUpperCase() + first.slice(1))},` : 'Hey,';
  const p = (h, gap = 14) => `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 ${gap}px">${h}</p>`;
  const b = (t) => `<b style="color:#fff">${t}</b>`;
  const list = (items) => `<ul style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px;padding-left:20px">${
    items.map((i) => `<li style="margin:0 0 8px">${i}</li>`).join('')}</ul>`;
  const body = `
    ${p(hello)}
    ${p('The first line of a sales page decides whether anybody reads the second.')}
    ${p('It is also the line most people stare at for an hour, then write "Welcome to my course".')}
    ${p(`So we built something for it. ${b('The Promise Builder')} is ${member ? 'new in your member area' : 'new in the AI Founder University member area'}.`)}
    ${p(`Tell it about your offer in a sentence or two. In about a minute you get ${b('six promises for the top of your sales page')}: the line above the headline, the headline, and the line under it, ready to paste.`, 20)}
    ${p(b('Four quick wins you can get from it today:'), 8)}
    ${list([
      `${b('A better headline for the page you already have.')} Describe your offer, pick the strongest of the six, swap it in. Five minutes.`,
      `${b('A hook for your next ad.')} The line above the headline and the headline are a ready-made opener for a Meta ad.`,
      `${b('A subject line that gets opened.')} The two wild cards are written to stop the scroll.`,
      `${b('A clearer offer.')} It starts by summing up what you sell in one sentence. For a lot of people it is the first time they have seen it that clearly.`
    ])}
    ${p(b('Why it beats a blank page:'), 8)}
    ${list([
      `Every promise is ${b('scored 1 to 5')} on what makes people buy: small, tangible, an action, push-button easy, and how fast. You can see why one works and another does not.`,
      `${b('One click')} makes any of them more tangible, bolder, simpler, or takes a whole new angle.`,
      `${b('It never invents proof.')} No made-up testimonials, results or numbers. Only what you give it.`,
      `Your past promises are saved, so you can come back to the ones you liked.`
    ])}
    ${member
      ? p(`It's included in your membership, 10 runs a day.`, 20)
      : p(`${b("It's part of the membership")}, along with your AI Roadmap, the weekly AI reports, and everything new we add each week.`, 20)}
    <p style="margin:6px 0 22px">${button(member ? `${site}/members/#promise` : `${site}/members/join.html`,
      member ? 'Write my promises' : 'Unlock it with the membership')}</p>
    ${p('The AI Founder University team')}
    ${p(`${b('P.S.')} No sales page yet? <a href="${site}/funnel-engine" style="color:#ffb020">The Funnel Engine</a> has Claude build one around your promise: page, checkout and emails, live on your own domain.`)}
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you're a member of AI Founder University.
      <a href="${esc(unsubscribe || '#')}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  return {
    subject: member ? 'Your sales page headline, written in a minute' : 'We built you a headline writer',
    preview: member ? 'New in your member area: The Promise Builder' : 'Six promises for your sales page, in about a minute',
    html: shell('Meet The Promise Builder', body)
  };
}

export async function sendPromiseBuilder(email, member, { name } = {}) {
  const stop = unsubscribeUrl(email);
  const { subject, html } = promiseBuilderEmail(member, { name, unsubscribe: stop });
  return deliver({
    from: from(), to: email, subject, html,
    headers: { 'List-Unsubscribe': `<${stop}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  });
}

/**
 * The roadmap members' price on the Funnel Engine (lib/roadmap-deal.js): the
 * email that says a message is waiting under their roadmap, and the two
 * reminders before the 48 hours run out. The deadline in each is the one the
 * checkout enforces, so none of them can promise a price that is gone.
 */
const DEAL_COPY = {
  open: {
    subject: 'A message under your roadmap (and a members\' price)',
    heading: 'A message under your roadmap',
    lines: (d) => [
      `We've left you a private message underneath your Personalised AI Roadmap.`,
      `The short version: your roadmap is the plan. <b style="color:#fff">The Funnel Engine</b> is how it gets built, without the weeks of building and without anything technical. You paste your offer into Claude, and Claude puts the sales page, checkout and emails live on your own domain.`,
      `Because you have your roadmap, it's <b style="color:#fff">${DEAL_PERCENT}% off for ${DEAL_HOURS} hours: ${d.price} instead of ${d.full}</b>. The price ends ${d.ends}.`
    ],
    cta: 'Read your message', ctaTo: 'roadmap',
    after: (d) => `Or go straight to the <a href="${d.url}" style="color:#ffb020">${d.price} checkout</a>.`
  },
  h24: {
    subject: '24 hours left on your roadmap price',
    heading: 'Your price ends tomorrow',
    lines: (d) => [
      `Your roadmap members' price on the Funnel Engine ends <b style="color:#fff">${d.ends}</b>. ${d.price} instead of ${d.full}.`,
      `Your roadmap tells you what to build. The Funnel Engine builds it: the sales page, the checkout, the order bumps and the emails, live on your own domain.`,
      `About an hour to install. Nothing technical: you talk to Claude in plain English and do the logins.`,
      `And you're covered by the 72-hour money-back guarantee, so the only thing you risk by trying it is an afternoon.`
    ],
    cta: (d) => `Get it for ${d.price}`, ctaTo: 'deal'
  },
  h1: {
    subject: (d) => `Your ${d.price} price ends in an hour`,
    heading: 'One hour left',
    lines: (d) => [
      `Quick one: your roadmap members' price on the Funnel Engine ends at <b style="color:#fff">${d.ends}</b>, about an hour from now.`,
      `After that it's ${d.full}, the same as everyone else.`,
      `If you were going to get it, now's the cheapest it will be.`
    ],
    cta: (d) => `Get it for ${d.price}`, ctaTo: 'deal'
  }
};

export function roadmapDealEmail(which, { name, url, endsAt, unsubscribe } = {}) {
  const c = DEAL_COPY[which];
  if (!c) throw new Error('no roadmap deal email ' + which);
  const site = siteUrl();
  const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
  const d = { price: money(dealPrice()), full: money(dealPrice() * 100 / (100 - DEAL_PERCENT)),
              ends: dealEndsLabel(endsAt), url: esc(url) };
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${esc(first.charAt(0).toUpperCase() + first.slice(1))},` : 'Hi,';
  const para = (h) => `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 14px">${h}</p>`;
  const label = typeof c.cta === 'function' ? c.cta(d) : c.cta;
  const href = c.ctaTo === 'roadmap' ? `${site}/members/#roadmap` : url;
  const body = `
    ${para(hello)}
    ${c.lines(d).map(para).join('')}
    <p style="margin:8px 0 18px">${button(href, label)}</p>
    ${c.after ? para(c.after(d)) : ''}
    ${para('The AI Founder University team')}
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you're a member of AI Founder University.
      <a href="${esc(unsubscribe || '#')}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  const subject = typeof c.subject === 'function' ? c.subject(d) : c.subject;
  return { subject, html: shell(c.heading, body) };
}

export async function sendRoadmapDeal(email, which, opts = {}) {
  const stop = unsubscribeUrl(email);
  const { subject, html } = roadmapDealEmail(which, { ...opts, unsubscribe: stop });
  return deliver({
    from: from(), to: email, subject, html,
    headers: { 'List-Unsubscribe': `<${stop}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  });
}

/**
 * One of the seven Funnel Engine introductions (lib/funnel-engine-launch.js),
 * drawn in the house layout. `step` is 1-7. Sends nothing, so previews and
 * the test send use it as well.
 */
export function funnelEngineLaunchEmail(step, { name, unsubscribe } = {}) {
  const e = LAUNCH[step - 1];
  if (!e) throw new Error('no Funnel Engine launch email ' + step);
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const fill = (t) => t
    .replace(/\{first\}/g, first ? esc(first.charAt(0).toUpperCase() + first.slice(1)) : 'there')
    .replace(/\{page\}/g, `${site}/funnel-engine`)
    .replace(/\{checkout\}/g, `${site}/funnel-engine/checkout.html`)
    .replace(/<b>/g, '<b style="color:#fff">')
    .replace(/<ul>/g, '<ul style="margin:8px 0 0;padding-left:20px">');
  const para = (h) => h.includes('<ul')
    ? `<div style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 14px">${h}</div>`
    : `<p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 14px">${h}</p>`;
  const body = `
    ${e.body.map((b) => para(fill(b))).join('')}
    <p style="margin:8px 0 24px">${button(fill(e.cta[1]), e.cta[0])}</p>
    ${para('The AI Founder University team')}
    ${e.ps ? para(fill('<b>P.S.</b> ' + e.ps)) : ''}
    ${e.fine ? `<p style="color:#52525b;font-size:11px;line-height:1.5;margin:0 0 14px">${e.fine}</p>` : ''}
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you're a member of AI Founder University.
      <a href="${esc(unsubscribe || '#')}" style="color:#71717a">Unsubscribe</a>
    </p>`;
  return { subject: e.subject, preview: e.preview, html: shell(e.heading, body) };
}

export async function sendFunnelEngineLaunch(email, step, { name } = {}) {
  const stop = unsubscribeUrl(email);
  const { subject, html } = funnelEngineLaunchEmail(step, { name, unsubscribe: stop });
  return deliver({
    from: from(), to: email, subject, html,
    headers: {
      'List-Unsubscribe': `<${stop}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  });
}

export async function sendNewTools(email, { name, items = [], total = 0 } = {}) {
  const site = siteUrl();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hey ${first},` : 'Hey there,';
  const stop = unsubscribeUrl(email);

  const byKind = new Map();
  for (const it of items) {
    if (!byKind.has(it.kind)) byKind.set(it.kind, []);
    byKind.get(it.kind).push(it);
  }

  const sections = SHELF_ORDER.filter((k) => byKind.has(k)).map((kind) => {
    const shelf = SHELF[kind];
    const rows = byKind.get(kind).map((it) => {
      /* Most kinds open their shelf, because a prompt among four hundred is
         found by browsing. A course carries its own hash and opens itself. */
      const href = it.href || `${site}/members/#${it.hash || shelf.hash}`;
      // One sentence, trimmed rather than wrapped: a card's description can run
      // long and this is a list to scan, not a page to read.
      const blurb = String(it.description || '').trim().replace(/\s+/g, ' ');
      // A product we sell gets its whole description: it is introduced once,
      // and the price and guarantee are at the end of it.
      const max = it.kind === 'offer' || it.kind === 'feature' ? 400 : 180;
      const short = blurb.length > max ? blurb.slice(0, max - 3).replace(/[\s,;:]+\S*$/, '') + '…' : blurb;
      return `
      <tr><td style="padding:0 0 14px">
        <a href="${href}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none">
          ${iconFor(it)} ${esc(it.title)}</a>
        ${short ? `<div style="color:#a1a1aa;font-size:14px;line-height:1.55;margin-top:4px">${esc(short)}</div>` : ''}
      </td></tr>`;
    }).join('');

    return `
    <p style="color:#fff;font-size:15px;font-weight:700;margin:22px 0 12px">${shelf.label}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">${rows}</table>`;
  }).join('');

  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 4px">
      ${esc(newToolsIntro(items, total))}
    </p>
    ${sections}
    <p style="margin:26px 0 24px">${button(`${site}/members/`, 'Open your library')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 16px">
      Have a good weekend.
    </p>
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      You're getting this because you're a member of AI Founder University.
      <a href="${esc(stop)}" style="color:#71717a">Unsubscribe</a>
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: newToolsSubject(items, total),
    html: shell('New in your library', body),
    headers: {
      // One click, from the mail client's own chrome, without opening anything.
      'List-Unsubscribe': `<${stop}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  });
}

/**
 * The opening line.
 *
 * It was one sentence with the count dropped into it, which reads like a form
 * letter by the third Friday — the same words every week, with only a digit
 * moving. These say the same thing different ways.
 *
 * The week picks which, not chance: everybody who gets the email on a given
 * Friday gets the same one, so two members comparing notes are not reading
 * different letters, and the line still moves from week to week. Keyed on the
 * ISO week because its boundary is a Monday, which means it can never change
 * partway through a Friday evening send.
 */
/* Some of the lines say what actually arrived rather than how much of it -
   "Four tutorials, a skill, and two sets of image prompts" - which is the
   version a member can decide about without opening anything. It needs a noun
   for each kind, since "4 video" is not English and the shelf label is a
   heading rather than a phrase. */
const KIND_NOUN = {
  course: ['a new course', 'new courses'],
  video: ['a tutorial', 'tutorials'],
  skill: ['a skill', 'skills'],
  automation: ['an automation', 'automations'],
  gpt: ['a custom GPT', 'custom GPTs'],
  image_prompt: ['a set of image prompts', 'sets of image prompts'],
  prompt: ['a prompt', 'prompts'],
  guide: ['a guide', 'guides'],
  offer: ['a new product', 'new products'],
  feature: ['a new member tool', 'new member tools']
};

// Small numbers read as words in a sentence; past ten a digit is easier.
const NUMBER_WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "Four tutorials, a skill, and two sets of image prompts" — or null. */
function kindPhrase(items = []) {
  const counts = new Map();
  for (const it of items) counts.set(it.kind, (counts.get(it.kind) || 0) + 1);
  const parts = SHELF_ORDER
    .filter((k) => counts.has(k) && KIND_NOUN[k])
    .map((k) => {
      const n = counts.get(k);
      return n === 1 ? KIND_NOUN[k][0] : `${NUMBER_WORD[n] || n} ${KIND_NOUN[k][1]}`;
    });
  // A kind we have no noun for would silently drop out of the sentence and
  // make it a lie, so in that case there is no phrase at all. Past three
  // kinds it stops being a sentence and becomes a list to wade through, and
  // the plain count says more; the week picks another line instead.
  if (!parts.length || parts.length > 3) return null;
  if (parts.length !== new Set(items.map((i) => i.kind)).size) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Each line is given the count and the phrase, and may return null when it
   cannot be written — a line built on the phrase has nothing to say when there
   is no phrase. The picker falls through to the first, which always works. */
const INTROS_MANY = [
  ({ t }) => `${t} new things went into your library this week.`,
  () => `Here's what landed in your library this week.`,
  ({ t }) => `Your library picked up ${t} new things this week.`,
  ({ p }) => p && `${cap(p)} have gone up since last week.`,
  () => `Here's what just went live this week on AI Founder University.`,
  ({ t }) => `${t} new arrivals this week — here they are.`,
  ({ p }) => p && `This week: ${p}.`,
  ({ t }) => `This week's additions are in. ${t} of them.`,
  ({ p }) => p && `${cap(p)} — all new in your library this week.`,
  ({ t }) => `${t} new things went live on AI Founder University this week.`,
  ({ t }) => `${t} things went up this week.`
];

const INTROS_ONE = [
  () => `One new thing went into your library this week.`,
  () => `Here's the one thing that landed this week.`,
  ({ p }) => p && `${cap(p)} has gone up since last week.`,
  () => `Here's the one thing that just went live on AI Founder University.`,
  () => `Your library picked up one new thing this week.`,
  () => `A single new arrival this week.`
];

function isoWeek(d) {
  // Thursday of this week decides the year, which is what makes it the ISO
  // week and not merely a count of Sundays.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t - jan1) / 86400000 + 1) / 7);
}

export function newToolsIntro(items = [], total = 0, when = new Date()) {
  const list = total === 1 ? INTROS_ONE : INTROS_MANY;
  const ctx = { t: total, p: kindPhrase(items) };
  return list[isoWeek(when) % list.length](ctx) || list[0](ctx);
}

/**
 * The subject line: the best single thing in the drop, named.
 *
 * "5 new tools" tells a member nothing they want; the title of the one item
 * they might open does. Picked by the order above rather than at random, so a
 * tutorial beats a prompt - and the count rides along behind it.
 */
export function newToolsSubject(items = [], total = 0) {
  const pick = SHELF_ORDER.map((k) => items.find((i) => i.kind === k)).find(Boolean) || items[0];
  if (!pick) return 'New in your library';
  const glyph = iconFor(pick);
  const rest = total - 1;
  const title = String(pick.title).trim();
  return rest > 0 ? `${glyph} ${title} — and ${rest} more` : `${glyph} ${title}`;
}

/* ---------------- a payment that keeps failing ---------------- */

/**
 * The five messages that go out while Stripe retries a card.
 *
 * Stripe makes up to eight attempts over about two weeks and then marks the
 * subscription unpaid. Eight emails for eight attempts would be its own reason
 * to leave, so these land at the five moments where something has actually
 * changed: it failed, it failed again, it is still failing, access is about to
 * end, and today is the last attempt.
 *
 * Only two groups ever receive them — members who chose the trial on the
 * upgrade page and members who joined from the homepage. Everybody else bought
 * once, has no card on file to fail, and is never written to.
 *
 * The tone moves, the facts do not. Nothing says access has ended while it has
 * not, nothing invents a deadline Stripe is not actually working to, and the
 * amount is the one on the invoice rather than one written into a template.
 */
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth'];
const ordinal = (n) => ORDINAL[n] || `${n}th`;

const when = (d) => d
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  : null;

// Spelled out in a sentence, the way the intro lines do it — "2 attempts left"
// reads like a system message, "Two attempts left" like somebody wrote it.
const plural = (n, one, many) => `${NUMBER_WORD[n] || n} ${n === 1 ? one : many}`;

const PAYMENT_STEPS = {
  /* The first decline. Nothing has gone wrong from the member's side yet and
     most of these clear themselves on the next attempt, so this is
     information rather than a demand. */
  first: {
    subject: ({ money }) => `Your ${money} payment didn't go through`,
    lead: ({ card }) => `${cap(card)} was declined when we tried to take your membership payment.`,
    body: ({ next }) =>
      `<p>Nothing has changed yet — you still have everything you had yesterday. Cards get
       declined for ordinary reasons: an expiry date that rolled over, a replacement card,
       a bank being cautious about a payment it did not expect.</p>
       ${next ? `<p>We'll try again automatically on <strong>${next}</strong>. If the card is
       working by then, you can ignore this.</p>` : ''}`
  },

  /* The second. The first was not a blip, but there is still a fortnight of
     retries left, so there is nothing to threaten anybody with. */
  again: {
    subject: () => `We still can't take your payment`,
    lead: ({ nth }) => `We tried again, and your card was declined a ${nth} time.`,
    body: ({ next }) =>
      `<p>Your membership is still active and your access is untouched. But a card that has
       failed twice usually keeps failing.</p>
       <p>Updating it takes about a minute. If your bank is the one blocking it, a different
       card almost always goes through.</p>
       ${next ? `<p>The next attempt is <strong>${next}</strong>.</p>` : ''}`
  },

  /* The middle of the run. The thing worth saying here is that stopping on
     purpose is a legitimate choice, and better for everyone than access
     disappearing from somebody who simply never opened the email. */
  easy: {
    subject: ({ nth }) => `Your card was declined a ${nth} time`,
    lead: ({ nth }) => `That is the ${nth} decline, so something has genuinely changed with the card.`,
    body: ({ next }) =>
      `<p>The button below takes you straight to your billing details. No password, nothing
       to remember.</p>
       <p>And if you would rather stop the membership, you can do that from the same page.
       I would much rather you chose that than lost access to something you meant to keep.</p>
       ${next ? `<p>Otherwise we try again on <strong>${next}</strong>.</p>` : ''}`
  },

  /* The first message with a consequence in it, because now there is one. The
     count of attempts left is real: it comes from what Stripe is configured to
     do, minus what it has already done. */
  /* The first message with a consequence in it, because now there is one — and
     so the only one that carries the offer.

     The offer belongs here rather than at the end. A discount sent after the
     membership has lapsed is a win-back campaign: it asks somebody to make a
     decision again, from a standing start, about a thing they have already
     lost. Sent while the subscription is still alive it is a reason to keep
     it, and keeping something is a far smaller act than restarting it.

     It is also the first point where price is a plausible explanation. Up to
     here a decline is usually mechanical — an expired card, a replaced card —
     and offering money off a card that merely expired gives away margin to
     somebody who was never leaving. */
  warning: {
    subject: ({ left, offer }) => offer
      ? `${cap(plural(left, 'attempt', 'attempts'))} left — or keep it for less`
      : `${cap(plural(left, 'attempt', 'attempts'))} left on your membership`,
    lead: ({ n, left }) =>
      `Your card has now been declined ${plural(n, 'time', 'times')}, and there ${left === 1
        ? 'is one attempt left' : `are ${plural(left, 'attempt', 'attempts')} left`}.`,
    body: ({ next, offer }) =>
      `<p>When the last one fails, the membership ends: the courses, the weekly drops, the
       news feed and the community all close.</p>
       <p><strong>Anything you bought outright stays yours.</strong> Your Specialists, your
       plugins and every file you have downloaded are not part of the membership and do not
       go anywhere.</p>
       ${offer ? `<p>And if the problem is the price rather than the card, you do not have to
       let it lapse to fix that — <strong>${esc(offer)}</strong>, from this payment onward.
       It is cheaper than leaving and coming back.</p>` : ''}
       ${next ? `<p>The next attempt is <strong>${next}</strong>.</p>` : ''}`
  },

  /* Stripe has stopped. This only ever goes out when the invoice says there is
     no next attempt, so "that was the last one" is a fact rather than a guess.
     It offers nothing: the discount had its moment while there was still a
     membership to save, and repeating it here would teach the next person that
     the way to get a better price is to stop paying. */
  final: {
    subject: () => `That was the last attempt on your card`,
    lead: ({ n }) => `Your card was declined ${plural(n, 'time', 'times')}, and that was the last attempt.`,
    body: () =>
      `<p>Your membership has ended. Everything you bought outright stays yours, as always —
       the Specialists, the plugins and every file you have downloaded. Those are not part of
       the membership and nothing has been taken away from them.</p>
       <p>If that was not what you wanted, you can start it again whenever you like and pick
       up where you left off. If it had run its course, that is fair enough too.</p>
       <p>Nothing else will arrive about this.</p>`
  }
};

export const PAYMENT_STEP_KEYS = Object.keys(PAYMENT_STEPS);

/**
 * Which message an actual Stripe event earns.
 *
 * Driven by the invoice rather than by a calendar, so every claim in the copy
 * is one the event can back: the ordinal is `attempt_count`, the date is
 * `next_payment_attempt`, and "that was the last one" is only ever said when
 * Stripe has told us there is no next attempt.
 *
 * `maxAttempts` mirrors the retry schedule configured in Stripe. It is only
 * ever used to count down, never to decide that the run has ended — that call
 * belongs to Stripe alone, because a setting changed in the dashboard would
 * otherwise turn this into a liar.
 */
export function stepForAttempt(attempt, nextAttempt, maxAttempts = 8) {
  if (!nextAttempt) return 'final';
  const left = Math.max(0, maxAttempts - attempt);
  if (left <= 2) return 'warning';
  if (attempt <= 1) return 'first';
  if (attempt === 2) return 'again';
  return 'easy';
}

/**
 * One message in that sequence.
 *
 * `manageUrl` is built by the caller, because it carries a credential and this
 * has no business minting one. `amount` and `currency` come off the invoice.
 */
export async function sendPaymentRetry(email, {
  step, name, amount, currency = 'usd', manageUrl, cardLabel,
  attempt = 1, nextAttempt = null, maxAttempts = 8,
  offer = null, offerUrl = null, offerCta = null
} = {}) {
  const nextDate = nextAttempt ? new Date(nextAttempt) : null;
  const key = step || stepForAttempt(attempt, nextDate, maxAttempts);
  const s = PAYMENT_STEPS[key];
  if (!s) throw new Error(`unknown payment step: ${key}`);

  const cur = String(currency || 'usd').toUpperCase();
  const money = typeof amount === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount / 100)
    : 'your';
  /* Every one of these is a fact the invoice can back, which is the whole
     point: the ordinal is what Stripe counted, the date is what Stripe
     scheduled, and the number left is what Stripe has yet to do. */
  const ctx = {
    money,
    card: cardLabel ? `the card ending ${esc(cardLabel)}` : 'your card',
    n: attempt,
    nth: ordinal(attempt),
    left: Math.max(0, maxAttempts - attempt),
    next: when(nextDate),
    offer
  };

  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = first ? `Hi ${esc(first)},` : 'Hi,';
  const cta = key === 'final' ? 'Start it again' : 'Update your card';

  const body = `
    <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px">${hello}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 18px">${s.lead(ctx)}</p>
    <div style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 6px">${s.body(ctx)}</div>
    <p style="margin:24px 0 ${offerUrl ? '12px' : '24px'}">${button(manageUrl, cta)}</p>
    ${offerUrl ? `<p style="margin:0 0 24px">
      <a href="${esc(offerUrl)}" style="color:#ffb020;font-size:15px;font-weight:700">
        ${esc(offerCta || 'Keep my membership at the lower price')}</a></p>` : ''}
    <p style="color:#52525b;font-size:12px;line-height:1.6;margin:0;border-top:1px solid #26262b;padding-top:16px">
      This is about your membership billing, so it is sent whatever your email preferences are.
      It stops the moment the payment goes through.
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: s.subject(ctx),
    html: shell('', body, { bare: true })
  });
}

/** The payment went through after all. Short, and the last word on it. */
export async function sendPaymentRecovered(email, { name, amount, currency = 'usd' } = {}) {
  const cur = String(currency || 'usd').toUpperCase();
  const money = typeof amount === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount / 100)
    : 'Your payment';
  const first = String(name || '').trim().split(/\s+/)[0];

  const body = `
    <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 14px">${first ? `Hi ${esc(first)},` : 'Hi,'}</p>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.65;margin:0 0 18px">
      ${money} went through. Your membership carries on as normal and there is nothing for you to do.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Sorry for the chasing — we stop the moment a payment lands.
    </p>`;

  return deliver({
    from: from(), to: email,
    subject: 'Payment received — nothing more to do',
    html: shell('', body, { bare: true })
  });
}

/**
 * The AI Black Magic pull has lost its sign-in. It runs on the owner's own
 * computer (tools/migrate/run-weekly.cmd), which has no email key, so it only
 * records the fact; the notify cron sends this, once per lapse.
 */
export async function sendPullSignedOut({ since, reason } = {}) {
  const to = adminEmails();
  if (!to.length) return null;
  const when = since ? new Date(since).toUTCString().replace(' GMT', ' UTC') : 'the last run';
  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 18px">
      The daily pull of new AI Black Magic tools could not sign in (${esc(when)}), so nothing new is being
      fetched. The saved session has run out: that happens after a password change, or a few weeks without a run.
    </p>
    <p style="color:#fff;font-size:15px;line-height:1.6;margin:0 0 20px;padding:14px 16px;
      background:#161619;border:1px solid #26262b;border-left:3px solid #ff7a1a;border-radius:0 10px 10px 0">
      On your computer, open the folder <strong>AIProject\\tools\\migrate</strong> and double-click
      <strong>sign-in-blackmagic.cmd</strong>. Sign in in the window that opens and go to the dashboard.
      It saves by itself and closes.
    </p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      The next run picks up everything it missed. This email comes once each time the sign-in runs out.
      ${reason ? `<br>What the run said: ${esc(reason)}` : ''}
    </p>`;
  return resend().emails.send({
    from: from(), to,
    subject: 'Sign in to AI Black Magic again: the daily pull has stopped',
    html: shell('The tool pull needs you to sign in', body)
  });
}

export async function sendReportHeld({ number, reason, health = [] } = {}) {
  const site = siteUrl();
  const to = adminEmails();
  if (!to.length) return null;

  const down = health.filter((h) => !h.ok);
  const body = `
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 18px">
      Report ${esc(number) || '(unnumbered)'} did not go out this morning. Members saw nothing; there
      is no broken report on the site.
    </p>
    <p style="color:#fff;font-size:15px;line-height:1.6;margin:0 0 20px;padding:14px 16px;
      background:#161619;border:1px solid #26262b;border-left:3px solid #ff7a1a;border-radius:0 10px 10px 0">
      ${esc(reason)}
    </p>
    ${down.length ? `<p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 18px">
      Sources that did not answer: ${down.map((d) => esc(d.source)).join(', ')}.</p>` : ''}
    <p style="margin:0 0 20px">${button(`${site}/members/admin.html`, 'Open the admin')}</p>
    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0">
      Nothing needs doing today. The next run is next Monday, and a held report can be looked at and
      published by hand before then.
    </p>`;

  return resend().emails.send({
    from: from(), to,
    subject: `Weekly report held: ${String(reason).slice(0, 60)}`,
    html: shell('A report was held', body)
  });
}
