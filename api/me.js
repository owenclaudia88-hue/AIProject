import { currentSession } from '../lib/session.js';
import { getCustomer, displayNameFor, entitlementsFor } from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';
import { isTester } from '../lib/testers.js';
import { reportsOpenTo } from '../lib/report-access.js';
import { MEMBERSHIP_ONLY } from '../lib/products.js';

/**
 * GET /api/me — who is signed in, and are they still active.
 * The member pages call this on load; a 401 means "show the login prompt".
 * `name` is the display name used on comments, `hasName` whether they have set
 * one themselves (if not, the comment box asks for one on their first post).
 */
export default async function handler(req, res) {
  const session = await currentSession(req);
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
      isAdmin: isAdmin(email),
      // Course features still being built show only for this account. Every
      // other member sees the member area exactly as it was.
      isTester: isTester(email),
      // Whether the weekly reports exist for this member at all. Not whether
      // they can read one - that is hasMembership below, and somebody without
      // it gets the section with a lock on it rather than no section.
      canSeeReports: reportsOpenTo(email),
      // Their own picture, for the account card in the sidebar. The path rather
      // than the storage address: the photo is private and served through us.
      photoUrl: customer.photo_url ? '/api/account/photo' : null,
      // Whether they are subscribed, which is what the member area reads to
      // decide between a perk and a lock.
      hasMembership: (await entitlementsFor(email)).has(MEMBERSHIP_ONLY)
    });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'server' });
  }
}
