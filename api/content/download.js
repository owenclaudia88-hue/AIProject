import { readSession } from '../../lib/session.js';
import { isActive, getContentBlobUrl } from '../../lib/db.js';

/**
 * GET /api/content/download?key=…
 *
 * Gated file download. Confirms an active session, looks up the item's private
 * Blob URL server-side, fetches it and streams the bytes back with a
 * Content-Disposition so the browser saves it. The Blob URL is never exposed to
 * the client, so downloads can't be hotlinked or shared.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const url = new URL(req.url, 'http://localhost');
    const key = url.searchParams.get('key');
    if (!key) return res.status(400).json({ error: 'missing key' });

    const item = await getContentBlobUrl(key);
    if (!item) return res.status(404).json({ error: 'not found' });

    const upstream = await fetch(item.blob_url);
    if (!upstream.ok) {
      console.error('[content/download] blob fetch failed', upstream.status, key);
      return res.status(502).json({ error: 'file unavailable' });
    }

    const filename = (item.filename || key.split('/').pop() || 'download').replace(/"/g, '');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Cache-Control', 'private, no-store');

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).end(buf);
  } catch (err) {
    console.error('[content/download]', err);
    return res.status(500).json({ error: 'server' });
  }
}
