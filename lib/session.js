import crypto from 'node:crypto';

/**
 * Stateless signed-cookie sessions. A session is `email.expiry.signature`,
 * where signature is HMAC-SHA256(email.expiry) with SESSION_SECRET. No DB
 * lookup is needed to validate a request — tampering breaks the signature.
 */

const COOKIE = 'afu_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set (or too short)');
  return s;
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionCookie(email) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${b64(email)}.${exp}`;
  const value = `${payload}.${sign(payload)}`;
  const attrs = [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`
  ];
  return attrs.join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Returns the signed-in email, or null. Verifies signature and expiry. */
export function readSession(req) {
  try {
    const cookie = req.headers?.cookie || '';
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    if (!m) return null;
    const parts = m[1].split('.');
    if (parts.length !== 3) return null;
    const [emailB64, exp, sig] = parts;
    const payload = `${emailB64}.${exp}`;

    const expected = sign(payload);
    if (sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    if (Number(exp) * 1000 < Date.now()) return null;
    return unb64(emailB64);
  } catch {
    return null;
  }
}
