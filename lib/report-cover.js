/**
 * The cover image for one report.
 *
 * Two paths behind one function, and the fallback is not a placeholder: a
 * report that goes out on a Monday morning with no cover because an image
 * service was busy is a broken-looking report, so the drawn cover is a real
 * cover that happens to cost nothing and never fails.
 *
 *   Higgsfield, when HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET are set.
 *   A drawn SVG otherwise, or whenever the first path does not finish in time.
 *
 * Either way the file ends up in our own blob store. Higgsfield keep output
 * for about a week, which is fine for a video somebody downloads and wrong for
 * the cover of report 4 that somebody opens in March.
 */
import { put } from '@vercel/blob';

const API = 'https://api.higgsfield.ai';
const MODEL = '/higgsfield-ai/soul/standard';

/* ---------------- the prompt ---------------- */

/**
 * One house style, so a hundred covers look like a series rather than a
 * hundred separate decisions. No text in the image: models spell badly, and
 * the title is already set in type above it.
 */
function coverPrompt(title, topic) {
  const subject = {
    'what-changed': 'an abstract network of connected nodes, one node brighter than the rest',
    tutorial: 'a clean isometric workbench with simple geometric tools arranged in order',
    tools: 'a set of abstract modular blocks slotting together',
    'deep-dive': 'layered translucent planes receding into depth, like a cross-section'
  }[topic] || 'abstract flowing geometric forms';

  return `Editorial cover illustration, 16:9. ${subject}. Dark charcoal background (#0a0a0b), `
    + `warm amber and orange accent lighting (#ff7a1a, #ffb020), subtle depth of field, `
    + `minimal, premium, modern technology magazine aesthetic. No text, no words, no letters, `
    + `no logos, no people, no faces. Theme, interpreted abstractly: ${String(title).slice(0, 120)}`;
}

/* ---------------- the drawn one ---------------- */

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A cover drawn from the report's own number and title.
 *
 * Deterministic: the same report always gets the same cover, because a cover
 * that changes when a page is re-rendered looks like a bug. The hue comes from
 * the number, so consecutive reports sit apart on the shelf.
 */
