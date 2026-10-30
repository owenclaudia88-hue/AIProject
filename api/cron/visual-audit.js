/**
 * A look at every new Visual Vault picture before members see it.
 *
 * A generator draws what it can, not what it was asked: a set of charts came
 * back as glass doughnuts on plinths. Each picture is shown to Claude beside
 * its prompt and the name of the set it sits in, and the answer goes in the
 * row's `vault.audit` ({ ok, reason }). A picture that fails is redrawn by
 * scripts/visual-redraw.mjs, on a model better suited to the set.
 *
 * `visual_audit_run` ("on") switches the job on, `visual_audit_batch` sizes
 * it. Rows already judged are left alone; clearing `vault.audit` asks again.
 */
import { neon } from '@neondatabase/serverless';
import { get } from '@vercel/blob';
import sharp from 'sharp';
import { getSettings, getAsset } from '../../lib/db.js';
import { callTool, newMeter } from '../../lib/claude.js';
import { VAULT_MODEL } from '../../lib/vault.js';

export const config = { maxDuration: 800 };
const BUDGET_S = 600;

const TOOL = {
  name: 'picture_check',
  description: 'Deliver the verdict on the picture. Always answer by calling this.',
  input_schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: 'true when the picture shows what the prompt asks for and belongs in the set' },
      reason: { type: 'string', description: 'Under 25 words: what it shows, and what is missing or wrong if anything' }
    },
    required: ['ok', 'reason']
  }
};

const question = (title, description, prompt) => `This picture is one of a set called "${title}" (${description}).
It was generated from this prompt:
"""
${prompt}
"""
Judge it strictly as a member who paid for the set would. It passes only if the picture shows the
kind of thing the set promises and the main subject the prompt describes: a chart set must show a
readable chart with bars, lines or slices and not an abstract sculpture; a logo, label, packaging,
poster, thumbnail, screenshot or mockup set must show that object with any words legible and not
garbled; a style set (woodblock, cyanotype, risograph, double exposure, low poly...) must show that
style unmistakably. Composition, palette and minor details do not matter. Garbled text, a plain
photo where a style was asked for, or the wrong kind of object fails it.
Call picture_check with ok and a short reason.`;

async function bytesOf(key) {
  const asset = await getAsset(key);
  if (!asset) throw new Error('asset not found');
  const result = await get(asset.blob_url, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('blob unavailable');
  const chunks = [];
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  const started = Date.now();

  try {
    const s = await getSettings();
    if (s.visual_audit_run !== 'on' && !dry) {
      return res.status(200).json({ ok: true, skipped: 'visual_audit_run is not "on"' });
    }
    const batch = Math.max(1, Math.min(80, Number(url.searchParams.get('batch')) || Number(s.visual_audit_batch) || 40));
    const parallel = Math.max(1, Math.min(4, Number(s.visual_audit_parallel) || 4));
    const model = String(s.vault_model || '').trim() || VAULT_MODEL;
    const cap = Math.max(0, Number(s.visual_per_collection) || 0);

    const sql = neon(process.env.DATABASE_URL);
    const rows = cap
      ? await sql`select g.item_id, g.idx, g.vault, l.title, l.description, l.meta from library_gallery g join library l on l.id = g.item_id
                  where g.vault ? 'assetKey' and not (g.vault ? 'audit') and g.idx < ${cap} order by g.item_id, g.idx limit ${batch}`
      : await sql`select g.item_id, g.idx, g.vault, l.title, l.description, l.meta from library_gallery g join library l on l.id = g.item_id
                  where g.vault ? 'assetKey' and not (g.vault ? 'audit') order by g.item_id, g.idx limit ${batch}`;
    if (!rows.length) {
      console.log('[cron/visual-audit] nothing left to look at');
      return res.status(200).json({ ok: true, done: 0, left: 0 });
    }

    const meter = newMeter();
    let done = 0, failed = 0, rejected = 0;
    const out = [];
    const queue = [...rows];
    const worker = async () => {
      while (queue.length && (Date.now() - started) / 1000 < BUDGET_S) {
        const row = queue.shift();
        try {
          const v = row.meta?.vault;
          const title = v?.title || row.title;
          const description = v?.description || row.description || '';
          // Small enough to be cheap to look at, large enough to read a label.
          const jpeg = await sharp(await bytesOf(row.vault.assetKey)).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
          const content = [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
            { type: 'text', text: question(title, description, row.vault.prompt) }
          ];
          const { data } = await callTool(content, TOOL, { maxTokens: 400, meter, model });
          if (!data || typeof data.ok !== 'boolean') throw new Error('no verdict');
          const audit = { ok: data.ok, reason: String(data.reason || '').slice(0, 300), model, at: new Date().toISOString() };
          if (!dry) {
            await sql`update library_gallery set vault = vault || ${JSON.stringify({ audit })}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`;
          }
          done += 1;
          if (!data.ok) rejected += 1;
          out.push({ id: `${row.item_id}#${row.idx}`, ...audit });
        } catch (err) {
          failed += 1;
          const message = String(err?.message || err).slice(0, 300);
          console.error(`[cron/visual-audit] ${row.item_id}#${row.idx} failed: ${message}`);
          if (!dry) {
            await sql`update library_gallery set vault = vault || ${JSON.stringify({ audit: { error: message } })}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`
              .catch((e) => console.error('[cron/visual-audit] could not record the failure', e.message));
          }
          out.push({ id: `${row.item_id}#${row.idx}`, error: message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, rows.length) }, worker));

    const [{ left }] = cap
      ? await sql`select count(*)::int as left from library_gallery where vault ? 'assetKey' and not (vault ? 'audit') and idx < ${cap}`
      : await sql`select count(*)::int as left from library_gallery where vault ? 'assetKey' and not (vault ? 'audit')`;
    console.log(`[cron/visual-audit] ${done} looked at, ${rejected} rejected, ${failed} failed, ${left} left, $${meter.total.usd}`);
    return res.status(200).json({ ok: true, dry, done, rejected, failed, left, usd: meter.total.usd, ms: Date.now() - started, items: out });
  } catch (err) {
    console.error('[cron/visual-audit]', err);
    return res.status(500).json({ error: 'failed', message: String(err?.message || err) });
  }
}
