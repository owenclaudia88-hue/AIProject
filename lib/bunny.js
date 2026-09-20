/**
 * Bunny Stream — signed playback URLs.
 *
 * Lesson videos live in a Bunny Stream library and are played by our own
 * player (hls.js on a plain <video>), not Bunny's iframe. That means the
 * browser fetches the HLS playlist and then every .ts segment beside it, so a
 * token covering only the playlist would let the first request through and
 * 403 the rest. We sign the video's whole directory with `token_path`, and the
 * browser reuses the same token for the segments.
 *
 * Advanced (HMAC-SHA256) token authentication:
 *   token = base64url(HMAC-SHA256(key, signature_path + expires))
 * with `+` → `-`, `/` → `_` and `=` stripped. `signature_path` is the
 * token_path when one is given, which is how directory tokens work.
 *
 * Needs, in the environment:
 *   BUNNY_STREAM_LIBRARY_ID   the Stream library's numeric id
 *   BUNNY_STREAM_CDN_HOSTNAME e.g. vz-d8bd77b7-338.b-cdn.net
 *   BUNNY_STREAM_TOKEN_KEY    the pull zone's token authentication key
 *   BUNNY_STREAM_API_KEY      library API key — only used by the match script
 */
import { createHash, createHmac } from 'node:crypto';

export const bunnyConfig = () => ({
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID || '',
  host: (process.env.BUNNY_STREAM_CDN_HOSTNAME || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  tokenKey: process.env.BUNNY_STREAM_TOKEN_KEY || '',
  apiKey: process.env.BUNNY_STREAM_API_KEY || '',
  // Which signature the pull zone expects. Bunny documents two and the
  // dashboard toggle doesn't say which it turned on, so this is settable and
  // `npm run bunny:verify` reports which one the CDN actually accepts.
  scheme: (process.env.BUNNY_STREAM_TOKEN_SCHEME || 'sha256').toLowerCase()
});

const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** A Bunny video id is a plain GUID — never interpolate anything else into a path. */
export const isVideoId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

export const TOKEN_SCHEMES = ['sha256', 'hmac'];

/** The signed query string for `path`, valid until `expires`. */
export function signQuery(path, expires, { tokenKey, scheme }) {
  if (scheme === 'hmac') {
    // Token Authentication V2
    const t = base64url(createHmac('sha256', tokenKey).update(path + expires).digest());
    return `token=${t}&expires=${expires}&token_path=${encodeURIComponent(path)}&token_ver=2`;
  }
  // Advanced token authentication: plain SHA-256 over key + path + expiry
  const t = base64url(createHash('sha256').update(tokenKey + path + expires).digest());
  return `token=${t}&expires=${expires}&token_path=${encodeURIComponent(path)}`;
}

/**
 * A signed URL for one file belonging to `videoId`, valid for `ttlSeconds`.
 *
 * The signature covers the directory `/{videoId}/` rather than the single
 * file, because an HLS player fetches the playlist and then every segment
 * listed inside it. The player re-applies this same query string to those
 * segment requests — see mountVideo() in the member area.
 */
export function signedVideoUrl(videoId, file = 'playlist.m3u8', ttlSeconds = 4 * 3600) {
  const cfg = bunnyConfig();
  if (!cfg.host) throw new Error('BUNNY_STREAM_CDN_HOSTNAME not set');
  if (!isVideoId(videoId)) throw new Error('bad video id');

  const dir = `/${videoId}/`;
  const base = `https://${cfg.host}${dir}${file}`;
  // Without a token key the pull zone is not protected; return the plain URL
  // rather than a signature the CDN would reject.
  if (!cfg.tokenKey) return base;

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${base}?${signQuery(dir, expires, cfg)}`;
}

/** Bunny's generated thumbnail, signed the same way. */
export const signedThumbUrl = (videoId, ttlSeconds) =>
  signedVideoUrl(videoId, 'thumbnail.jpg', ttlSeconds);
