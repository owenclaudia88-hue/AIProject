import { get } from '@vercel/blob';
import { COVER_PREFIX } from '../lib/report-cover.js';

/**
 * GET /api/report-cover?key=reports/cover-… — streams a report cover.
 *
 * The one endpoint in this project that serves a private blob to anybody with
 * the link, and the reason is the Monday email: an email client fetches images
 * with no cookies, so a gated cover is a broken image in every inbox. A cover
 * is abstract artwork with the report's own title on it, so the link is the
 * only secret, and the blob's random suffix makes it unguessable.
 *
 * What it will not do is serve anything else. The key has to look exactly like
 * a cover path, or this is a hole straight through the gate on every lesson
 * video and every paid download in the same store.
 */
const KEY = new RegExp(`^${COVER_PREFIX}[A-Za-z0-9._-]{1,120}$`);

export default async function handler(req, res) {
  try {
    const key = new URL(req.url, 'http://localhost').searchParams.get('key') || '';
    if (!KEY.test(key)) return res.status(400).json({ error: 'bad key' });

    const result = await get(key, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(404).json({ error: 'not found' });
    }

    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks);

    res.setHeader('Content-Type', result.blob?.contentType
      || (key.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'));
    res.setHeader('Content-Length', String(buf.length));
    // A cover never changes once it is written, and the suffix is unique, so
    // this can sit in a CDN and in an inbox for a year.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Served to anybody with the link, so it is deliberately not framed or
    // sniffed into something else.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).end(buf);
  } catch (err) {
    console.error('[report-cover]', err);
    return res.status(500).json({ error: 'server' });
  }
}
