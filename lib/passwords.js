import crypto from 'node:crypto';

/**
 * Optional passwords for the member area.
 *
 * The magic link stays the way in for everyone; a password is a convenience
 * members can add so they are not waiting on an email every time. It is only
 * ever set from inside a signed-in session, so proving control of the inbox
 * still comes first, and the magic link doubles as the reset flow — there is
 * no separate "forgot password" path to get wrong.
 *
 * scrypt from node:crypto rather than bcrypt or argon2: it is memory-hard,
 * it is in the standard library, and a serverless deploy with no native
 * modules to build is one less thing that breaks on a platform upgrade.
 */

// ~64MB and around a tenth of a second per hash. Sign-in is not a hot path
// here, so the work factor is set for the attacker's benefit, not ours. The
// parameters travel with each hash, so raising them later leaves every
// existing password working.
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 160 * 1024 * 1024;  // scrypt refuses these parameters under the 32MB default

export const MIN_LENGTH = 10;

/** A complaint about the password, or null if it will do. */
export function passwordProblem(password) {
  const pw = String(password ?? '');
  if (pw.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (pw.length > 200) return 'That is longer than 200 characters.';
  if (!/[^\s]/.test(pw)) return 'Use something other than spaces.';
  if (/^(.)\1+$/.test(pw)) return 'That is the same character repeated.';
  // The handful that show up in every breach list. Not a dictionary check —
  // the length rule does most of the work — just the ones worth refusing.
  const lazy = new Set([
    'password', 'password1', 'password123', '1234567890', '12345678901',
    'qwertyuiop', 'letmein123', 'iloveyou12', 'aifounderu', 'adminadmin'
  ]);
  if (lazy.has(pw.toLowerCase())) return 'That password is too easy to guess.';
  return null;
}

function derive(password, salt, n = N, r = R, p = P) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** "scrypt$N$r$p$salt$hash" — the parameters travel with the hash. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/**
 * Check a password against a stored hash. Returns false for anything it cannot
 * parse rather than throwing, so a malformed row is a failed sign-in and not a
 * 500 that tells an attacker something.
 */
export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const key = await derive(password, salt, Number(n), Number(r), Number(p));
    if (key.length !== expected.length) return false;
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/**
 * Spend the same time on an address with no password as on one that has a
 * password and got it wrong. Without this, the response time says whether an
 * account exists, which is the thing the identical error messages are for.
 */
export async function dummyVerify() {
  try {
    await derive('not-a-real-password', crypto.randomBytes(16));
  } catch { /* the delay is the point; failing to produce it is not fatal */ }
  return false;
}
