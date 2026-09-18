import { readSession } from '../lib/session.js';
import { getCustomer } from '../lib/db.js';

/**
 * GET /api/me — who is signed in, and are they still active.
 * The member pages call this on load; a 401 means "show the login prompt".
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ authenticated: false });

  try {
    const customer = await getCustomer(email);
    if (!customer || customer.status !== 'active') {
      return res.status(403).json({ authenticated: true, active: false, email });
    }
    return res.status(200).json({ authenticated: true, active: true, email });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'server' });
  }
}
