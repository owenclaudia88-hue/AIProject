import { readSession } from '../../lib/session.js';
import { isActive, listMyRequests } from '../../lib/db.js';

/** GET /api/requests/list — the signed-in member's own requests. */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });
    const rows = await listMyRequests(email);
    return res.status(200).json({
      requests: rows.map((r) => ({ id: Number(r.id), title: r.title, body: r.body, status: r.status, createdAt: r.created_at }))
    });
  } catch (err) {
    console.error('[requests/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
