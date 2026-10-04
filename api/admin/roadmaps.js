/**
 * The admin's side of the Personalised AI Roadmap.
 *
 *   GET  /api/admin/roadmaps            — everything waiting, unstarted first
 *   GET  /api/admin/roadmaps?id=        — one, with its answers and draft
 *   POST { id, generate: true }         — write a draft with Claude
 *   POST { id, roadmap }                — save edits to the draft
 *   POST { id, publish: true, roadmap } — send it to the member
 *
 * Generation runs on the request rather than a queue: it is a button somebody
 * presses and waits a few seconds for, and a queue would add a moving part for
 * a handful of roadmaps a week.
 */
import { sessionEmail } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import {
  listRoadmaps, roadmapById, claimRoadmap, saveRoadmapDraft, failRoadmap,
  publishRoadmap, entitlementsFor, getCustomer
} from '../../lib/db.js';
import { answersAsText } from '../../lib/roadmap.js';
import {
  buildCatalogue, buildPrompt, callClaude, parseJson, validate, MODEL
} from '../../lib/roadmap-generate.js';
import { sendRoadmapReady } from '../../lib/email.js';

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'staff only' });

  try {
    if (req.method === 'GET') {
      const id = Number(new URL(req.url, 'http://localhost').searchParams.get('id'));
      if (id) {
        const row = await roadmapById(id);
        if (!row) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ roadmap: shape(row, true) });
      }
      const rows = await listRoadmaps();
      return res.status(200).json({
        // So the screen can say why the button will not work before it is pressed.
        canGenerate: !!process.env.ANTHROPIC_API_KEY,
        model: MODEL,
        roadmaps: rows.map((r) => shape(r, false))
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
    const id = Number(b.id);
    if (!id) return res.status(400).json({ error: 'missing id' });

    /* ---- generate ---- */
    if (b.generate) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({
          error: 'no_key',
          message: 'ANTHROPIC_API_KEY is not set on this deployment, so nothing can be generated yet.'
        });
      }
      // The status is part of the claim, so two clicks cannot both start work.
      if (!(await claimRoadmap(id))) {
        return res.status(409).json({ error: 'already generating' });
      }

      const row = await roadmapById(id);
      try {
        const [entitled, customer] = await Promise.all([
          entitlementsFor(row.email), getCustomer(row.email)
        ]);
        const catalogue = await buildCatalogue(row.answers || {}, entitled);
        const prompt = buildPrompt(row.answers || {}, catalogue, customer?.name || row.name);

        const { data, text, model } = await callClaude(prompt);
        // The tool call is structured data already. parseJson is the fallback
        // for the day a model answers in prose anyway.
        const { roadmap, dropped, warnings } = validate(data || parseJson(text), catalogue);

        if (!roadmap.phases.length) throw new Error('the model returned no usable phases');

        await saveRoadmapDraft(id, roadmap, model);
        return res.status(200).json({
          ok: true, roadmap, model,
          // Surfaced rather than swallowed: if the model keeps naming things
          // that are not in the catalogue, that is worth seeing.
          dropped,
          // Same for a revenue table whose rows do not add up to its own total.
          // Reported, never silently corrected.
          warnings,
          catalogueSize: catalogue.items.length + catalogue.courses.length + catalogue.downloads.length
        });
      } catch (err) {
        console.error('[admin/roadmaps] generate', err);
        await failRoadmap(id, err.message);
        return res.status(500).json({ error: 'generate_failed', message: String(err.message || err).slice(0, 300) });
      }
    }

    /* ---- save edits ---- */
    if (b.roadmap && !b.publish) {
      const row = await roadmapById(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      await saveRoadmapDraft(id, b.roadmap, row.model);
      return res.status(200).json({ ok: true });
    }

    /* ---- publish ---- */
    if (b.publish) {
      const row = await roadmapById(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      const roadmap = b.roadmap || row.draft;
      if (!roadmap) return res.status(400).json({ error: 'nothing to publish' });

      const to = await publishRoadmap(id, roadmap);
      if (to) {
        const customer = await getCustomer(to);
        // Never let a failed email lose a published roadmap. It is in their
        // member area either way; the email is the nudge, not the delivery.
        sendRoadmapReady(to, { name: customer?.name, headline: roadmap.headline })
          .catch((err) => console.error('[admin/roadmaps] email', err?.message || err));
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'nothing to do' });
  } catch (err) {
    console.error('[admin/roadmaps]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function shape(r, full) {
  return {
    id: Number(r.id),
    email: r.email,
    name: r.name || null,
    status: r.status,
    model: r.model || null,
    error: r.error || null,
    hasDraft: full ? !!r.draft : !!r.has_draft,
    createdAt: r.created_at,
    generatedAt: r.generated_at,
    publishedAt: r.published_at,
    // The answers ride along only with the one being opened. In the list they
    // are eighteen answers per row that nothing on screen reads, and the list
    // is the call every tab switch makes.
    ...(full
      ? {
          answers: r.answers || {},
          answersText: answersAsText(r.answers || {}),
          draft: r.draft || null,
          published: r.published || null
        }
      : {})
  };
}

function safeJson(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
