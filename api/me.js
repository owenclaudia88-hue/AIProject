import { readSessionInfo } from '../lib/session.js';
import { getCustomer, displayNameFor } from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';

/**
 * GET /api/me — who is signed in, and are they still active.
 * The member pages call this on load; a 401 means "show the login prompt".
 * `name` is the display name used on comments, `hasName` whether they have set
 * one themselves (if not, the comment box asks for one on their first post).
 */
export default async function handler(req, res) {
  const session = readSessionInfo(req);
  if (!session) return res.status(401).json({ authenticated: false });
  const { email, method } = session;

  try {
    const customer = await getCustomer(email);
    if (!customer || customer.status !== 'active') {
      return res.status(403).json({ authenticated: true, active: false, email });
    }
    return res.status(200).json({
      authenticated: true,
      active: true,
      email,
      // Whether they have set a password, so the account screen offers the
      // right thing: set one, or change/remove the one they have.
      hasPassword: !!customer.password_hash,
      // How they signed in. A link session can set a new password without the
      // old one, so the account page knows not to ask for it.
      signedInWith: method,
      name: displayNameFor(email, customer.name),
      hasName: !!(customer.name && customer.name.trim()),
      isAdmin: isAdmin(email)
    });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'server' });
  }
}
