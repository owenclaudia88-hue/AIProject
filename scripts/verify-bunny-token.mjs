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

// The zone also restricts by referrer, and a bare server-side fetch sends
// none — which is its own 403 and looks exactly like a bad token. Send what
// the member's browser would, so what we are measuring really is the token.
const SITE = process.env.SITE_URL || 'https://aifounderuniversity.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  Referer: SITE.replace(/\/*$/, '/')
};

async function status(u) {
  try { const r = await fetch(u, { headers: HEADERS, redirect: 'manual' }); return r.status; }
  catch (e) { return `ERR ${e.message}`; }
}

/* ---------------- is the referrer rule, not the token, doing the rejecting? --- */
// Worth stating plainly, because a refused bare request looks identical to a
// refused token and cost a long time to tell apart once already.
const bare = await (async () => {
  try { return (await fetch(url('playlist.m3u8'), { redirect: 'manual' })).status; }
  catch { return 'ERR'; }
})();

/* ---------------- unsigned: is the zone actually locked? ---------------- */
const openStatus = await status(url('playlist.m3u8'));
console.log(`no referrer, no token        → ${bare}${bare === 403 ? '   (referrer rule is active)' : ''}`);
console.log(`with referrer, no token      → ${openStatus}`);

if (openStatus === 200) {
  console.log('\n  Token authentication is OFF: an unsigned URL plays, so every token');
  console.log('  below is simply ignored and proves nothing. The videos are currently');
  console.log('  protected by the referrer rule alone — a link pasted into a browser');
  console.log('  address bar sends no referrer and is refused, but one embedded on');
  console.log('  another site that fakes the referrer is not.');
  console.log('\n  To sign URLs properly: turn Token authentication ON at');
  console.log('  Pull zone → Security → Token authentication, then run this again.');
  process.exit(0);
}

/* ---------------- each key, each scheme ---------------- */
const expires = Math.floor(Date.now() / 1000) + 3600;
let winner = null;

// Bunny shows more than one "token authentication key" and the docs don't say
// which signs CDN requests, so try each one we were given rather than guess.
const keys = [{ label: 'TOKEN_KEY', value: cfg.tokenKey }];
if (cfg.tokenKeyAlt && cfg.tokenKeyAlt !== cfg.tokenKey) {
  keys.push({ label: 'TOKEN_KEY_ALT', value: cfg.tokenKeyAlt });
}
// Long shot, but it costs one hash each and rules the key out for good: some
// Bunny setups sign with the library API key rather than a separate one.
if (cfg.apiKey && cfg.apiKey !== cfg.tokenKey) {
  keys.push({ label: 'API_KEY', value: cfg.apiKey });
}

const PATH_MODES = ['dir', 'file'];

for (const key of keys) for (const scheme of TOKEN_SCHEMES) for (const pathMode of PATH_MODES) {
  // 'file' signs the exact path; 'dir' signs the folder so the segments share it
  const signed = pathMode === 'file' ? `${dir}playlist.m3u8` : dir;
  const qs = signQuery(signed, expires, { tokenKey: key.value, scheme, pathMode });
  const playlistStatus = await status(url('playlist.m3u8', qs));
  let segmentNote = '';

  if (playlistStatus === 200) {
    // Pull a real segment name out of the playlist and try it with the same
    // token — this is what proves the directory token is working.
    try {
      const body = await (await fetch(url('playlist.m3u8', qs), { headers: HEADERS })).text();
      const child = body.split('\n').find(l => l.trim() && !l.startsWith('#'));
      if (child) {
        const sub = await (await fetch(url(child.trim(), qs), { headers: HEADERS })).text();
        const seg = sub.split('\n').find(l => l.trim() && !l.startsWith('#'));
        const segUrl = seg
          ? `https://${cfg.host}${dir}${child.trim().replace(/[^/]+$/, '')}${seg.trim()}?${qs}`
          : null;
        if (segUrl) {
          const segStatus = await status(segUrl);
          segmentNote = `   segment → ${segStatus}`;
          // The playlist passing is not enough. A token that covers only the
          // playlist lets playback start and then dies on the first segment,
          // so a combination only counts if the segment passes too.
          if (segStatus === 200 && !winner) winner = { scheme, pathMode, key: key.label };
        } else segmentNote = '   (no segment listed)';
      }
    } catch (e) { segmentNote = `   segment check failed: ${e.message}`; }
  }
  console.log(`${key.label} · ${scheme} · ${pathMode}`.padEnd(40) + `→ ${playlistStatus}${segmentNote}`);
}

/* ---------------- verdict ---------------- */
console.log('');
if (winner) {
  console.log(`Working combination: ${winner.key} · ${winner.scheme} · ${winner.pathMode}\n`);
  console.log('Add to .env.local (and Vercel):\n');
  console.log(`    BUNNY_STREAM_TOKEN_SCHEME=${winner.scheme}`);
  console.log(`    BUNNY_STREAM_TOKEN_PATH_MODE=${winner.pathMode}\n`);
  if (winner.pathMode === 'file') {
    console.log('Note: a file token covers only the playlist, so the segments are signed');
    console.log('separately by the player. Directory mode would be preferable if it works.');
  }
  if (winner.key === 'TOKEN_KEY_ALT') {
    console.log('\nThe alternate key is the one that works — move its value into');
    console.log('BUNNY_STREAM_TOKEN_KEY so the site uses it, then drop the _ALT line.');
  }
} else if (openStatus === 200) {
  console.log('Token authentication is off, so nothing needed to sign yet.');
  console.log('Turn it on, then run this again to confirm signing works.');
} else {
  console.log('Neither signature was accepted. Most likely the security key is from the');
  console.log('Stream library rather than the pull zone — the one you want is at');
  console.log('Pull zone → Manage → Security → Token Authentication.');
}
