import crypto from 'node:crypto';

/**
 * Microsoft Advertising Conversions API (UET CAPI) — server to server.
 *
 * The Bing twin of lib/meta-capi.js. Conversions go from our server only, so
 * an ad blocker or a closed tab cannot lose them:
 *
 *   submit_lead_form — name + email submitted on a lander, via /api/track
 *   purchase         — from the Stripe webhook on payment_intent.succeeded
 *
 * The action names must match the "Action equals" value on each conversion
 * goal in Microsoft Advertising exactly.
 *
 * Needs MS_CAPI_TOKEN. The UET tag id defaults to this site's tag and can be
 * overridden with MS_UET_TAG_ID. With no token it does nothing.
 */

const config = () => ({
  tagId: process.env.MS_UET_TAG_ID || '97272467',
  token: process.env.MS_CAPI_TOKEN || ''
});

const sha256Hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/** Microsoft's email rules: trim, drop dots and +alias from the user part, lowercase. */
function hashEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return undefined;
  const user = e.slice(0, at).split('+')[0].replace(/\./g, '');
  return user ? sha256Hex(`${user}@${e.slice(at + 1)}`) : undefined;
}

function buildUserData(p) {
  const u = {};
  if (p.msclkid) u.msclkid = String(p.msclkid).slice(0, 100);
  // The visitor id, which must be the same value the ID Sync pixel sent as VID
  // or Microsoft has nothing to tie it to.
  if (p.vid && /^[0-9a-f]{32}$/i.test(String(p.vid))) u.anonymousId = String(p.vid).toLowerCase();
  const em = p.email ? hashEmail(p.email) : undefined;
  if (em) u.em = em;
  if (p.ip) u.clientIpAddress = p.ip;
  if (p.ua) u.clientUserAgent = p.ua;
  return u;
}

async function send(eventName, p = {}, customData, eventId) {
  const { tagId, token } = config();
  if (!token) {
    console.warn(`[ms-capi] ${eventName} skipped: MS_CAPI_TOKEN not set`);
    return { skipped: 'not configured' };
  }
  const userData = buildUserData(p);
  if (!userData.msclkid && !userData.em && !userData.anonymousId) {
    return { skipped: 'no identifier' };
  }

  const body = {
    data: [{
      eventType: 'custom',
      eventId: eventId || crypto.randomUUID(),
      eventName,
      eventTime: Math.floor(Date.now() / 1000),
      ...(p.sourceUrl ? { eventSourceUrl: p.sourceUrl } : {}),
      userData,
      ...(customData ? { customData } : {})
    }]
  };

  try {
    const res = await fetch(`https://capi.uet.microsoft.com/v1/${tagId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[ms-capi] ${eventName} HTTP ${res.status}:`, text);
      return { ok: false, status: res.status, body: text };
    }
    console.log(`[ms-capi] ${eventName} ok:`, text);
    return { ok: true };
  } catch (err) {
    // Tracking must never take the page or the webhook down with it.
    console.error(`[ms-capi] ${eventName} fetch threw:`, err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Somebody handed over a name and an email. The event id is derived from the
 * address, so the same person submitting twice is one lead, not two.
 */
export const sendMsLead = (p) =>
  send('submit_lead_form', p, undefined, p.email ? `lead-${sha256Hex(String(p.email).trim().toLowerCase()).slice(0, 32)}` : undefined);

/** From the Stripe webhook, with the real amount charged. Event id = PaymentIntent, so retries de-duplicate. */
export const sendMsPurchase = (p, { amount, currency, eventId } = {}) =>
  send('purchase', p, {
    value: (amount ?? 100) / 100,
    currency: String(currency || 'usd').toUpperCase(),
    ...(eventId ? { transactionId: eventId } : {})
  }, eventId);
