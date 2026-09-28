import { readSession } from '../../lib/session.js';
import { isActive, setPasswordHash, clearPasswordHash, passwordHashFor } from '../../lib/db.js';
import { hashPassword, verifyPassword, passwordProblem } from '../../lib/passwords.js';

/**
 * POST /api/auth/set-password  { password }  |  { remove: true }
 *
 * Only from inside a signed-in session, which means the member already proved
 * they hold the inbox — by clicking a magic link, or by knowing the password
 * they are now changing. That is why there is no emailed reset flow: the magic
 * link already is one.
 *
 * Changing an existing password requires the current one. A session left open
 * on a borrowed laptop should not be enough to lock the owner out of their own
 * account.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'Sign in first.' });

  try {
    if (!(await isActive(email))) {
      return res.status(403).json({ error: 'This account is not active.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const existing = await passwordHashFor(email);

    // Replacing or removing a password needs the current one.
    if (existing) {
      const current = String(body.currentPassword ?? '');
      if (!current || !(await verifyPassword(current, existing))) {
        return res.status(401).json({ error: 'That is not your current password.' });
      }
    }

    if (body.remove === true) {
      await clearPasswordHash(email);
      return res.status(200).json({
        ok: true, hasPassword: false,
        message: 'Password removed. Sign in with the emailed link from now on.'
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
    return res.status(200).json({
      ok: true, hasPassword: true,
      message: existing ? 'Password changed.' : 'Password set. You can sign in with it from now on.'
    });
  } catch (err) {
    console.error('[set-password]', err);
    return res.status(500).json({ error: 'Could not save that. Please try again.' });
  }
}
