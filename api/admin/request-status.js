import { readSession } from '../../lib/session.js';
import { isActive, setRequestStatus } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

const ALLOWED = ['new', 'planned', 'done', 'declined'];

/** POST /api/admin/request-status  { id, status } — staff only. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });
    if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const id = Number(b.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'missing id' });
    if (!ALLOWED.includes(b.status)) return res.status(400).json({ error: 'bad status' });

    await setRequestStatus(id, b.status);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/request-status]', err);
    return res.status(500).json({ error: 'server' });
  }
}
