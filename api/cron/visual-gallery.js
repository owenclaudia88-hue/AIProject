/**
 * The Visual Vault's collection prompts, rewritten a batch at a time.
 *
 * Every ten minutes this takes the next rows of library_gallery with no
 * rewrite yet and writes one for each into the row's `vault` column, as a
 * draft. The live `prompt` and `asset_key` stay as they are until publishing.
 * The pictures are made separately (visual-images.js), from these.
 *
 * `visual_gallery_run` ("on") switches it on, `visual_gallery_batch` sizes
 * it, `vault_model` names the model. A row whose rewrite throws is marked in
 * `vault.error` and skipped from then on.
 */
import { neon } from '@neondatabase/serverless';
import { getSettings } from '../../lib/db.js';
import { newMeter } from '../../lib/claude.js';
import { rewriteGalleryPrompt } from '../../lib/gallery.js';
import { VAULT_MODEL } from '../../lib/vault.js';

export const config = { maxDuration: 800 };
const BUDGET_S = 620;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'no_key', message: 'ANTHROPIC_API_KEY is not set.' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  const started = Date.now();

  try {
    const s = await getSettings();
    if (s.visual_gallery_run !== 'on' && !dry) {
      return res.status(200).json({ ok: true, skipped: 'visual_gallery_run is not "on"' });
    }
    const batch = Math.max(1, Math.min(150, Number(url.searchParams.get('batch')) || Number(s.visual_gallery_batch) || 60));
    const parallel = Math.max(1, Math.min(6, Number(s.visual_gallery_parallel) || 4));
    const model = String(s.vault_model || '').trim() || VAULT_MODEL;
    // Only the first N of each collection, when the set is being trimmed.
    const perCollection = Math.max(0, Number(s.visual_per_collection) || 0);

    const sql = neon(process.env.DATABASE_URL);
    await sql`alter table library_gallery add column if not exists vault jsonb`;
    await sql`alter table library_gallery add column if not exists original jsonb`;

    // Two queries rather than one with an optional clause: the driver cannot
    // splice a tagged fragment into another.
    const rows = perCollection
      ? await sql`select g.item_id, g.idx, g.prompt, l.title, l.description, l.meta
                  from library_gallery g join library l on l.id = g.item_id
                  where g.vault is null and g.idx < ${perCollection} order by g.item_id, g.idx limit ${batch}`
      : await sql`select g.item_id, g.idx, g.prompt, l.title, l.description, l.meta
                  from library_gallery g join library l on l.id = g.item_id
                  where g.vault is null order by g.item_id, g.idx limit ${batch}`;
    if (!rows.length) {
      console.log('[cron/visual-gallery] nothing left to rewrite');
      return res.status(200).json({ ok: true, done: 0, left: 0 });
    }

    const meter = newMeter();
    let done = 0, failed = 0, flagged = 0;
    const queue = [...rows];
    const sample = [];

    const worker = async () => {
      while (queue.length && (Date.now() - started) / 1000 < BUDGET_S) {
        const row = queue.shift();
        // The collection as it will be once published, if its frame is rebuilt.
        const v = row.meta?.vault;
        const collection = { title: v?.title || row.title, description: v?.description || row.description };
        try {
          const before = meter.total.usd;
          const { prompt, problems } = await rewriteGalleryPrompt(row, collection, { meter, model });
          const usd = Math.round((meter.total.usd - before) * 10000) / 10000;
          const draft = { prompt, model, usd, writtenAt: new Date().toISOString(), ...(problems.length ? { problems } : {}) };
          if (!dry) {
            await sql`update library_gallery set vault = ${JSON.stringify(draft)}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`;
          }
          done += 1;
          if (problems.length) flagged += 1;
          if (sample.length < 3) sample.push({ was: row.prompt, now: prompt, problems });
        } catch (err) {
          failed += 1;
          const message = String(err?.message || err).slice(0, 300);
          console.error(`[cron/visual-gallery] ${row.item_id}#${row.idx} failed: ${message}`);
          if (!dry) {
            await sql`update library_gallery set vault = ${JSON.stringify({ error: message })}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`
              .catch((e) => console.error('[cron/visual-gallery] could not record the failure', e.message));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, rows.length) }, worker));

    const [{ left }] = perCollection
      ? await sql`select count(*)::int as left from library_gallery where vault is null and idx < ${perCollection}`
      : await sql`select count(*)::int as left from library_gallery where vault is null`;

    const summary = { ok: true, dry, done, failed, flagged, left, cost: meter.total, ms: Date.now() - started, sample };
    console.log(`[cron/visual-gallery] ${done} rewritten, ${failed} failed, ${flagged} flagged, ${left} left; $${meter.total.usd} in ${Math.round(summary.ms / 1000)}s`);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[cron/visual-gallery]', err);
    return res.status(500).json({ error: 'server', message: String(err?.message || err).slice(0, 300) });
  }
}
