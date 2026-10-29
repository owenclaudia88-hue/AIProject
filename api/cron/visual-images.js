/**
 * The Visual Vault's pictures, made a few at a time.
 *
 * For every collection row whose prompt has been rewritten and whose picture
 * has not been made yet, this asks an image model through OpenRouter for the
 * picture, stores it as a private library asset, and notes the key in the
 * row's `vault` column. The old picture stays in `asset_key` until publishing.
 *
 * OpenRouter rather than a generator's own API because the key is already on
 * the site and the model is a setting: `visual_image_model` picks it, so the
 * cheapest one that looks right wins without a deploy. `visual_images_run`
 * ("on") switches the job on, `visual_images_batch` sizes it, and
 * `visual_per_collection` limits how many of each set get a picture at all.
 *
 * A row whose picture fails is marked in `vault.imageError` and skipped from
 * then on; clearing that key puts it back in the queue.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { getSettings, upsertAsset } from '../../lib/db.js';
import { aspectOf } from '../../lib/gallery.js';

export const config = { maxDuration: 800 };
const BUDGET_S = 600;
const WIDTH = 1280;

const DEFAULT_MODEL = 'google/gemini-2.5-flash-image';

/** One picture from OpenRouter: the bytes, their type, and what it cost. */
async function generate(prompt, model, aspect) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://aifounderuniversity.com',
      'X-Title': 'AI Founder University'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `Generate one image, no text in it. ${prompt}` }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspect },
      usage: { include: true }
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const msg = body.choices?.[0]?.message || {};
  const img = (msg.images || []).find((i) => i?.image_url?.url) || null;
  if (!img) throw new Error(`no image in the reply (${String(msg.content || '').slice(0, 120) || 'empty'})`);
  const url = img.image_url.url;
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('the image came back as something other than base64');
  return {
    bytes: Buffer.from(m[2], 'base64'),
    type: m[1],
    usd: Number(body.usage?.cost ?? 0),
    tokens: body.usage?.completion_tokens ?? null
  };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'no_key', message: 'OPENROUTER_API_KEY is not set.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'no_blob', message: 'BLOB_READ_WRITE_TOKEN is not set.' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  const started = Date.now();

  try {
    const s = await getSettings();
    if (s.visual_images_run !== 'on' && !dry) {
      return res.status(200).json({ ok: true, skipped: 'visual_images_run is not "on"' });
    }
    const batch = Math.max(1, Math.min(60, Number(url.searchParams.get('batch')) || Number(s.visual_images_batch) || 12));
    const parallel = Math.max(1, Math.min(4, Number(s.visual_images_parallel) || 2));
    const model = String(s.visual_image_model || '').trim() || DEFAULT_MODEL;
    const perCollection = Math.max(0, Number(s.visual_per_collection) || 0);

    const sql = neon(process.env.DATABASE_URL);
    // Two queries rather than one with an optional clause: the driver cannot
    // splice a tagged fragment into another.
    const rows = perCollection
      ? await sql`select item_id, idx, vault from library_gallery
                  where vault ? 'prompt' and not (vault ? 'assetKey') and not (vault ? 'imageError') and idx < ${perCollection}
                  order by item_id, idx limit ${batch}`
      : await sql`select item_id, idx, vault from library_gallery
                  where vault ? 'prompt' and not (vault ? 'assetKey') and not (vault ? 'imageError')
                  order by item_id, idx limit ${batch}`;
    if (!rows.length) {
      console.log('[cron/visual-images] nothing left to draw');
      return res.status(200).json({ ok: true, done: 0, left: 0 });
    }

    let done = 0, failed = 0, usd = 0;
    const out = [];
    const queue = [...rows];

    const worker = async () => {
      while (queue.length && (Date.now() - started) / 1000 < BUDGET_S) {
        const row = queue.shift();
        const t0 = Date.now();
        try {
          const prompt = row.vault.prompt;
          const got = await generate(prompt, model, aspectOf(prompt));
          const webp = await sharp(got.bytes).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          const key = `vault/gallery/${row.item_id.replace(/[^a-z0-9]+/gi, '_')}/${row.idx}-${Date.now().toString(36)}.webp`;
          if (!dry) {
            const { url: blobUrl } = await put(`library-assets/${key}`, webp, {
              access: 'private', addRandomSuffix: true, contentType: 'image/webp', token: process.env.BLOB_READ_WRITE_TOKEN
            });
            await upsertAsset(key, blobUrl, 'image/webp');
            const add = { assetKey: key, imageModel: model, imageUsd: got.usd, imageTokens: got.tokens, drawnAt: new Date().toISOString() };
            await sql`update library_gallery set vault = vault || ${JSON.stringify(add)}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`;
          }
          done += 1;
          usd += got.usd;
          out.push({ id: `${row.item_id}#${row.idx}`, usd: got.usd, tokens: got.tokens, bytes: webp.length, s: Math.round((Date.now() - t0) / 1000) });
        } catch (err) {
          failed += 1;
          const message = String(err?.message || err).slice(0, 300);
          console.error(`[cron/visual-images] ${row.item_id}#${row.idx} failed: ${message}`);
          if (!dry) {
            await sql`update library_gallery set vault = vault || ${JSON.stringify({ imageError: message })}::jsonb where item_id = ${row.item_id} and idx = ${row.idx}`
              .catch((e) => console.error('[cron/visual-images] could not record the failure', e.message));
          }
          out.push({ id: `${row.item_id}#${row.idx}`, error: message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, rows.length) }, worker));

    const [{ left }] = perCollection
      ? await sql`select count(*)::int as left from library_gallery where vault ? 'prompt' and not (vault ? 'assetKey') and not (vault ? 'imageError') and idx < ${perCollection}`
      : await sql`select count(*)::int as left from library_gallery where vault ? 'prompt' and not (vault ? 'assetKey') and not (vault ? 'imageError')`;

    const summary = { ok: true, dry, model, done, failed, left, usd: Math.round(usd * 10000) / 10000, ms: Date.now() - started, items: out };
    console.log(`[cron/visual-images] ${done} drawn, ${failed} failed, ${left} left; $${summary.usd} on ${model} in ${Math.round(summary.ms / 1000)}s`);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[cron/visual-images]', err);
    return res.status(500).json({ error: 'server', message: String(err?.message || err).slice(0, 300) });
  }
}
