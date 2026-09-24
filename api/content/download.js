import { get } from '@vercel/blob';
import { readSession } from '../../lib/session.js';
import { isActive, getContentBlobUrl, entitlementsFor } from '../../lib/db.js';

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

    // Refused rather than hidden: an add-on they have not bought returns the
    // same 404 as a key that does not exist.
    const item = await getContentBlobUrl(key, await entitlementsFor(email));
    if (!item) return res.status(404).json({ error: 'not found' });

    // Read the private blob back through the SDK (handles auth), then stream it.
    const result = await get(item.blob_url, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.error('[content/download] blob get failed', key, result && result.statusCode);
      return res.status(502).json({ error: 'file unavailable' });
    }

    // collect the web ReadableStream into a buffer (files are small)
    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks);

    const filename = (item.filename || key.split('/').pop() || 'download').replace(/"/g, '');
    res.setHeader('Content-Type', result.blob?.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).end(buf);
  } catch (err) {
    console.error('[content/download]', err);
    return res.status(500).json({ error: 'server' });
  }
}
