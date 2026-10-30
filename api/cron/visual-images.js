/**
 * The Visual Vault's pictures, made a few at a time.
 *
 * For every collection row whose prompt has been rewritten and whose picture
 * has not been made yet, this asks an image model through OpenRouter for the
 * picture, stores it as a private library asset, and notes the key in the
 * row's `vault` column. The old picture stays in `asset_key` until publishing.
 *
 * Two ways to a picture, chosen by the model's name in the `visual_image_model`
 * setting: a `fal-ai/...` model (Flux, through fal.ai) or anything else
 * through OpenRouter (Gemini). Both keys are on the site, so the cheapest
 * model that looks right wins without a deploy. `visual_images_run` ("on")
 * switches the job on, `visual_images_batch` sizes it, and
 * `visual_per_collection` limits how many of each set get a picture at all.
 *
 * `?compare=1` draws rows that already have a picture, with whatever model
 * is set, and files the result under `vault.compare[model]` beside the
 * first one, for putting two models side by side before choosing.
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

/* fal.ai's named sizes for the shapes a prompt asks for. */
const FAL_SIZE = { '1:1': 'square_hd', '4:5': 'portrait_4_3', '3:4': 'portrait_4_3', '2:3': 'portrait_4_3', '9:16': 'portrait_16_9',
                   '16:9': 'landscape_16_9', '21:9': 'landscape_16_9', '3:2': 'landscape_4_3', '4:3': 'landscape_4_3', '5:4': 'landscape_4_3' };
/* fal.ai does not say what a call cost; these are its listed prices per
   megapixel, so the figure stored is an estimate to a fraction of a cent. */
const FAL_USD_PER_MP = { 'fal-ai/flux/schnell': 0.003, 'fal-ai/flux/dev': 0.025, 'fal-ai/flux-pro/v1.1': 0.04, 'fal-ai/flux-pro': 0.05 };
/* fal.ai also hosts Google's image model, priced per picture rather than per
   megapixel, and it takes an aspect ratio rather than a named size. */
const FAL_PER_IMAGE = { 'fal-ai/gemini-25-flash-image': 0.039, 'fal-ai/nano-banana': 0.039 };

/* What a provider says when the account behind its key has run dry. */
const OUT_OF_CREDIT = /\b(402|403|insufficient|credit|balance|quota|billing|exhausted|payment required|locked|top.?up)\b/i;

/** One picture from fal.ai (Flux): the bytes, their type, and roughly what it cost. */
async function generateFal(prompt, model, aspect) {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY is not set');
  const perImage = Object.entries(FAL_PER_IMAGE).find(([k]) => model.startsWith(k))?.[1];
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(perImage
      ? { prompt, num_images: 1, aspect_ratio: aspect, output_format: 'jpeg' }
      : { prompt, image_size: FAL_SIZE[aspect] || 'square_hd', num_images: 1, output_format: 'jpeg', enable_safety_checker: true })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const img = body.images?.[0];
  if (!img?.url) throw new Error('no image in the reply');
  const file = await fetch(img.url);
  if (!file.ok) throw new Error(`could not fetch the picture: ${file.status}`);
  const mp = ((img.width || 1024) * (img.height || 1024)) / 1e6;
  const rate = Object.entries(FAL_USD_PER_MP).find(([k]) => model.startsWith(k))?.[1] ?? 0.025;
  const usd = perImage ?? Math.round(mp * rate * 10000) / 10000;
  return { bytes: Buffer.from(await file.arrayBuffer()), type: img.content_type || 'image/jpeg', usd, tokens: null };
}