export function drawCover({ number, title, topic }) {
  const n = Number(number) || 1;

  // Inside the brand's own band rather than around the whole wheel. Thirty
  // degrees of amber-to-orange is enough to tell two covers apart on a shelf
  // and not enough for one of them to come out lime green.
  const hue = 14 + ((n * 7) % 31);
  const a = `hsl(${hue} 95% 60%)`;
  const b = `hsl(${(hue + 14) % 360} 88% 50%)`;

  // Wrapped, not cut. "Cheaper models, and when cheaper i" is what truncation
  // looks like on a cover, and it reads as a bug.
  const words = String(title || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (lines.length === 2) break;
    const next = line ? `${line} ${w}` : w;
    if (next.length > 30 && line) { lines.push(line); line = w; } else line = next;
  }
  if (line && lines.length < 2) lines.push(line);
  const size = lines.length > 1 ? 50 : 56;
  const top = lines.length > 1 ? 330 : 366;

  const dots = [];
  for (let i = 0; i < 44; i++) {
    const x = 60 + ((i * 137 + n * 29) % 1080);
    const y = 36 + ((i * 263 + n * 61) % 392);
    // The text sits bottom left; keep the lattice out of its way.
    if (x < 760 && y > 250) continue;
    const r = 1.5 + ((i + n) % 4);
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 6 === 0 ? a : '#ffffff'}" opacity="${i % 6 === 0 ? 0.85 : 0.1}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480" role="img" aria-label="${esc(title)}">
  <defs>
    <radialGradient id="g1" cx="76%" cy="8%" r="70%">
      <stop offset="0%" stop-color="${a}" stop-opacity=".30"/><stop offset="100%" stop-color="${a}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="12%" cy="96%" r="62%">
      <stop offset="0%" stop-color="${b}" stop-opacity=".20"/><stop offset="100%" stop-color="${b}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="480" fill="#0a0a0b"/>
  <rect width="1200" height="480" fill="url(#g1)"/>
  <rect width="1200" height="480" fill="url(#g2)"/>
  ${dots.join('')}
  <text x="60" y="${top - 46}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="21"
        letter-spacing="6" fill="${a}">REPORT ${String(n).padStart(2, '0')}</text>
  ${lines.map((l, i) => `<text x="60" y="${top + i * (size + 10)}" font-family="Inter, system-ui, sans-serif" ` +
    `font-size="${size}" font-weight="800" letter-spacing="-1.5" fill="#f4f4f5">${esc(l)}</text>`).join('\n  ')}
  <rect x="0" y="474" width="1200" height="6" fill="${a}"/>
</svg>`;
}

/* ---------------- Higgsfield ---------------- */

/**
 * Higgsfield want "Authorization: Key <id>:<secret>" - two values, not one.
 *
 * Their console shows them in more than one shape depending on where you
 * created the credential, so both are accepted: the pair in two variables, or
 * a single variable already holding "id:secret". A single value with no colon
 * is the secret on its own and cannot work, so it is refused here rather than
 * sent and rejected at seven on a Monday morning.
 */
const creds = () => {
  const id = process.env.HIGGSFIELD_KEY_ID;
  const secret = process.env.HIGGSFIELD_KEY_SECRET;
  if (id && secret) return `Key ${id.trim()}:${secret.trim()}`;

  const single = (process.env.HIGGSFIELD_API_KEY || '').trim();
  if (single.includes(':')) return `Key ${single}`;
  if (single) {
    console.error('[reports] HIGGSFIELD_API_KEY has no colon in it — that is the secret on its own. '
      + 'Higgsfield need the key id as well: set HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET.');
  }
  return null;
};

async function higgsfield(prompt, { timeoutMs = 120000 } = {}) {
  const auth = creds();
  if (!auth) return null;

  const start = await fetch(API + MODEL, {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, num_images: 1, resolution: '2K', aspect_ratio: '16:9' }),
    signal: AbortSignal.timeout(30000)
  });
  if (!start.ok) throw new Error(`Higgsfield ${start.status}: ${(await start.text()).slice(0, 200)}`);

  let job = await start.json();
  const until = Date.now() + timeoutMs;
  // Polled rather than awaited: these take tens of seconds, and the cron has
  // the whole of a Monday morning before anybody is awake to read it.
  while (!['completed', 'failed', 'nsfw', 'canceled'].includes(job.status)) {
    if (Date.now() > until) throw new Error('Higgsfield did not finish in time');
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(job.status_url || `${API}/requests/${job.request_id}/status`, {
      headers: { authorization: auth }, signal: AbortSignal.timeout(20000)
    });
    if (!poll.ok) throw new Error(`Higgsfield status ${poll.status}`);
    job = await poll.json();
  }

  if (job.status !== 'completed') throw new Error(`Higgsfield ${job.status}${job.error ? ': ' + job.error : ''}`);
  const url = job.images && job.images[0] && job.images[0].url;
  if (!url) throw new Error('Higgsfield finished with no image');
  return url;
}

/* ---------------- what the pipeline calls ---------------- */

/**
 * A cover for this report, in our own storage, whatever happened upstream.
 *
 * Never throws. The worst case is the drawn cover, which is a perfectly good
 * cover - losing the week's report over an image would be the wrong trade.
 */
export async function makeCover({ number, title, topic }) {
  const name = `reports/cover-${number}-${Date.now()}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const remote = await higgsfield(coverPrompt(title, topic));
    if (remote) {
      // Copied into our store on the way past: Higgsfield keep theirs for
      // about a week, and these have to still be there next year.
      const file = await fetch(remote, { signal: AbortSignal.timeout(45000) });
      if (!file.ok) throw new Error(`cover download ${file.status}`);
      const blob = await put(`${name}.jpg`, await file.arrayBuffer(), {
        access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, token
      });
      return { url: blob.url, kind: 'higgsfield' };
    }
  } catch (err) {
    // Reported, not thrown: the report still goes out.
    console.error('[reports] cover fell back to drawn:', err.message);
  }

  const blob = await put(`${name}.svg`, drawCover({ number, title, topic }), {
    access: 'public', contentType: 'image/svg+xml', addRandomSuffix: true, token
  });
  return { url: blob.url, kind: 'drawn' };
}
