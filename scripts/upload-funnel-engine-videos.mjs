/**
 * Put the Funnel Engine's lesson videos - and its two order bumps' - into Bunny Stream.
 *
 *   node --env-file=.env.local scripts/upload-funnel-engine-videos.mjs "C:/Users/Coolio/Downloads" [--course=edward|operators]
 *
 * The videos came off the Own Your Stack program, where they play from Mux
 * with signed playback, so there is no URL Bunny could fetch them from - they
 * are uploaded from the files instead. Each lands in one "The Funnel Engine"
 * collection under its lesson's title, and the lesson slug -> Bunny guid map is
 * written next to the course script, which reads it.
 *
 * Re-runnable. A video already in the collection under the same title is
 * reused rather than uploaded twice, so a run that died halfway can simply be
 * started again.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const LIB = process.env.BUNNY_STREAM_LIBRARY_ID;
const KEY = process.env.BUNNY_STREAM_API_KEY;
if (!LIB || !KEY) { console.error('BUNNY_STREAM_LIBRARY_ID / BUNNY_STREAM_API_KEY not set'); process.exit(1); }

const dir = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!dir) { console.error('usage: upload-funnel-engine-videos.mjs <folder with the mp4s>'); process.exit(1); }

/* --course picks which set of lessons this run is for: the Funnel Engine itself,
   or one of its two order bumps. Each gets its own Bunny collection and its own
   slug -> guid map for its course script to read. */
const COURSE = (process.argv.find((a) => a.startsWith('--course=')) || '--course=funnel-engine').slice('--course='.length);

/* --replace=slug,slug swaps those lessons' videos for new files. The first
   downloads of the five replay parts stopped partway - Live Q&A held under
   five of its fifty-two minutes - and Bunny, rightly, encoded only what it was
   given. A video already on Bunny will not take a second file, so these are
   deleted and uploaded again. */
const REPLACE = new Set((process.argv.find((a) => a.startsWith('--replace=')) || '')
  .slice('--replace='.length).split(',').map((x) => x.trim()).filter(Boolean));

/* Lesson slug, its title, and how to find its file: the start of the name the
   downloader gave it, or "=" and the whole name when two files start alike -
   the downloader named the Operators' second video after the first. */
