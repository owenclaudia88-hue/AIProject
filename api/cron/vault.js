/**
 * The AI Prompt Vault rebuild, a batch at a time.
 *
 * Every ten minutes this takes the next few prompts that have no rebuild yet
 * and writes one for each into `meta.vault`, as a draft. Members see nothing
 * change: the live fields are untouched until publishing, which is a separate
 * decision taken after the drafts have been read.
 *
 * Switched on and off with the `vault_run` setting ("on" to run), sized with
 * `vault_batch`, and given its model by `vault_model`, so the run can be
 * stopped or changed from the database without a deploy, and started small to
 * look at the first few before the rest.
 *
 * A prompt whose rebuild throws is marked in `meta.vault_error` and skipped
 * from then on, rather than tried again on every run. Clearing that key puts
 * it back in the queue.
 */
import { neon } from '@neondatabase/serverless';
import { getSettings } from '../../lib/db.js';
import { newMeter } from '../../lib/claude.js';
import { rebuildPrompt, VAULT_MODEL } from '../../lib/vault.js';

/* A rebuild on the strongest model is around a minute, two with a retry, and a
   batch runs a few at a time; the default 300 seconds would cut the batch
   short and lose what was in flight. */
export const config = { maxDuration: 800 };

/* No new rebuild starts after this many seconds, so the ones running have room
   to finish and save before the function is stopped. */
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
    if (s.vault_run !== 'on' && !dry) {
      return res.status(200).json({ ok: true, skipped: 'vault_run is not "on"' });
    }
    const batch = Math.max(1, Math.min(30, Number(url.searchParams.get('batch')) || Number(s.vault_batch) || 12));
    const parallel = Math.max(1, Math.min(5, Number(s.vault_parallel) || 3));
    const model = String(s.vault_model || '').trim() || VAULT_MODEL;

    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      select id, category, title, description, body_html, meta
      from library
      where kind = 'prompt'
        and not (coalesce(meta, '{}'::jsonb) ? 'vault')
        and not (coalesce(meta, '{}'::jsonb) ? 'vault_error')
        and coalesce(meta, '{}'::jsonb)->>'videoUrl' is null
      order by sort, id
      limit ${batch}`;
    if (!rows.length) {
      console.log('[cron/vault] nothing left to rebuild');
      return res.status(200).json({ ok: true, done: 0, left: 0 });
    }

    const meter = newMeter();
    let done = 0, failed = 0, flagged = 0;
    const out = [];
    const queue = [...rows];

    const worker = async () => {
      while (queue.length && (Date.now() - started) / 1000 < BUDGET_S) {
        const row = queue.shift();
        const t0 = Date.now();
        try {
          const before = meter.total.usd;
          const { vault, problems } = await rebuildPrompt(row, { meter, model });
          const usd = Math.round((meter.total.usd - before) * 100) / 100;
          const draft = {
            ...vault, draft: true, by: 'claude', model, usd,
            writtenAt: new Date().toISOString(),
            ...(problems.length ? { problems } : {})
          };
          if (!dry) {
            await sql`update library set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('vault', ${JSON.stringify(draft)}::jsonb)
                      where id = ${row.id}`;
          }
          done += 1;
          if (problems.length) flagged += 1;
          out.push({ id: row.id, was: row.title, now: vault.title, s: Math.round((Date.now() - t0) / 1000), usd, problems });
          console.log(`[cron/vault] "${row.title}" → "${vault.title}" in ${Math.round((Date.now() - t0) / 1000)}s`
            + (problems.length ? ` (flagged: ${problems.join('; ')})` : ''));
        } catch (err) {
          failed += 1;
          const message = String(err?.message || err).slice(0, 300);
          console.error(`[cron/vault] "${row.title}" failed: ${message}`);
          if (!dry) {
            await sql`update library set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('vault_error', ${message}::text)
                      where id = ${row.id}`.catch((e) => console.error('[cron/vault] could not record the failure', e.message));
          }
          out.push({ id: row.id, was: row.title, error: message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, rows.length) }, worker));

    const [{ left }] = await sql`
      select count(*)::int as left from library
      where kind = 'prompt'
        and not (coalesce(meta, '{}'::jsonb) ? 'vault')
        and not (coalesce(meta, '{}'::jsonb) ? 'vault_error')
        and coalesce(meta, '{}'::jsonb)->>'videoUrl' is null`;

    const summary = { ok: true, dry, done, failed, flagged, left, cost: meter.total, ms: Date.now() - started, items: out };
    console.log(`[cron/vault] ${done} rebuilt, ${failed} failed, ${flagged} flagged, ${left} left; $${meter.total.usd} in ${Math.round(summary.ms / 1000)}s`);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[cron/vault]', err);
    return res.status(500).json({ error: 'server', message: String(err?.message || err).slice(0, 300) });
  }
}
