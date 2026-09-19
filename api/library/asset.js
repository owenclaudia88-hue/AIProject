import { get } from '@vercel/blob';
import { readSession } from '../../lib/session.js';
import { isActive, getAsset } from '../../lib/db.js';

/**
 * GET /api/library/asset?key=…  — serves a library image (lesson diagram, card
 * thumbnail) inline to active members. The private Blob URL is never exposed.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const params = new URL(req.url, 'http://localhost').searchParams;
    const key = params.get('key');
    if (!key) return res.status(400).json({ error: 'missing key' });

    const asset = await getAsset(key);
    if (!asset) return res.status(404).json({ error: 'not found' });

    const result = await get(asset.blob_url, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(502).json({ error: 'unavailable' });
    }

    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks);

    res.setHeader('Content-Type', asset.content_type || result.blob?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // ?download=1 turns the same gated stream into a file save (skill .md files).
    if (params.get('download')) {
      const name = (key.split('/').pop() || 'download').replace(/[^\w.-]+/g, '-');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    }
    return res.status(200).end(buf);
  } catch (err) {
    console.error('[library/asset]', err);
    return res.status(500).json({ error: 'server' });
  }
}
