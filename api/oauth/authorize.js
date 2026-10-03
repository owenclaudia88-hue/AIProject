/**
 * The consent screen.
 *
 * This is the only part of the connector a member ever sees on our side: Claude
 * sends them here, they say yes, and they go back. It reuses the session cookie
 * they already have, so for somebody already signed in it is one click.
 *
 * Two rules shape the error handling. Until the client and its redirect URI are
 * known good, nothing is redirected anywhere - an error is drawn on this page
 * instead, because bouncing to an unverified URI is exactly how an open
 * redirect works. Once they are verified, later errors do go back to the client
 * as OAuth errors, which is what a client can actually act on.
 */
import { currentSession } from '../../lib/session.js';
import { getCustomer, entitlementsFor } from '../../lib/db.js';
import { MEMBERSHIP_ONLY } from '../../lib/products.js';
import {
  getClient, issueCode, siteUrl, resourceUrl, SCOPE,
  pendingCookie, clearPendingCookie, readPending
} from '../../lib/oauth.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams;

  // Coming back from signing in, the query string is gone - it was parked in a
  // cookie rather than carried through the sign-in redirect.
  const parked = q.get('client_id') ? null : readPending(req);
  const p = parked || {
    clientId: q.get('client_id') || '',
    redirectUri: q.get('redirect_uri') || '',
    state: q.get('state') || '',
    codeChallenge: q.get('code_challenge') || '',
    challengeMethod: q.get('code_challenge_method') || '',
    scope: q.get('scope') || '',
    responseType: q.get('response_type') || '',
    resource: q.get('resource') || ''
  };

  try {
    /* ---- 1. the client, before anything is sent anywhere ---- */
    if (!p.clientId) return page(res, 400, errorHtml('Something is missing',
      'This link did not arrive with an application to authorize. Start again from your Claude app.'));

    const client = await getClient(p.clientId);
    if (!client) return page(res, 400, errorHtml('Unknown application',
      'We do not recognise the application asking for access. Try removing the connector in Claude and adding it again.'));

    if (!p.redirectUri || !client.redirectUris.includes(p.redirectUri)) {
      return page(res, 400, errorHtml('That return address is not registered',
        'The application asked us to send you somewhere it never registered, so we have stopped here.'));
    }

    // From here the redirect URI is one the client registered, so errors can be
    // handed back to it in the way the spec expects.
    const back = (error, description) => {
      const to = new URL(p.redirectUri);
      to.searchParams.set('error', error);
      if (description) to.searchParams.set('error_description', description);
      if (p.state) to.searchParams.set('state', p.state);
      to.searchParams.set('iss', siteUrl());
      res.statusCode = 302;
      res.setHeader('Location', to.toString());
      return res.end();
    };

    /* ---- 2. the request itself ---- */
    if (p.responseType !== 'code') return back('unsupported_response_type', 'only response_type=code is supported');
    if (p.challengeMethod !== 'S256') return back('invalid_request', 'code_challenge_method must be S256');
    if (!p.codeChallenge || p.codeChallenge.length < 43) return back('invalid_request', 'a S256 code_challenge is required');
    // RFC 8707: a token is for one resource. If they name one, it has to be us.
    if (p.resource && !sameResource(p.resource, resourceUrl())) {
      return back('invalid_target', 'this authorization server does not issue tokens for that resource');
    }

    /* ---- 3. who is asking ---- */
    const session = await currentSession(req);
    if (!session) {
      // Park the request and send them to sign in. The sign-in flow only ever
      // learns a destination key, never a URL, so it stays unable to redirect
      // anywhere it was told to from outside.
      res.setHeader('Set-Cookie', pendingCookie(p));
      res.statusCode = 302;
      res.setHeader('Location', '/members/login.html?next=connect');
      return res.end();
    }

    const customer = await getCustomer(session.email);
    if (!customer || customer.status !== 'active') {
      return page(res, 403, errorHtml('This account is not active',
        'Your access is not active, so there is nothing to connect yet. If you were recently refunded that is expected.'));
    }

    /* ---- 4. the membership gate ---- */
    const entitlements = await entitlementsFor(session.email);
    if (!entitlements.has(MEMBERSHIP_ONLY)) {
      return page(res, 403, joinHtml(session.email));
    }

    /* ---- 5. ask ---- */
    if (req.method === 'POST') {
      // Only a request that carried our own cookie gets this far: the cookie is
      // SameSite=Lax, which a browser will not attach to a cross-site POST, so
      // a form on somebody else's page cannot approve this on their behalf.
      if (!parked) return page(res, 400, errorHtml('That took too long',
        'This approval expired. Start again from your Claude app.'));

      const body = parseForm(req.body);
      if (body.decision !== 'allow') return back('access_denied', 'the member declined');

      const code = await issueCode({
        clientId: client.clientId,
        email: session.email,
        epoch: session.epoch,
        redirectUri: p.redirectUri,
        codeChallenge: p.codeChallenge,
        resource: p.resource || resourceUrl()
      });

      const to = new URL(p.redirectUri);
      to.searchParams.set('code', code);
      if (p.state) to.searchParams.set('state', p.state);
      // RFC 9207: lets the client prove the code came from the issuer it asked.
      to.searchParams.set('iss', siteUrl());
      res.statusCode = 302;
      res.setHeader('Set-Cookie', clearPendingCookie());
      res.setHeader('Location', to.toString());
      return res.end();
    }

    res.setHeader('Set-Cookie', pendingCookie(p));
    return page(res, 200, consentHtml({ client, email: session.email }));
  } catch (err) {
    console.error('[oauth/authorize]', err);
    return page(res, 500, errorHtml('Something went wrong',
      'We could not finish setting this up. Please try again in a moment.'));
  }
}

