import { readSession } from '../../lib/session.js';
import { trafficStats } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/admin/traffic?days=30 — the funnel from our own records.
 *
 * Separate from /api/admin/members on purpose: that one reaches out to Stripe
 * and can be slow or fail, and the traffic numbers should still appear when it
 * does. This one only touches our own database.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const stats = await trafficStats(Number(url.searchParams.get('days')) || 30);
    return res.status(200).json(stats);
  } catch (err) {
    console.error('[admin/traffic]', err);
    return res.status(500).json({ error: 'server' });
  }
}
