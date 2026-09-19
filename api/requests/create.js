import { readSession } from '../../lib/session.js';
import { isActive, createRequest } from '../../lib/db.js';

/** POST /api/requests/create  { title, body } — a member asks for content. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 100) : '';
    const body = typeof b.body === 'string' ? b.body.trim().slice(0, 1000) : '';
    if (!title) return res.status(400).json({ error: 'a title is required' });

    const row = await createRequest(email, { title, body });
    return res.status(200).json({ request: { id: Number(row.id), title: row.title, body: row.body, status: row.status, createdAt: row.created_at } });
  } catch (err) {
    console.error('[requests/create]', err);
    return res.status(500).json({ error: 'server' });
  }
}
