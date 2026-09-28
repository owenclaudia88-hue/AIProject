import { currentSession, createSessionCookie } from '../../lib/session.js';
import { isActive, setPasswordHash, clearPasswordHash, passwordHashFor, bumpSessionEpoch } from '../../lib/db.js';
import { hashPassword, verifyPassword, passwordProblem } from '../../lib/passwords.js';

/**
 * POST /api/auth/set-password  { password }  |  { remove: true }
 *
 * Only from inside a signed-in session. How that session was established is
 * what decides whether the current password is needed:
 *
 *   - signed in by emailed link — they hold the inbox, which is a stronger
 *     claim than knowing the password. This is the reset path, and it is why
 *     there is no separate emailed reset flow to get wrong.
 *   - signed in by password — proves only that this browser knew the password.
 *     Replacing it has to prove the old one, or a session left open on a
 *     borrowed laptop is enough to take the account over.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await currentSession(req);
  if (!session) return res.status(401).json({ error: 'Sign in first.' });
  const { email, method } = session;

  /* Changing the password signs out everywhere else. The epoch on the customer
     row moves on, which stops every cookie already issued — including the one
     on this device, so it is replaced before the response goes back. Otherwise
     the person changing their password would sign themselves out too. */
  const rotate = async () => {
    const epoch = await bumpSessionEpoch(email);
    res.setHeader('Set-Cookie', createSessionCookie(email, method, epoch));
  };

  try {
    if (!(await isActive(email))) {
      return res.status(403).json({ error: 'This account is not active.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const existing = await passwordHashFor(email);

    // Replacing or removing a password needs the current one — unless this
    // session came from an emailed link, in which case the inbox already
    // answered for them and this is a reset.
    if (existing && method === 'pw') {
      const current = String(body.currentPassword ?? '');
      if (!current || !(await verifyPassword(current, existing))) {
        return res.status(401).json({
          error: 'That is not your current password. Forgot it? Sign out and use the emailed sign-in link instead.'
        });
      }
    }

    if (body.remove === true) {
      await clearPasswordHash(email);
      await rotate();
      return res.status(200).json({
        ok: true, hasPassword: false, signedOutElsewhere: true,
        message: 'Password removed, and any other device is signed out. Sign in with the emailed link from now on.'
      });
    }

    const password = String(body.password ?? '');
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });

    // A password that is just the address is the most common thing people try
    // and the first thing anybody guesses.
    if (password.toLowerCase().includes(email.split('@')[0].toLowerCase()) &&
        email.split('@')[0].length >= 4) {
      return res.status(400).json({ error: 'Do not put your email address in your password.' });
    }

    await setPasswordHash(email, await hashPassword(password));
    await rotate();
    return res.status(200).json({
      ok: true, hasPassword: true, signedOutElsewhere: true,
      message: existing
        ? 'Password changed. Any other device you were signed in on has been signed out.'
        : 'Password set. You can sign in with it from now on, and any other device has been signed out.'
    });
  } catch (err) {
    console.error('[set-password]', err);
    return res.status(500).json({ error: 'Could not save that. Please try again.' });
  }
}