const OPS = 'Your upgrade Your DFY AI Operators How to Install The Skills Download the Sell While You Sleep skills folder and install every skill in Claude Chat or Claude Code. You will also see the exac';
const COURSES = {
  'funnel-engine': {
    collection: 'The Funnel Engine',
    out: 'Claude outputs/funnel-engine/bunny-videos.json',
    lessons: [
      ['oys-cc-tony-stark', "You're Tony Stark. Claude Is Jarvis.", 'Youre Tony Stark'],
      ['oys-cc-code-vs-chat', 'Claude Code vs Claude Chat', 'Claude Code vs Claude Chat'],
      ['oys-cc-setup', 'Set Up Claude Code for Your Business', 'Set Up Claude Code for Your Business'],
      ['oys-cc-skills', 'Skills: How You Like Things Done', 'Skills How You Like Things Done'],
      ['oys-cc-models', 'Pick Your Model. Skip the Hype.', 'Pick Your Model'],
      ['oys-cc-bypass-remote', 'Bypass Permissions and Remote Control', 'Bypass Permissions and Remote Control'],
      ['oys-cc-settings', 'My Settings, Click by Click', 'My Settings Click by Click'],
      ['oys-cc-browser', 'Let Claude Drive Your Browser', 'Let Claude Drive Your Browser'],
      ['oys-cc-codex-claude', 'Claude and Codex, Working Together', 'Claude and Codex Working Together'],
      ['oys-cc-team-member', 'Pay Claude Like a Team Member', 'Pay Claude Like a Team Member'],
      ['oys-cc-plug-in', 'Plug In Your Tools', 'Plug In Your Tools'],
      ['oys-replay-new-way', 'The New Way to Launch', 'The New Way to Launch'],
      ['oys-replay-install-engine', 'Install the Funnel Engine', 'Install the Funnel Engine'],
      ['oys-replay-pages-live', 'Where Your Pages Live', 'Where Your Pages Live'],
      ['oys-replay-ten-ninety', 'The 10/90 and the Install Offer', 'The 1090 and the Install Offer'],
      ['oys-replay-qa', 'Live Q&A', 'Live QA']
    ]
  },
  edward: {
    collection: 'Edward: Evergreen Ads',
    out: 'Claude outputs/funnel-engine/bunny-videos-edward.json',
    lessons: [
      ['eg3-start-here', 'Start Here', 'Start Here What you bought'],
      ['eg3-how-to-install-an-agent', 'How to install an agent', 'How to install an agent'],
      ['eg3-connect-meta-mcp', 'Connect Your Ad Account To Your AI', 'Connect Your Ad Account To Your AI'],
      ['eg3-live-01-welcome', "1. Welcome + What We're Installing", '1. Welcome What Were Installing'],
      ['eg3-live-02-great-ads', '2. What Makes A Great Evergreen Ad', '2. What Makes A Great Evergreen Ad'],
      ['eg3-live-03-factory-live', '3. Writing Your Ads With Edward', '3. Writing Your Ads With Edward'],
      ['eg3-live-04-campaign-structure', '4. Campaign Structure That Stays Simple', '4. Campaign Structure That Stays Simple'],
      ['eg3-live-05-validation-velocity', '5. Validation, Windows & Velocity', '5. Validation Windows Velocity'],
      ['eg3-live-06-offer-first', '6. Offer First, Ads Second', '6. Offer First Ads Second'],
      ['eg3-live-07-ai-into-offer', '7. Building AI Into Your Offer', '7. Building AI Into Your Offer'],
      ['eg3-live-08-when-it-dies', '8. What To Do When It Dies', '8. What To Do When It Dies'],
      ['eg3-live-09-launching-live', '9. Launching Live + Final Questions', '9. Launching Live Final Questions'],
      ['eg3-ai-video-editing-bonus', 'How to Edit Your Videos with AI', 'Bonus Edit Your Videos with AI']
    ]
  },
  operators: {
    collection: 'DFY AI Operators',
    out: 'Claude outputs/funnel-engine/bunny-videos-operators.json',
    lessons: [
      ['install-the-skills', 'How to Install The Skills', `=${OPS}.mp4`],
      ['use-the-skills', 'How to Use The Skills', `=${OPS} (1).mp4`],
      ['load-up-the-skills', 'How to Load Up The Skills (Live Walkthrough)', 'Your upgrade Your DFY AI Operators How to Load Up The Skills']
    ]
  }
};
const course = COURSES[COURSE];
if (!course) { console.error(`--course must be one of: ${Object.keys(COURSES).join(', ')}`); process.exit(1); }
const COLLECTION = course.collection;
const OUT = path.resolve(course.out);
const LESSONS = course.lessons;

/* Five tries, a longer pause each time. The first run lost the eleventh upload to
   a reset connection and the second could not connect at all; a dropped
   connection is worth waiting out, a refusal from Bunny is not. */
const api = async (method, url, body, headers = {}) => {
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(`https://video.bunnycdn.com/library/${LIB}${url}`, {
        method, body,
        headers: { AccessKey: KEY, accept: 'application/json', ...headers }
      });
      break;
    } catch (err) {
      if (attempt >= 5) throw err;
      console.log(`  ${method} ${url.split('?')[0]}: ${err.cause?.code || err.message}, trying again (${attempt}/5)`);
      await new Promise((r) => setTimeout(r, 15000 * attempt));
    }
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
};

/* The video itself, streamed from disk with plain https rather than fetch.
   fetch gives up when the reply takes more than five minutes to start, and
   Bunny takes that long to answer after the last byte of a big file: the
   709 MB Live Q&A failed that way four times running. Streaming also keeps
   the whole file out of memory. */
