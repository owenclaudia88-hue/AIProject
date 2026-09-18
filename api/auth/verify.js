import { consumeLoginToken, isActive } from '../../lib/db.js';
import { createSessionCookie } from '../../lib/session.js';

/**
 * GET /api/auth/verify?token=…
 *
 * The link from the purchase / sign-in email. Consumes the one-time token,
 * confirms the account is still active, sets the session cookie and redirects
 * into the member area. On any failure it redirects to the login page with a
 * reason, rather than showing a bare error.
 */
export default async function handler(req, res) {
  const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
  const login = `${site}/members/login.html`;

  const redirect = (to) => { res.statusCode = 302; res.setHeader('Location', to); res.end(); };

  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return redirect(`${login}?error=missing`);

    const email = await consumeLoginToken(token);
    if (!email) return redirect(`${login}?error=expired`);

    if (!(await isActive(email))) return redirect(`${login}?error=inactive`);

    res.setHeader('Set-Cookie', createSessionCookie(email));
    return redirect(`${site}/members/`);
  } catch (err) {
    console.error('[verify]', err);
    return redirect(`${login}?error=server`);
  }
}