/** Compares two resource identifiers, ignoring a trailing slash. */
function sameResource(a, b) {
  const trim = (s) => String(s || '').replace(/\/+$/, '').toLowerCase();
  return trim(a) === trim(b);
}

function parseForm(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  return Object.fromEntries(new URLSearchParams(String(body)));
}

function page(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(html);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- the pages ---------------- */

const SHELL = (title, body) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} — AI Founder University</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0b;--bg-2:#111113;--bg-3:#161619;--bg-4:#1c1c20;
  --line:#242429;--line-2:#33333a;--txt:#f4f4f5;--txt-2:#a1a1aa;--txt-3:#71717a;
  --accent:#ff7a1a;--accent-2:#ffb020;--green:#34d399;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--txt);min-height:100vh;display:grid;place-items:center;
  padding:28px 18px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
.card{width:min(460px,100%);background:var(--bg-2);border:1px solid var(--line);border-radius:18px;padding:28px}
.logo{width:168px;max-width:52vw;height:auto;display:block;margin:0 auto 22px}
h1{font-size:1.28rem;font-weight:800;letter-spacing:-.02em;margin:0 0 8px;text-align:center}
p{color:var(--txt-2);font-size:.93rem;line-height:1.6;margin:0 0 14px}
.who{font-family:var(--mono);font-size:.82rem;color:var(--txt-3);text-align:center;margin:0 0 20px}
.who b{color:var(--txt-2);font-weight:500}
.grants{list-style:none;margin:0 0 20px;padding:16px 18px;background:var(--bg-3);
  border:1px solid var(--line);border-radius:13px;display:grid;gap:11px}
.grants li{display:flex;gap:11px;align-items:flex-start;font-size:.9rem;line-height:1.5;color:var(--txt-2)}
.grants .ic{flex:none;width:19px;color:var(--accent-2);font-size:.95rem;line-height:1.45}
.grants .no .ic{color:var(--txt-3)}
.note{display:flex;gap:9px;align-items:flex-start;font-size:.82rem;color:var(--txt-3);
  line-height:1.55;margin:0 0 22px}
.btn{display:block;width:100%;text-align:center;text-decoration:none;cursor:pointer;
  font:800 1rem/1 Inter,sans-serif;border:0;border-radius:12px;padding:16px;
  background:linear-gradient(180deg,var(--accent-2),var(--accent));color:#1a0d00}
.btn:hover{filter:brightness(1.06)}
.btn.quiet{background:none;border:1px solid var(--line-2);color:var(--txt-2);font-weight:600;margin-top:9px}
.btn.quiet:hover{border-color:var(--line-2);color:var(--txt);filter:none}
.app{font-family:var(--mono);color:var(--accent-2)}
@media(max-width:480px){.card{padding:22px 18px}}
</style></head>
<body><div class="card">
<img class="logo" src="/assets/logo.webp" alt="AI Founder University" width="720" height="139">
${body}
</div></body></html>`;

function consentHtml({ client, email }) {
  const name = client.name && client.name.trim() ? client.name.trim() : 'An application';
  return SHELL('Connect', `
  <h1>Connect <span class="app">${esc(name)}</span> to your library?</h1>
  <p class="who">Signed in as <b>${esc(email)}</b></p>
  <ul class="grants">
    <li><span class="ic">✓</span><span>Search and read everything your membership opens — prompts, templates, skills, tutorials and courses.</span></li>
    <li class="no"><span class="ic">✕</span><span>It cannot change, add or delete anything.</span></li>
    <li class="no"><span class="ic">✕</span><span>It cannot see your payment details or any other member's content.</span></li>
  </ul>
  <p class="note"><span>🛈</span><span>Access follows your membership. Cancel, and the connector stops opening membership content on its next request.</span></p>
  <form method="post">
    <button class="btn" type="submit" name="decision" value="allow">Allow access</button>
    <button class="btn quiet" type="submit" name="decision" value="deny">Cancel</button>
  </form>`);
}

function joinHtml(email) {
  return SHELL('Membership needed', `
  <h1>Connecting to Claude is a membership perk</h1>
  <p class="who">Signed in as <b>${esc(email)}</b></p>
  <p>Everything you bought stays yours and is always in your member area. Pulling your library straight into Claude comes with the AI Founder University membership.</p>
  <a class="btn" href="/members/join.html">See what the membership opens</a>
  <a class="btn quiet" href="/members/">Back to your library</a>`);
}

function errorHtml(title, message) {
  return SHELL(title, `
  <h1>${esc(title)}</h1>
  <p style="text-align:center">${esc(message)}</p>
  <a class="btn quiet" href="/members/">Back to your library</a>`);
}