const putFile = (guid, file, size) => new Promise((resolve, reject) => {
  const req = https.request({
    method: 'PUT', host: 'video.bunnycdn.com', path: `/library/${LIB}/videos/${guid}`,
    headers: { AccessKey: KEY, 'content-type': 'application/octet-stream', 'content-length': size }
  }, (res) => {
    let text = '';
    res.on('data', (c) => { text += c; });
    res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error(`PUT ${guid} -> ${res.statusCode} ${text.slice(0, 200)}`))));
  });
  req.setTimeout(0);
  req.on('error', reject);
  createReadStream(file).on('error', reject).pipe(req);
});

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.mp4'));
const plan = LESSONS.map(([slug, title, prefix]) => {
  const hits = prefix.startsWith('=') ? files.filter((f) => f === prefix.slice(1)) : files.filter((f) => f.startsWith(prefix));
  if (hits.length > 1) throw new Error(`${slug}: ${hits.length} files start "${prefix}" - keep one`);
  // No file here is fine for a lesson Bunny already has: a folder holding only
  // the re-downloaded replays leaves the other eleven as they are.
  if (!hits.length && REPLACE.has(slug)) throw new Error(`${slug}: asked to replace it, but no file starts "${prefix}"`);
  return { slug, title, file: hits.length ? path.join(dir, hits[0]) : null };
});

// The collection, found or made.
const cols = await api('GET', `/collections?page=1&itemsPerPage=100&search=${encodeURIComponent(COLLECTION)}`);
let collection = (cols.items || []).find((c) => c.name === COLLECTION);
if (!collection) collection = await api('POST', '/collections', JSON.stringify({ name: COLLECTION }), { 'content-type': 'application/json' });
console.log(`collection "${COLLECTION}": ${collection.guid}`);

const existing = await api('GET', `/videos?page=1&itemsPerPage=100&collection=${collection.guid}`);
const byTitle = new Map((existing.items || []).map((v) => [v.title, v]));

let map = {};
try { map = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }

for (const { slug, title, file } of plan) {
  const have = byTitle.get(title);
  // Bunny's statuses: 0 created with no file yet (filled in, not duplicated);
  // 1-4 it has the file, even while its storage still reads 0 - the first run
  // lost a reply after Bunny had the whole upload, and sending it again is
  // refused; 5 and 6 the upload or the encode failed, and a failed video will
  // not take a second file, so its empty record is deleted and made again.
  let slot = have;
  if (have && REPLACE.has(slug)) {
    await api('DELETE', `/videos/${have.guid}`);
    console.log(`- ${slug}: replacing ${have.guid}`);
    slot = null;
  } else if (have && (have.status === 5 || have.status === 6)) {
    await api('DELETE', `/videos/${have.guid}`);
    console.log(`- ${slug}: the earlier upload failed on Bunny's side; starting it again`);
    slot = null;
  }
  if (!file) {
    if (!slot) throw new Error(`${slug}: not on Bunny and no file for it here`);
    map[slug] = { guid: slot.guid, title };
    console.log(`= ${slug}: kept (${slot.guid})`);
    continue;
  }
  if (slot && slot.status >= 1) {
    map[slug] = { guid: have.guid, title };
    console.log(`= ${slug}: already uploaded (${have.guid})`);
    continue;
  }
  const video = slot || await api('POST', '/videos', JSON.stringify({ title, collectionId: collection.guid }),
    { 'content-type': 'application/json' });
  const size = (await stat(file)).size;
  const t = Date.now();
  await putFile(video.guid, file, size);
  map[slug] = { guid: video.guid, title };
  console.log(`+ ${slug}: ${(size / 1e6).toFixed(1)} MB in ${((Date.now() - t) / 1000).toFixed(0)}s -> ${video.guid}`);
  await writeFile(OUT, JSON.stringify(map, null, 2));
}

await writeFile(OUT, JSON.stringify(map, null, 2));
console.log(`\n${Object.keys(map).length} of ${LESSONS.length} lessons mapped -> ${OUT}`);
