import { consumeLoginToken, isActive, sessionEpochFor } from '../../lib/db.js';
import { createSessionCookie } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { destinationFor } from '../../lib/destinations.js';

/**
 * GET /api/auth/verify?token=…
 *
 * The link from the purchase / sign-in email. Consumes the one-time token,
 * confirms the account is still active, sets the session cookie and redirects
 * into the member area — or, for staff, into the admin dashboard, which they
 * reach without ever having bought anything. On any failure it redirects to
 * the login page with a reason, rather than showing a bare error.
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

    // Staff sign in on their own account, which is not a customer account and
    // has no purchase behind it.
    const staff = isAdmin(email);
    if (!staff && !(await isActive(email))) return redirect(`${login}?error=inactive`);

    // Marked as a link session: this person just proved they hold the inbox,
    // so they may set a new password without knowing the old one.
    res.setHeader('Set-Cookie', createSessionCookie(email, 'link', await sessionEpochFor(email)));
    // Send staff where they were going. An admin who also bought the product
    // still lands in the member area, since they have a member area to land in.
    if (staff && !(await isActive(email))) return redirect(`${site}/members/admin.html`);
    // A link built for a particular page — a password reset — goes there. The
    // path comes from our own list, never from the query string.
    const wanted = destinationFor(url.searchParams.get('next'));
    return redirect(`${site}${wanted || '/members/'}`);
  } catch (err) {
    console.error('[verify]', err);
    return redirect(`${login}?error=server`);
  }
}
