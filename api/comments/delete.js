import { readSession } from '../../lib/session.js';
import { isActive, deleteComment } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * POST /api/comments/delete  { id }
 *
 * Members delete their own; admins delete anyone's. The row is soft-deleted, so
 * a question that already has an answer stays in the thread as a tombstone.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    // A member must have access to delete their own comment; an admin is
    // moderating and need not be a paying customer.
    const staff = isAdmin(email);
    if (!staff && !(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const id = Number(b.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'missing id' });

    const ok = await deleteComment(id, { email, isAdmin: staff });
    if (!ok) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('[comments/delete]', err);
    return res.status(500).json({ error: 'server' });
  }
}
