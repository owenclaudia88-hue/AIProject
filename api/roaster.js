import { sessionEmail } from '../lib/session.js';
import { isActive, entitlementsFor, hasSharedWin, saveRoast, getRoast, listRoasts, roastsToday } from '../lib/db.js';
import { MEMBERSHIP_ONLY } from '../lib/products.js';
import { isAdmin } from '../lib/admin.js';
import { readPage, roast, SECTIONS } from '../lib/roaster.js';
import { SCORES } from '../lib/promise.js';

/**
 * The Offer Roaster, for members on a trial or the paid membership - and
 * then only once they have shared a win in the community, which is what
 * unlocks it. Staff skip both.
 *
 *   GET  /api/roaster            unlocked?, past roasts, roasts left today
 *   GET  /api/roaster?id=7       one past roast
 *   POST /api/roaster { url } | { copy }   a new roast
 *
 * A roast reads a whole page and writes a long answer, so the caps are
 * smaller than the Promise Builder's: DAILY each, SITE_DAILY for everybody.
 */
const DAILY = Number.parseInt(process.env.ROASTER_DAILY ?? '5', 10) || 5;
const SITE_DAILY = Number.parseInt(process.env.ROASTER_SITE_DAILY ?? '100', 10) || 100;

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    const staff = isAdmin(email);
    if (!staff && !(await isActive(email))) return res.status(403).json({ error: 'not active' });
    if (!staff && !(await entitlementsFor(email)).has(MEMBERSHIP_ONLY)) {
      return res.status(403).json({ error: 'membership', message: 'The Offer Roaster is part of the membership.' });
    }
    const unlocked = staff || await hasSharedWin(email);

    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (id) {
        const r = await getRoast(id, email);
        if (!r) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ roast: { id: Number(r.id), source: r.source, ...r.result, at: r.created_at } });
      }
      const [roasts, used] = await Promise.all([listRoasts(email), roastsToday(email)]);
      return res.status(200).json({
        unlocked, daily: DAILY, left: Math.max(0, DAILY - used),
        sections: SECTIONS, scores: SCORES.map(([key, label]) => ({ key, label })),
        roasts: roasts.map((r) => ({ id: Number(r.id), source: r.source, score: r.score, at: r.created_at }))
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    if (!unlocked) {
      return res.status(403).json({ error: 'locked', message: 'Share a win in the community to unlock the Offer Roaster.' });
    }
    if ((await roastsToday(email)) >= DAILY) {
      return res.status(429).json({ error: `That's all ${DAILY} roasts for today. Your past roasts are still here, and it resets tomorrow.` });
    }
    if ((await roastsToday()) >= SITE_DAILY) {
      return res.status(429).json({ error: 'The Offer Roaster is resting until tomorrow: it has been busy today. Your past roasts are still here.' });
    }

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    let text, source;
    if (typeof b.url === 'string' && b.url.trim()) {
      try {
        const page = await readPage(b.url);
        text = page.text; source = page.host;
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    } else {
      text = typeof b.copy === 'string' ? b.copy.trim().slice(0, 40000) : '';
      source = 'Pasted copy';
      if (text.length < 300) return res.status(400).json({ error: 'Paste a bit more of the page: at least the headline, the offer and the price.' });
    }

    const result = await roast(text);
    const saved = await saveRoast(email, source, text, result);
    return res.status(200).json({ roast: { id: Number(saved.id), source, ...result, at: saved.created_at } });
  } catch (err) {
    console.error('[roaster]', err);
    return res.status(500).json({ error: 'Something went wrong roasting that page. Try again in a moment.' });
  }
}
