import { readSession } from '../../lib/session.js';
import { isActive, lessonVideoId } from '../../lib/db.js';
import { signedVideoUrl, signedThumbUrl, bunnyConfig } from '../../lib/bunny.js';

/**
 * GET /api/video/sign?lesson=<libId>
 *
 * Hands an active member a short-lived signed HLS URL for that lesson's video.
 * The Bunny video id and the token key both stay on the server; the browser
 * only ever sees a URL that stops working a few hours later, so a link copied
 * out of devtools is no use to anyone outside the membership.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const params = new URL(req.url, 'http://localhost').searchParams;
    const lesson = params.get('lesson');
    if (!lesson) return res.status(400).json({ error: 'missing lesson' });

    const { host } = bunnyConfig();
    if (!host) return res.status(503).json({ error: 'video not configured' });

    const videoId = await lessonVideoId(lesson);
    // Not every lesson has a video — the prompt-vault ones are text only.
    if (!videoId) return res.status(404).json({ error: 'no video' });

    const ttl = 4 * 3600;
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      url: signedVideoUrl(videoId, 'playlist.m3u8', ttl),
      poster: signedThumbUrl(videoId, ttl),
      expiresIn: ttl
    });
  } catch (err) {
    console.error('[video/sign]', err);
    return res.status(500).json({ error: 'server' });
  }
}
