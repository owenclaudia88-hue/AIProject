/**
 * The member's side of the Personalised AI Roadmap.
 *
 *   GET  /api/roadmap           — the questions, and where their request is up to
 *   POST /api/roadmap { answers } — submit, or revise one not yet started
 *
 * A membership perk, gated the same way as the rest of them.
 */
import { sessionEmail } from '../lib/session.js';
import { isActive, entitlementsFor, createRoadmapRequest, roadmapFor } from '../lib/db.js';
import { isAdmin } from '../lib/admin.js';
import { isTester } from '../lib/testers.js';
import { MEMBERSHIP_ONLY } from '../lib/products.js';
import { formSpec, cleanAnswers, missing, FIELD_BY_KEY } from '../lib/roadmap.js';

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    const staff = isAdmin(email);
    // Not finished yet, so it is the test account's and staff's alone. Checked
    // before the membership rule, because telling somebody they need a
    // subscription for something they could not have either way answers a
    // question they did not ask. Comes out when it opens to everybody.
    if (!staff && !isTester(email)) {
      return res.status(403).json({ error: 'not available', message: 'The AI Roadmap is not open yet.' });
    }
    if (!staff && !(await isActive(email))) return res.status(403).json({ error: 'not active' });
    if (!staff && !(await entitlementsFor(email)).has(MEMBERSHIP_ONLY)) {
      return res.status(403).json({ error: 'membership', message: 'The AI Roadmap is part of the membership.' });
    }

    if (req.method === 'GET') {
      const mine = await roadmapFor(email);
      return res.status(200).json({
        steps: formSpec(),
        request: mine ? {
          id: Number(mine.id),
          status: mine.status,
          // Only what they wrote, so a half-finished form can be picked back up.
          answers: mine.status === 'new' ? (mine.answers || {}) : undefined,
          roadmap: mine.status === 'published' ? mine.published : undefined,
          submittedAt: mine.created_at,
          publishedAt: mine.published_at
        } : null
      });
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
      // Built from the question definitions, so a field nobody was asked about
      // cannot be posted in and end up in the prompt.
      const answers = cleanAnswers(b.answers);
      const gaps = missing(answers);
      if (gaps.length) {
        return res.status(400).json({
          error: 'incomplete',
          missing: gaps.map((k) => FIELD_BY_KEY[k]?.label || k)
        });
      }

      const out = await createRoadmapRequest(email, answers);
      return res.status(200).json({ ok: true, id: out.id, existing: out.existing });
    }

    return res.status(405).json({ error: 'GET or POST' });
  } catch (err) {
    console.error('[roadmap]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
