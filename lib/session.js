import crypto from 'node:crypto';
import { sessionCheck } from './db.js';
import { isAdmin } from './admin.js';

/**
 * Stateless signed-cookie sessions. A session is `email.expiry.method.signature`,
 * where signature is HMAC-SHA256 of everything before it with SESSION_SECRET. No
 * DB lookup is needed to validate a request — tampering breaks the signature.
 *
 * The cookie also carries an epoch, matched against the customer row on every
 * authenticated request. It is what makes a stateless session revocable:
 * changing a password moves the row's number on and every cookie minted before
 * that stops matching. A cookie with no epoch is read as 1, which is where
 * every account starts, so sessions from before this existed keep working until
 * the first password change.
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

export function createSessionCookie(email, method = 'link', epoch = 1) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const how = method === 'pw' ? 'pw' : 'link';
  const n = Number.isFinite(Number(epoch)) ? Math.max(1, Math.round(Number(epoch))) : 1;
  const payload = `${b64(email)}.${exp}.${how}.${n}`;
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
    if (parts.length < 3 || parts.length > 5) return null;

    const sig = parts[parts.length - 1];
    const payload = parts.slice(0, -1).join('.');
    const emailB64 = parts[0];
    const exp = parts[1];
    const method = parts.length >= 4 ? parts[2] : 'link';
    const epoch = parts.length >= 5 ? Number(parts[3]) : 1;

    const expected = sign(payload);
    if (sig.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    if (Number(exp) * 1000 < Date.now()) return null;
    return {
      email: unb64(emailB64),
      method: method === 'pw' ? 'pw' : 'link',
      epoch: Number.isFinite(epoch) && epoch >= 1 ? epoch : 1
    };
  } catch {
    return null;
  }
}

/**
 * Signature and expiry only — no lookup, so it cannot tell whether the session
 * has since been revoked. Kept for callers that only need the address off a
 * cookie they have already checked another way.
 */
export function readSession(req) {
  return readSessionInfo(req)?.email ?? null;
}

/**
 * The signed-in address, or null — including null for a cookie that was valid
 * when it was issued and has since been revoked by a password change.
 *
 * This is what authenticated endpoints use. It costs one query, which for most
 * of them replaces the `isActive` query they were already making.
 */
export async function sessionEmail(req) {
  return (await currentSession(req))?.email ?? null;
}

/** As above, but with how they signed in, for the account screen. */
export async function currentSession(req) {
  const s = readSessionInfo(req);
  if (!s) return null;
  try {
    const row = await sessionCheck(s.email);
    // Staff sign in without ever having bought anything, so they have no
    // customer row and nothing to match against.
    if (!row) return isAdmin(s.email) ? s : null;
    if (row.epoch !== s.epoch) return null;
    return s;
  } catch (err) {
    // A database blip must not sign the whole site out. The cookie's signature
    // and expiry were already checked; this only decides whether it was revoked.
    console.error('[session] epoch check failed, accepting the cookie:', err.message);
    return s;
  }
}
