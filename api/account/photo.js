import { get } from '@vercel/blob';
import { sessionEmail } from '../../lib/session.js';
import { getCustomer, profileFor } from '../../lib/db.js';

/**
 * GET /api/account/photo        — the signed-in member's own photo
 * GET /api/account/photo?of=…   — another member's, for their comments
 *
 * The photo lives in the private Blob store, so its real address never reaches
 * a browser. This serves the bytes to somebody with a session and nobody else,
 * the same arrangement library images already use.
 *
 * No membership check: a lapsed member still has a face, and their old comments
 * should not turn into broken images the day their card expires.
 */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    const of = new URL(req.url, 'http://localhost').searchParams.get('of');
    // `of` names whose photo to serve. It is only ever an email that already
    // appears on a comment this member can read, and nothing but the photo is
    // returned for it — no name, no status, nothing else about that account.
    const owner = of ? String(of).slice(0, 320) : email;

    const customer = await getCustomer(owner);
    const url = customer?.photo_url;
    if (!url) return res.status(404).json({ error: 'no photo' });

    const result = await get(url, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(502).json({ error: 'unavailable' });
    }

    const chunks = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks);

    res.setHeader('Content-Type', result.blob?.contentType || 'image/jpeg');
    res.setHeader('Content-Length', String(buf.length));
    // Private: this is one member's picture served to another, and a shared
    // cache holding it would hand it to people without a session.
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).end(buf);
  } catch (err) {
    console.error('[account/photo]', err);
    return res.status(500).json({ error: 'server' });
  }
}
