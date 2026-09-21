import crypto from 'node:crypto';

/**
 * Signed unsubscribe links.
 *
 * The address is carried in the link and signed, so the page can honour it
 * without asking the person to prove anything — a one-click unsubscribe is
 * the whole point. The signature stops the link being edited into a tool for
 * opting other people out of mail they wanted.
 *
 * These do not expire. An unsubscribe link from a year-old email must still
 * work, or it is not really an unsubscribe.
 */

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const sign = (payload) => crypto.createHmac('sha256', secret()).update('unsub:' + payload).digest('base64url');

export function unsubscribeToken(email) {
  const payload = b64(String(email).trim().toLowerCase());
  return `${payload}.${sign(payload)}`;
}

/** The address a token stands for, or null if it was not signed by us. */
export function readUnsubscribeToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // Constant-time: a length mismatch would throw, so check that first.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return unb64(payload); } catch { return null; }
}

export function unsubscribeUrl(email) {
  const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
  return `${site}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email))}`;
}
