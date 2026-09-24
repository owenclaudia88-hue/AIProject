import { readSession } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { grantEntitlement, revokeEntitlement, listEntitled, normalizeEmail } from '../../lib/db.js';

/**
 * POST /api/admin/entitlement  { email, product, action: 'grant' | 'revoke' }
 * GET  /api/admin/entitlement?product=routines
 *
 * Add-ons sold on top of membership. The library is included with membership;
 * anything with a `requires` set is invisible until the member is listed here,
 * so a finished product can sit in the database while only buyers can see it.
 */
const PRODUCTS = new Set(['routines']);

export default async function handler(req, res) {
  const actor = readSession(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    if (req.method === 'GET') {
      const product = new URL(req.url, 'http://localhost').searchParams.get('product') || 'routines';
      if (!PRODUCTS.has(product)) return res.status(400).json({ error: 'unknown product' });
      return res.status(200).json({ product, members: await listEntitled(product) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = normalizeEmail(body.email || '');
    const product = String(body.product || '');
    const action = String(body.action || '');

    if (!email) return res.status(400).json({ error: 'missing email' });
    // An allowlist rather than free text: a typo would otherwise create an
    // entitlement that unlocks nothing and looks like it worked.
    if (!PRODUCTS.has(product)) return res.status(400).json({ error: 'unknown product' });

    if (action === 'grant') {
      await grantEntitlement(email, product);
      console.log(`[admin] ${actor} granted ${product} to ${email}`);
      return res.status(200).json({ ok: true, email, product, has: true });
    }
    if (action === 'revoke') {
      await revokeEntitlement(email, product);
      console.log(`[admin] ${actor} revoked ${product} from ${email}`);
      return res.status(200).json({ ok: true, email, product, has: false });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.error('[admin/entitlement]', err);
    return res.status(500).json({ error: 'server' });
  }
}
