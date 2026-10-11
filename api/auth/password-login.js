import { isActive, normalizeEmail, passwordHashFor, recordAuthFailure, clearAuthFailures, recentAuthFailures, sessionEpochFor, resolveAccountEmail } from '../../lib/db.js';
import { verifyPassword, dummyVerify } from '../../lib/passwords.js';
import { createSessionCookie } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { destinationFor } from '../../lib/destinations.js';

/**
 * POST /api/auth/password-login  { email, password }
 *
 * The second way in, for members who set a password rather than waiting on an
 * email every time. The magic link is unchanged and remains the way to get back
 * in when the password is forgotten — there is no separate reset flow, which is
 * one fewer thing to attack.
 *
 * Every failure answers the same way: wrong password, no password set, no such
 * account, cancelled account. The caller learns whether these credentials work
 * and nothing else about who holds an account here.
 */

// A person mistypes a password two or three times. Fifteen tries in a quarter
// of an hour is not a person. The per-IP ceiling is much higher because a
// household, an office or a mobile network share one.
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 50;
const WINDOW_MINUTES = 15;

const SAME_ANSWER = 'That email and password do not match an account.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip'] || '';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !password) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }

    // Checked before the hash is even fetched, so a throttled caller costs
    // nothing and learns nothing.
    const fails = await recentAuthFailures(email, ip, WINDOW_MINUTES);
    if (fails.byEmail >= MAX_PER_EMAIL || fails.byIp >= MAX_PER_IP) {
      return res.status(429).json({
        error: 'Too many attempts. Wait a few minutes, or use the email sign-in link instead.',
        useLink: true
      });
    }

    /* An alternate address signs in the same way as the account's own, with
       the same password: it is a second door into one account, not a second
       account. Resolved after the throttle, which deliberately counts the
       address as typed - somebody guessing at an alternate should burn the
       alternate's budget rather than lock the real one out. */
    const account = await resolveAccountEmail(email);

    const hash = await passwordHashFor(account);

    // No account, or an account with no password: spend the same time anyway.
    // Returning early here is what turns a uniform error message into a way of
    // enumerating who has an account.
    if (!hash) {
      await dummyVerify();
      await recordAuthFailure(email, ip);
      return res.status(401).json({ error: SAME_ANSWER });
    }

    if (!(await verifyPassword(password, hash))) {
      await recordAuthFailure(email, ip);
      return res.status(401).json({ error: SAME_ANSWER });
    }

    // Right password, but the account has to still be live — the same check
    // the magic link makes, for the same reason.
    const staff = isAdmin(account);
    const active = await isActive(account);
    if (!staff && !active) {
      await recordAuthFailure(email, ip);
      return res.status(401).json({ error: SAME_ANSWER });
    }

    await clearAuthFailures(email);
    // A password session, for the account rather than for whichever of its
    // addresses was typed. Enough to use the site, not enough to replace the
    // password without proving the current one.
    res.setHeader('Set-Cookie', createSessionCookie(account, 'pw', await sessionEpochFor(account)));
    return res.status(200).json({
      ok: true,
      // Where they were headed before being asked to sign in, if it is one of
      // the handful of places a sign-in is allowed to land.
      redirect: (staff && !active)
        ? '/members/admin.html'
        : (destinationFor(req.body?.next) || '/members/')
    });
  } catch (err) {
    console.error('[password-login]', err);
    return res.status(500).json({ error: 'Could not sign you in. Please try again.' });
  }
}
