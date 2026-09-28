import crypto from 'node:crypto';

/**
 * Stateless signed-cookie sessions. A session is `email.expiry.method.signature`,
 * where signature is HMAC-SHA256 of everything before it with SESSION_SECRET. No
 * DB lookup is needed to validate a request — tampering breaks the signature.
 *
 * `method` records how the session was established: 'link' for an emailed
 * sign-in link, 'pw' for a password. It matters in one place — changing a
 * password. A link proves the person holds the inbox, which is what a password
 * reset is; a password session proves only that this browser knew the password,
 * so replacing it has to prove the old one. Cookies issued before this field
 * existed have three parts and are read as 'link', which is what they were:
 * the emailed link was the only way in.
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

export function createSessionCookie(email, method = 'link') {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const how = method === 'pw' ? 'pw' : 'link';
  const payload = `${b64(email)}.${exp}.${how}`;
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

/**
 * The signed-in email and how they signed in, or null. Verifies signature and
 * expiry. Four parts is the current format; three is a cookie issued before
 * `method` existed, when the emailed link was the only way in.
 */
export function readSessionInfo(req) {
  try {
    const cookie = req.headers?.cookie || '';
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    if (!m) return null;
    const parts = m[1].split('.');
    if (parts.length !== 3 && parts.length !== 4) return null;

    const sig = parts[parts.length - 1];
    const payload = parts.slice(0, -1).join('.');
    const emailB64 = parts[0];
    const exp = parts[1];
    const method = parts.length === 4 ? parts[2] : 'link';

    const expected = sign(payload);
    if (sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    if (Number(exp) * 1000 < Date.now()) return null;
    return { email: unb64(emailB64), method: method === 'pw' ? 'pw' : 'link' };
  } catch {
    return null;
  }
}

/** Just the email, for the many callers that do not care how it was set. */
export function readSession(req) {
  return readSessionInfo(req)?.email ?? null;
}
