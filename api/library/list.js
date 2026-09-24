import { readSession } from '../../lib/session.js';
import { isActive, listLibrary, entitlementsFor } from '../../lib/db.js';

/**
 * GET /api/library/list[?kind=]  — the browsable catalog (titles/metadata only,
 * no bodies). Active members only. Grouped by kind, then by course/category.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const kind = new URL(req.url, 'http://localhost').searchParams.get('kind') || undefined;
    // Add-ons the member owns. Anything sold separately stays out of the
    // catalogue until they have bought it.
    const rows = await listLibrary(kind, await entitlementsFor(email));
    const groups = {};
    for (const r of rows) {
      (groups[r.kind] ||= []).push({
        id: r.id, title: r.title, course: r.course, category: r.category,
        description: r.description, tags: r.tags || [],
        createdAt: r.source_created_at, likes: r.likes ?? 0,
        thumb: r.thumb_key ? `/api/library/asset?key=${encodeURIComponent(r.thumb_key)}` : null
      });
    }
    return res.status(200).json({ groups });
  } catch (err) {
    console.error('[library/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
