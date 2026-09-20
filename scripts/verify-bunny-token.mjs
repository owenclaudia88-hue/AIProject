/**
 * Work out which token signature your pull zone accepts, and prove a video
 * actually plays end to end.
 *
 *   node --env-file=.env.local scripts/verify-bunny-token.mjs
 *
 * Bunny documents two signatures for CDN token authentication and the
 * dashboard toggle doesn't say which one it enabled, so rather than guess this
 * asks the CDN: it signs a real video both ways and reports which comes back
 * 200. It also fetches a segment, because a token that covers only the
 * playlist lets the first request through and rejects everything after it —
 * the failure that looks like "the video loads then dies a second in".
 *
 * Prints the line to put in .env.local. Reads no secrets out to anywhere.
 */
import { bunnyConfig, signQuery, TOKEN_SCHEMES, isVideoId } from '../lib/bunny.js';

const cfg = bunnyConfig();
if (!cfg.host)     { console.error('BUNNY_STREAM_CDN_HOSTNAME not set.'); process.exit(1); }
if (!cfg.tokenKey) { console.error('BUNNY_STREAM_TOKEN_KEY not set — run `npm run bunny:keys` first.'); process.exit(1); }

/* ---------------- pick a video to test with ---------------- */
let videoId = process.argv.find(a => isVideoId(a));
if (!videoId) {
  if (!cfg.apiKey) { console.error('No video id given and BUNNY_STREAM_API_KEY not set.'); process.exit(1); }
  const r = await fetch(`https://video.bunnycdn.com/library/${cfg.libraryId}/videos?page=1&itemsPerPage=10`,
    { headers: { AccessKey: cfg.apiKey, accept: 'application/json' } });
  if (!r.ok) { console.error(`Bunny API ${r.status} — check BUNNY_STREAM_API_KEY / LIBRARY_ID.`); process.exit(1); }
  const items = (await r.json()).items || [];
  const ready = items.find(v => v.status === 4) || items[0];
  if (!ready) { console.error('The library has no videos to test with.'); process.exit(1); }
  videoId = ready.guid;
  console.log(`testing with: ${ready.title}  [${videoId}]\n`);
}

const dir = `/${videoId}/`;
const url = (file, qs) => `https://${cfg.host}${dir}${file}` + (qs ? `?${qs}` : '');

async function status(u) {
  try { const r = await fetch(u, { redirect: 'manual' }); return r.status; }
  catch (e) { return `ERR ${e.message}`; }
}

/* ---------------- unsigned: is the zone actually locked? ---------------- */
const openStatus = await status(url('playlist.m3u8'));
console.log(`unsigned playlist            → ${openStatus}`);
if (openStatus === 200) {
  console.log('\n  WARNING: the unsigned URL plays. CDN token authentication is still OFF,');
  console.log('  so anyone with the link can watch. Turn it on at Pull zone → Security.');
}

/* ---------------- each scheme ---------------- */
const expires = Math.floor(Date.now() / 1000) + 3600;
let winner = null;

for (const scheme of TOKEN_SCHEMES) {
  const qs = signQuery(dir, expires, { tokenKey: cfg.tokenKey, scheme });
  const playlistStatus = await status(url('playlist.m3u8', qs));
  let segmentNote = '';

  if (playlistStatus === 200) {
    // Pull a real segment name out of the playlist and try it with the same
    // token — this is what proves the directory token is working.
    try {
      const body = await (await fetch(url('playlist.m3u8', qs))).text();
      const child = body.split('\n').find(l => l.trim() && !l.startsWith('#'));
      if (child) {
        const sub = await (await fetch(url(child.trim(), qs))).text();
        const seg = sub.split('\n').find(l => l.trim() && !l.startsWith('#'));
        const segUrl = seg
          ? `https://${cfg.host}${dir}${child.trim().replace(/[^/]+$/, '')}${seg.trim()}?${qs}`
          : null;
        segmentNote = segUrl ? `   segment → ${await status(segUrl)}` : '   (no segment listed)';
      }
    } catch (e) { segmentNote = `   segment check failed: ${e.message}`; }
    if (!winner) winner = scheme;
  }
  console.log(`scheme "${scheme}"`.padEnd(29) + `→ ${playlistStatus}${segmentNote}`);
}

/* ---------------- verdict ---------------- */
console.log('');
if (winner) {
  console.log(`Use this signature. Add to .env.local (and Vercel):\n\n    BUNNY_STREAM_TOKEN_SCHEME=${winner}\n`);
  if (winner === 'sha256') console.log('(that is also the default, so the line is optional)');
} else if (openStatus === 200) {
  console.log('Token authentication is off, so nothing needed to sign yet.');
  console.log('Turn it on, then run this again to confirm signing works.');
} else {
  console.log('Neither signature was accepted. Most likely the security key is from the');
  console.log('Stream library rather than the pull zone — the one you want is at');
  console.log('Pull zone → Manage → Security → Token Authentication.');
}