/** One picture from OpenRouter: the bytes, their type, and what it cost. */
async function generateOpenRouter(prompt, model, aspect) {
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
    const compare = url.searchParams.get('compare') === '1';
    const isFal = (m) => m.startsWith('fal-ai/');
    if (isFal(model) && !process.env.FAL_KEY) return res.status(503).json({ error: 'no_key', message: 'FAL_KEY is not set.' });
    if (!isFal(model) && !process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'no_key', message: 'OPENROUTER_API_KEY is not set.' });
    // When the account behind one key runs dry, the other provider carries on:
    // `visual_image_fallback` names the model there, and the row records which
    // one actually drew it.
    const fallback = String(s.visual_image_fallback || '').trim() || (isFal(model) ? DEFAULT_MODEL : 'fal-ai/flux-pro/v1.1');
    // A collection may name its own model in `meta.imageModel`: charts, labels,
    // logos and anything with words in it come out of Gemini and not of Flux.
    const draw = async (prompt, aspect, model) => {
      const gen = (m) => (isFal(m) ? generateFal : generateOpenRouter)(prompt, m, aspect);
      try {
        return { ...(await gen(model)), model };
      } catch (err) {
        const msg = String(err?.message || err);
        const otherKey = isFal(fallback) ? process.env.FAL_KEY : process.env.OPENROUTER_API_KEY;
        if (!OUT_OF_CREDIT.test(msg) || !otherKey || fallback === model) throw err;
        console.error(`[cron/visual-images] ${model} is out of credit (${msg.slice(0, 120)}); drawing with ${fallback}`);
        return { ...(await gen(fallback)), model: fallback };
      }
    };

    const sql = neon(process.env.DATABASE_URL);
    // Two queries rather than one with an optional clause: the driver cannot
    // splice a tagged fragment into another.
    // The collection's name and line go in front of every prompt: a row's
    // prompt describes one picture, and the set it belongs to is what keeps
    // a "double exposure" from coming back as a plain portrait.
    const rows = compare
      ? await sql`select g.item_id, g.idx, g.vault, l.title, l.description, l.meta from library_gallery g join library l on l.id = g.item_id
                  where g.vault ? 'prompt' order by g.item_id, g.idx limit ${batch}`
      : perCollection
      ? await sql`select g.item_id, g.idx, g.vault, l.title, l.description, l.meta from library_gallery g join library l on l.id = g.item_id
                  where g.vault ? 'prompt' and not (g.vault ? 'assetKey') and not (g.vault ? 'imageError') and g.idx < ${perCollection}
                  order by g.item_id, g.idx limit ${batch}`
      : await sql`select g.item_id, g.idx, g.vault, l.title, l.description, l.meta from library_gallery g join library l on l.id = g.item_id
                  where g.vault ? 'prompt' and not (g.vault ? 'assetKey') and not (g.vault ? 'imageError')
                  order by g.item_id, g.idx limit ${batch}`;
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
          const v = row.meta?.vault;
          const setLine = `From a set called "${v?.title || row.title}": ${v?.description || row.description || ''}`.trim();
          // A picture drawn again after the audit turned the first one down
          // carries the reason, so the second try does not repeat the first.
          const turned = Array.isArray(row.vault.rejected) ? row.vault.rejected[row.vault.rejected.length - 1] : null;
          const note = turned?.reason ? `\n\nThe last attempt was rejected because: ${turned.reason}. The picture must unmistakably be what the set promises.` : '';
          const got = await draw(setLine + '\n\n' + prompt + note, aspectOf(prompt), String(row.meta?.imageModel || '').trim() || model);
          const webp = await sharp(got.bytes).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          const key = `vault/gallery/${row.item_id.replace(/[^a-z0-9]+/gi, '_')}/${row.idx}-${Date.now().toString(36)}.webp`;
          if (!dry) {
            const { url: blobUrl } = await put(`library-assets/${key}`, webp, {
              access: 'private', addRandomSuffix: true, contentType: 'image/webp', token: process.env.BLOB_READ_WRITE_TOKEN
            });
            await upsertAsset(key, blobUrl, 'image/webp');
            const add = compare
              ? { compare: { ...(row.vault.compare || {}), [got.model]: { assetKey: key, usd: got.usd } } }
              : { assetKey: key, imageModel: got.model, imageUsd: got.usd, imageTokens: got.tokens, drawnAt: new Date().toISOString() };
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
