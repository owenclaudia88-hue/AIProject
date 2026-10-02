import { put, del } from '@vercel/blob';
import { sessionEmail } from '../../lib/session.js';
import { profileFor, setProfileName, setProfilePhoto } from '../../lib/db.js';

/**
 * The member's own profile.
 *
 *   GET    /api/account/profile          first name, last name, photo
 *   POST   /api/account/profile          { firstName, lastName }
 *   PUT    /api/account/profile          the photo itself, as the request body
 *   DELETE /api/account/profile          remove the photo
 *
 * No membership check: somebody whose subscription lapsed still owns their own
 * name, and locking them out of their account page would be the wrong thing to
 * take away.
 */

// A profile photo is displayed at 96px. Anything beyond a couple of megabytes
// is a photo straight off a phone, which is worth accepting once rather than
// refusing — but not a 50MB file somebody is using us to host.
const MAX_BYTES = 4 * 1024 * 1024;

// What the browser is given instead of the storage address.
const PHOTO_PATH = '/api/account/photo';

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

async function readBody(req) {
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    // Stop reading rather than buffering a file we have already decided to
    // refuse: the limit is only a limit if it is applied before the memory is.
    if (total > MAX_BYTES) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    if (req.method === 'GET') {
      const profile = await profileFor(email);
      if (!profile) return res.status(404).json({ error: 'no account' });
      // The stored value is a private storage address. What leaves here is the
      // path that serves it, with a stamp so a replaced photo is not read from
      // the browser's cache.
      return res.status(200).json({
        ...profile,
        photoUrl: profile.photoUrl ? PHOTO_PATH + '?v=' + Date.now() : null
      });
    }

    if (req.method === 'POST') {
      // The body parser is off for this route, because the photo arrives as raw
      // bytes — so the JSON has to be read and parsed here rather than assumed
      // to have been done already.
      let b = {};
      if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        b = req.body;
      } else {
        const raw = Buffer.isBuffer(req.body) ? req.body : await readBody(req);
        try { b = JSON.parse(raw.toString('utf8') || '{}'); }
        catch { return res.status(400).json({ error: 'Could not read that.' }); }
      }
      // Checked before saving, and on the first name itself: a surname alone
      // produced a non-empty display name and slipped through.
      if (!String(b.firstName || '').trim()) {
        return res.status(400).json({ error: 'Please give at least a first name.' });
      }
      const saved = await setProfileName(email, b.firstName, b.lastName);
      return res.status(200).json({ ok: true, ...saved });
    }

    if (req.method === 'PUT') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = TYPES[type];
      if (!ext) {
        return res.status(400).json({ error: 'Use a JPEG, PNG, WebP or GIF image.' });
      }

      let body;
      try { body = await readBody(req); }
      catch { return res.status(413).json({ error: 'That image is larger than 4MB.' }); }
      if (!body.length) return res.status(400).json({ error: 'No image received.' });

      const previous = (await profileFor(email))?.photoUrl || null;

      // Private. A member's face should not sit at an address anyone can
      // fetch, and the store is private in any case - it is served back
      // through /api/account/photo, which asks for a session first.
      //
      // The token is passed explicitly: left to itself the SDK reaches for
      // OIDC, which is not enabled in every environment this runs in, so the
      // call would fail only in some of them.
      const blob = await put(`avatars/${Date.now()}.${ext}`, body, {
        access: 'private',
        contentType: type,
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      await setProfilePhoto(email, blob.url);

      // The old file is of no use to anyone now. Failing to remove it must not
      // fail the upload, which has already succeeded.
      if (previous) {
        try { await del(previous, { token: process.env.BLOB_READ_WRITE_TOKEN }); }
        catch (err) { console.error('[account/profile] old photo not removed:', err.message); }
      }

      // The page gets our own path, which carries the session check with it.
      return res.status(200).json({ ok: true, photoUrl: PHOTO_PATH });
    }

    if (req.method === 'DELETE') {
      const previous = (await profileFor(email))?.photoUrl || null;
      await setProfilePhoto(email, null);
      if (previous) {
        try { await del(previous, { token: process.env.BLOB_READ_WRITE_TOKEN }); }
        catch (err) { console.error('[account/profile] photo not removed:', err.message); }
      }
      return res.status(200).json({ ok: true, photoUrl: null });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[account/profile]', err);
    return res.status(500).json({ error: 'server' });
  }
}

// The photo arrives as raw bytes, so the platform must not try to parse it.
export const config = { api: { bodyParser: false } };
