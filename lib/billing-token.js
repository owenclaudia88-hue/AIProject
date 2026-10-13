import crypto from 'node:crypto';

/**
 * A link that opens somebody's billing without asking them to sign in.
 *
 * A payment reminder is read when it is read — tomorrow, on a phone, a week
 * later — so the fifteen minutes a sign-in link lasts is useless here. These
 * last a fortnight, which is the length of Stripe's retry run and therefore
 * exactly as long as the email it travels in is worth acting on.
 *
 * What makes a long life acceptable is how little it can do. It is not a
 * session: it cannot open the member area, read the library or the community,
 * change a password, or be exchanged for a cookie. It carries one permission,
 * named in the token and checked on use — open this customer's Stripe billing
 * portal, or take the offer that was made to them — and Stripe's own portal
 * then handles the card, where we never see the number.
 *
 * Signed with SESSION_SECRET and self-describing, so nothing has to be stored
 * and a token cannot be moved from one purpose to the other: the purpose is
 * inside the signature.
 */

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const sign = (payload) =>
  crypto.createHmac('sha256', secret()).update('billing:' + payload).digest('base64url');

export const BILLING_PURPOSES = new Set(['portal', 'offer']);

/** @param {'portal'|'offer'} purpose */
export function billingToken(email, purpose, days = 14) {
  if (!BILLING_PURPOSES.has(purpose)) throw new Error(`unknown billing purpose: ${purpose}`);
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const payload = b64(JSON.stringify({
    e: String(email).trim().toLowerCase(), p: purpose, x: exp
  }));
  return `${payload}.${sign(payload)}`;
}

/**
 * The address and purpose a token stands for, or null.
 *
 * Returns null for anything not signed by us, anything past its expiry, and
 * anything whose purpose is not one we issue — a token is only ever good for
 * the one thing it was made for.
 */
export function readBillingToken(token, expect = null) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;

  const good = sign(payload);
  // Constant-time, and a length check first because timingSafeEqual throws on
  // a mismatch rather than returning false.
  if (sig.length !== good.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;

  let body;
  try { body = JSON.parse(unb64(payload)); } catch { return null; }

  if (!body?.e || !BILLING_PURPOSES.has(body.p)) return null;
  if (!(Number(body.x) > Math.floor(Date.now() / 1000))) return null;
  if (expect && body.p !== expect) return null;

  return { email: body.e, purpose: body.p, expires: new Date(body.x * 1000) };
}

export function billingUrl(email, purpose, days = 14) {
  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  const path = purpose === 'offer' ? '/api/billing/offer' : '/api/billing/update';
  return `${site}${path}?t=${encodeURIComponent(billingToken(email, purpose, days))}`;
}
