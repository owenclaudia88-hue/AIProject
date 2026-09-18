import { readSession } from '../../lib/session.js';
import { isActive, getLibraryItem } from '../../lib/db.js';

/** GET /api/library/item?id=…  — one item's full body, for the reader. */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const id = new URL(req.url, 'http://localhost').searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'missing id' });

    const item = await getLibraryItem(id);
    if (!item) return res.status(404).json({ error: 'not found' });

    return res.status(200).json({
      id: item.id, kind: item.kind, course: item.course, category: item.category,
      title: item.title, description: item.description, bodyHtml: item.body_html || ''
    });
  } catch (err) {
    console.error('[library/item]', err);
    return res.status(500).json({ error: 'server' });
  }
}
