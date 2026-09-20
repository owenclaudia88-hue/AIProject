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
  // Bunny shows a "Token authentication key" on the Stream library and the
  // underlying pull zone has one of its own; the docs don't say which signs
  // CDN requests. If they turn out to differ, put the second one here and
  // `npm run bunny:verify` will tell you which of them the CDN accepts.
  tokenKeyAlt: process.env.BUNNY_STREAM_TOKEN_KEY_ALT || '',
  apiKey: process.env.BUNNY_STREAM_API_KEY || '',
  // Which signature the pull zone expects. Bunny documents two and the
  // dashboard toggle doesn't say which it turned on, so this is settable and
  // `npm run bunny:verify` reports which one the CDN actually accepts.
  scheme: (process.env.BUNNY_STREAM_TOKEN_SCHEME || 'sha256').toLowerCase(),
  // 'dir' signs the video's directory so the HLS segments share one token.
  pathMode: (process.env.BUNNY_STREAM_TOKEN_PATH_MODE || 'dir').toLowerCase()
});

const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** A Bunny video id is a plain GUID — never interpolate anything else into a path. */
export const isVideoId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

/**
 * Bunny offers Basic (MD5) and Advanced token authentication, and the pull
 * zone doesn't say which is on, so all three digests are implemented and
 * `npm run bunny:verify` reports which one the CDN actually accepts.
 */
export const TOKEN_SCHEMES = ['sha256', 'hmac', 'md5'];

const digest = (scheme, tokenKey, payload) =>
  scheme === 'hmac'
    ? createHmac('sha256', tokenKey).update(payload).digest()
    : createHash(scheme === 'md5' ? 'md5' : 'sha256').update(tokenKey + payload).digest();

/**
 * The signed query string for `path`, valid until `expires`.
 *
 * `pathMode` 'dir' signs a whole directory via token_path, which is what HLS
 * needs — the playlist and every segment beside it share one token. 'file'
 * signs just the one path, which is Bunny's single-file form.
 */
export function signQuery(path, expires, { tokenKey, scheme = 'sha256', pathMode = 'dir' }) {
  const signed = pathMode === 'dir' ? path : path;
  const token = base64url(digest(scheme, tokenKey, signed + expires));
  const q = [`token=${token}`, `expires=${expires}`];
  if (pathMode === 'dir') q.push(`token_path=${encodeURIComponent(path)}`);
  if (scheme === 'hmac') q.push('token_ver=2');
  return q.join('&');
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
  const signed = cfg.pathMode === 'file' ? `${dir}${file}` : dir;
  return `${base}?${signQuery(signed, expires, cfg)}`;
}

/** Bunny's generated thumbnail, signed the same way. */
export const signedThumbUrl = (videoId, ttlSeconds) =>
  signedVideoUrl(videoId, 'thumbnail.jpg', ttlSeconds);
