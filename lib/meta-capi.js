import crypto from 'node:crypto';

/**
 * Meta Conversions API — server to server, no browser pixel.
 *
 * Same shape as the discount-nation project's lib/meta-capi.ts: the same nine
 * user_data parameters, hashed the same way, posted to the same endpoint
 * shape. Events are sent from the server only, so an ad blocker or a closed
 * tab cannot lose one, and the Purchase is fired from the Stripe webhook —
 * the only place that actually knows the money arrived.
 *
 *   PageView          — landing and checkout pages, via /api/track
 *   InitiateCheckout  — when the checkout form is started, via /api/track
 *   Purchase          — from the Stripe webhook on payment_intent.succeeded
 *
 * Needs META_PIXEL_ID and META_CAPI_TOKEN. Unlike the other project this has
 * no hard-coded pixel fallback: sending this site's events into another
 * project's pixel by accident is worse than sending none, so with no pixel
 * configured it simply does nothing.
 */

const API_VERSION = 'v25.0';

const config = () => ({
  pixelId: process.env.META_PIXEL_ID || '',
  token: process.env.META_CAPI_TOKEN || '',
  base: (process.env.META_CAPI_BASE || 'https://graph.facebook.com').replace(/\/+$/, ''),
  // Set while wiring up to make events show in Events Manager → Test events
  // without them counting as real conversions. Leave unset in normal use.
  testEventCode: process.env.META_TEST_EVENT_CODE || ''
});

/* ---------------- Meta's normalisation rules ---------------- */

const normalizeName = (s) => String(s).trim().toLowerCase().replace(/[^\p{L}]/gu, '');
const normalizeZip = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeCountry = (s) => String(s).trim().toLowerCase().slice(0, 2);

const sha256Hex = (input) => crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');

/**
 * Everything Meta can match a person on, hashed. Raw values never leave here:
 * the email, name, city and postcode are all SHA-256'd first, and only the IP
 * and user agent go out in the clear, which is what Meta expects.
 */
function buildUserData(p) {
  const userData = {};
  if (p.ip) userData.client_ip_address = p.ip;
  if (p.ua) userData.client_user_agent = p.ua;
  if (p.email) userData.em = [sha256Hex(String(p.email).trim().toLowerCase())];

  if (p.firstName) { const n = normalizeName(p.firstName); if (n) userData.fn = [sha256Hex(n)]; }
  if (p.lastName)  { const n = normalizeName(p.lastName);  if (n) userData.ln = [sha256Hex(n)]; }
  if (p.city)      { const n = normalizeName(p.city);      if (n) userData.ct = [sha256Hex(n)]; }
  if (p.zip)       { const n = normalizeZip(p.zip);        if (n) userData.zp = [sha256Hex(n)]; }
  if (p.country)   { const n = normalizeCountry(p.country); if (n) userData.country = [sha256Hex(n)]; }

  // The click id Meta attributes the conversion to, in the fbc format it
  // expects. Without it a conversion still matches on hashed email + IP + UA,
  // just less reliably.
  //
  // The middle field is when the click happened, not when we got round to
  // reporting it. A purchase can land days after the ad was clicked, and
  // stamping it with the send time tells Meta the click was far more recent
  // than it was.
  if (p.fbclid) {
    const clickedAt = Number(p.fbclidAt) > 0 ? Math.round(Number(p.fbclidAt)) : Date.now();
    userData.fbc = `fb.1.${clickedAt}.${p.fbclid}`;
  }
  if (p.fbp) userData.fbp = p.fbp;

  return userData;
}

/** What was bought — the same tags on every event so the dashboards line up. */
const PRODUCT = {
  content_name: '70 AI Specialists for Claude',
  content_category: 'digital-product',
  content_ids: ['70-ai-specialists-for-claude'],
  content_type: 'product'
};

const priceCurrency = () => (process.env.PRICE_CURRENCY || 'usd').toUpperCase();

/**
 * Post one event.
 *
 * `eventId` should be stable for anything that can be delivered more than
 * once — the Stripe webhook retries, and Meta de-duplicates on event_id, so
 * passing the PaymentIntent id there is what stops one sale being counted
 * twice.
 */
async function send(eventName, p = {}, customData = {}, eventId) {
  const { pixelId, token, base, testEventCode } = config();
  if (!pixelId || !token) {
    console.warn(`[meta-capi] ${eventName} skipped: META_PIXEL_ID / META_CAPI_TOKEN not set`);
    return { skipped: 'not configured' };
  }
  if (!p.sourceUrl) {
    console.warn(`[meta-capi] ${eventName} skipped: no sourceUrl`);
    return { skipped: 'no sourceUrl' };
  }

  const body = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || crypto.randomUUID(),
      event_source_url: p.sourceUrl,
      action_source: 'website',
      user_data: buildUserData(p),
      custom_data: customData
    }],
    ...(testEventCode ? { test_event_code: testEventCode } : {})
  };

  const endpoint = `${base}/${API_VERSION}/${pixelId}/events`;
  try {
    const res = await fetch(`${endpoint}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[meta-capi] ${eventName} HTTP ${res.status}:`, text);
      return { ok: false, status: res.status, body: text };
    }
    console.log(`[meta-capi] ${eventName} ok:`, text);
    return { ok: true, body: text };
  } catch (err) {
    // Tracking must never take the page or the webhook down with it.
    console.error(`[meta-capi] ${eventName} fetch threw:`, err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

export const sendPageView = (p) => send('PageView', p, { ...PRODUCT });

export const sendInitiateCheckout = (p) =>
  send('InitiateCheckout', p, {
    currency: priceCurrency(),
    value: Number.parseInt(process.env.PRICE_AMOUNT ?? '100', 10) / 100,
    ...PRODUCT
  });

/** Fired from the Stripe webhook, with the real amount that was charged. */
export const sendPurchase = (p, { amount, currency, eventId } = {}) =>
  send('Purchase', p, {
    currency: (currency || priceCurrency()).toUpperCase(),
    value: (amount ?? 100) / 100,
    ...PRODUCT
  }, eventId);

/** Used by /api/track to reject anything not on the allowlist. */
export const CLIENT_EVENTS = { PageView: sendPageView, InitiateCheckout: sendInitiateCheckout };
