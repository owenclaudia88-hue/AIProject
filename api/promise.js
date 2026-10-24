import { sessionEmail } from '../lib/session.js';
import { isActive, savePromiseRun, getPromiseRun, updatePromiseRun, listPromiseRuns,
         promiseCallsToday } from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';
import { FIELDS, SCORES, REFINE_KINDS, writePromises, refinePromise } from '../lib/promise.js';

/**
 * The Promise Builder, for signed-in members.
 *
 *   GET  /api/promise              the questions, the scores, past runs, calls left today
 *   GET  /api/promise?id=12        one past run
 *   POST /api/promise { answers }  six new promises
 *   POST /api/promise { id, list: 'options'|'wild', index, refine } one promise rewritten
 *
 * Every call to the model counts against DAILY, runs and refines alike: the
 * tool is free to members, and a cap is what keeps it that way.
 */
const DAILY = 25;
const MAX = 3000;

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!isAdmin(email) && !(await isActive(email))) return res.status(403).json({ error: 'not active' });

    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (id) {
        const run = await getPromiseRun(id, email);
        if (!run) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ run: { id: Number(run.id), answers: run.answers, ...run.result, at: run.created_at } });
      }
      const [runs, used] = await Promise.all([listPromiseRuns(email), promiseCallsToday(email)]);
      return res.status(200).json({
        fields: FIELDS, scores: SCORES.map(([key, label]) => ({ key, label })),
        runs: runs.map((r) => ({ id: Number(r.id), offer: r.offer, at: r.created_at })),
        left: Math.max(0, DAILY - used), daily: DAILY
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    if ((await promiseCallsToday(email)) >= DAILY) {
      return res.status(429).json({ error: `That's all ${DAILY} for today. Your past promises are still here, and it resets tomorrow.` });
    }

    // One promise rewritten.
    if (b.refine) {
      if (!REFINE_KINDS.includes(b.refine)) return res.status(400).json({ error: 'unknown refine' });
      const run = await getPromiseRun(b.id, email);
      if (!run) return res.status(404).json({ error: 'not found' });
      const list = b.list === 'wild' ? 'wild' : 'options';
      const i = Number(b.index);
      const current = run.result?.[list]?.[i];
      if (!current) return res.status(400).json({ error: 'no such promise' });
      const fresh = await refinePromise(run.answers, run.result.outcome, current, b.refine);
      if (!fresh) return res.status(502).json({ error: 'That one did not come back. Try again.' });
      const result = { ...run.result, [list]: run.result[list].map((o, n) => (n === i ? fresh : o)) };
      await updatePromiseRun(run.id, email, result);
      return res.status(200).json({ promise: fresh, list, index: i });
    }

    // Six new promises.
    const answers = {};
    for (const f of FIELDS) {
      const v = typeof b.answers?.[f.key] === 'string' ? b.answers[f.key].trim().slice(0, MAX) : '';
      if (v) answers[f.key] = v;
    }
    if (!answers.offer || answers.offer.length < 15) {
      return res.status(400).json({ error: 'Tell us a little more about your offer first: a sentence or two is enough.' });
    }
    const result = await writePromises(answers);
    const saved = await savePromiseRun(email, answers, result);
    return res.status(200).json({ run: { id: Number(saved.id), answers, ...result, at: saved.created_at } });
  } catch (err) {
    console.error('[promise]', err);
    return res.status(500).json({ error: 'Something went wrong writing your promises. Try again in a moment.' });
  }
}
