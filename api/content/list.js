import { readSession } from '../../lib/session.js';
import { isActive, listContent, entitlementsFor } from '../../lib/db.js';

/**
 * GET /api/content/list — the member library catalog.
 * Active members only. Returns titles/keys/sizes grouped by kind; never the
 * private Blob URLs (those are used only by the download stream).
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const rows = await listContent(await entitlementsFor(email));
    const groups = {};
    for (const r of rows) {
      (groups[r.kind] ||= []).push({
        key: r.key, title: r.title, filename: r.filename,
        sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null
      });
    }
    return res.status(200).json({ groups });
  } catch (err) {
    console.error('[content/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
