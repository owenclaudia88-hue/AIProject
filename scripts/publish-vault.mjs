/**
 * Puts a Vault's rebuilds in front of members, or takes them back.
 *
 *   node --env-file=.env.local scripts/publish-vault.mjs                       # what would change (AI Prompt Vault)
 *   node --env-file=.env.local scripts/publish-vault.mjs --live                # do it
 *   node --env-file=.env.local scripts/publish-vault.mjs --kind image_prompt   # the AI Visual Vault instead
 *   node --env-file=.env.local scripts/publish-vault.mjs --revert              # put the old text back
 *   node --env-file=.env.local scripts/publish-vault.mjs --live --ids prompt:abc,prompt:def
 *
 * Publishing moves the rebuild's title, description, tags and text into the
 * live fields and keeps the old ones in `meta.original`, so a revert is a
 * copy back rather than a restore from backup. The rebuild itself stays in
 * `meta.vault` with `draft: false`, which is what tells the member area to
 * draw the Vault frame around it. Ids and dates never change: likes, saved
 * items, roadmaps and the new-tools email all keep pointing at the same rows.
 *
 * For the Visual Vault, a collection's rows go too: each row's rewritten
 * prompt and new picture replace the old ones (the old pair kept in the row's
 * `original`), the collection's cover becomes its first new picture, and rows
 * past the trimmed size — the ones that were never rewritten — are deleted,
 * with a copy written to disk first. The old library's tutorial videos on an
 * entry are dropped the same way.
 *
 * A rebuild the checker flagged is left alone unless `--flagged` is passed;
 * a prompt with a `vault_error` or no rebuild is always left alone.
 */
import { neon } from '@neondatabase/serverless';
import { writeFileSync, mkdirSync } from 'node:fs';
import { HOWTO } from '../lib/vault.js';
export { VAULT_HOWTO } from '../lib/vault.js';

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const REVERT = args.includes('--revert');
const FLAGGED = args.includes('--flagged');
const KIND = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : 'prompt';
if (!['prompt', 'image_prompt'].includes(KIND)) throw new Error('--kind must be prompt or image_prompt');
const only = (args[args.indexOf('--ids') + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
const ids = args.includes('--ids') ? only : null;

const sql = neon(process.env.DATABASE_URL);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stamp = new Date().toISOString().slice(0, 10);

/* Paragraphs for blank-line breaks, <br> for single ones, and the [blanks]
   marked so the member area can light them up. The copy button reads the
   panel's text, so the marks never reach the clipboard. */
export function briefHtml(text) {
  return String(text || '').trim().split(/\n{2,}/).map((para) =>
    '<p>' + esc(para).replace(/\[([^\]\n]{1,160})\]/g, '<mark class="blank">[$1]</mark>').replace(/\n/g, '<br>') + '</p>'
  ).join('');
}

/* Plain text and parameters, because a tagged query cannot take an optional
   fragment: the driver has no way to splice one tagged piece into another. */
const where = ids ? ' and id = any($2)' : '';
const params = ids ? [KIND, ids] : [KIND];

if (REVERT) {
  const rows = await sql(`select id, title, meta from library where kind = $1 and meta ? 'original'${where}`, params);
  console.log(`${rows.length} published rebuild(s) to revert${LIVE ? '' : ' (dry run; pass --live)'}`);
  for (const r of rows) {
    const o = r.meta.original;
    console.log(`  "${r.title}" → "${o.title}"`);
    if (!LIVE) continue;
    const meta = { ...r.meta, howTo: o.howTo, promptItems: o.promptItems, promptType: o.promptType, videoUrl: o.videoUrl, videoText: o.videoText, galleryVideos: o.galleryVideos, vault: { ...r.meta.vault, draft: true } };
    delete meta.original;
    for (const k of Object.keys(meta)) if (meta[k] == null) delete meta[k];
    await sql`update library set title = ${o.title}, description = ${o.description}, body_html = ${o.body_html},
              tags = ${o.tags}, thumb_key = ${o.thumb_key ?? null}, meta = ${JSON.stringify(meta)}::jsonb where id = ${r.id}`;
    if (KIND === 'image_prompt') {
      await sql`update library_gallery set prompt = original->>'prompt', asset_key = original->>'asset_key', original = null
                where item_id = ${r.id} and original is not null`;
    }
  }
  if (KIND === 'image_prompt') console.log('Note: collection rows deleted at publish are not restored; their copy is under Claude outputs/vault/.');
  process.exit(0);
}

const rows = await sql(`
  select id, title, description, body_html, tags, thumb_key, meta from library
  where kind = $1 and meta ? 'vault' and not (meta ? 'original') and not (meta ? 'vault_error')${where}
  order by sort, id`, params);

let done = 0, skipped = 0, trimmed = 0;
const backup = [];
for (const r of rows) {
  const v = r.meta.vault;
  if (v.problems && v.problems.length && !FLAGGED) { skipped += 1; continue; }
  const collection = !!v.collection;
  const steps = !collection && Array.isArray(v.steps) && v.steps.length ? v.steps : null;

  // A collection goes live only when every kept row has both a new prompt
  // and a new picture; half a set would show old pictures under new words.
  let gallery = [];
  if (collection) {
    gallery = await sql`select idx, prompt, asset_key, vault, original from library_gallery where item_id = ${r.id} order by idx`;
    const kept = gallery.filter((g) => g.vault?.prompt && g.vault?.assetKey);
    const waiting = gallery.filter((g) => g.vault?.prompt && !g.vault?.assetKey && !g.vault?.imageError);
    if (!kept.length || waiting.length) { skipped += 1; console.log(`  (waiting) "${r.title}": ${kept.length} ready, ${waiting.length} still to draw`); continue; }
  }

  console.log(`  "${r.title}" → "${v.title}"${steps ? ` (${steps.length} parts)` : ''}${collection ? ` (collection: ${gallery.filter((g) => g.vault?.assetKey).length} of ${gallery.length} rows kept)` : ''}`);
  if (!LIVE) { done += 1; continue; }

  const original = {
    title: r.title, description: r.description, body_html: r.body_html, tags: r.tags, thumb_key: r.thumb_key ?? null,
    promptItems: r.meta.promptItems ?? null, promptType: r.meta.promptType ?? null, howTo: r.meta.howTo ?? null,
    videoUrl: r.meta.videoUrl ?? null, videoText: r.meta.videoText ?? null, galleryVideos: r.meta.galleryVideos ?? null
  };
  const meta = {
    ...r.meta,
    original,
    howTo: HOWTO[KIND],
    promptType: steps ? 'stack' : 'single',
    promptItems: steps ? steps.map((s) => ({ title: s.title, content: briefHtml(s.brief) })) : [],
    vault: { ...v, draft: false, publishedAt: new Date().toISOString() }
  };
  // The old library's own tutorial videos do not come along.
  delete meta.videoUrl; delete meta.videoText; delete meta.galleryVideos;
  const body = steps || collection ? '' : briefHtml(v.brief);
  let thumb = r.thumb_key ?? null;

  if (collection) {
    for (const g of gallery) {
      if (g.vault?.prompt && g.vault?.assetKey) {
        await sql`update library_gallery set prompt = ${g.vault.prompt}, asset_key = ${g.vault.assetKey},
                  original = coalesce(original, ${JSON.stringify({ prompt: g.prompt, asset_key: g.asset_key })}::jsonb)
                  where item_id = ${r.id} and idx = ${g.idx}`;
      } else {
        backup.push({ item_id: r.id, idx: g.idx, prompt: g.prompt, asset_key: g.asset_key, vault: g.vault });
        await sql`delete from library_gallery where item_id = ${r.id} and idx = ${g.idx}`;
        trimmed += 1;
      }
    }
    thumb = gallery.find((g) => g.vault?.assetKey)?.vault.assetKey ?? thumb;
  }

  await sql`update library set title = ${v.title}, description = ${v.description}, body_html = ${body},
            tags = ${v.tags}, thumb_key = ${thumb}, meta = ${JSON.stringify(meta)}::jsonb,
            testers_only = case when meta ? 'seed' then false else testers_only end
            where id = ${r.id}`;
  done += 1;
}
if (backup.length) {
  mkdirSync('Claude outputs/vault', { recursive: true });
  const file = `Claude outputs/vault/trimmed-gallery-rows-${stamp}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`  ${trimmed} collection row(s) past the trimmed size deleted; copy kept at ${file}`);
}
console.log(`${done} ${LIVE ? 'published' : 'would be published'}, ${skipped} flagged or waiting and left as drafts${LIVE ? '' : ' (dry run; pass --live)'}`);

/* The 29 that arrived with the old library's videos attached are not rebuilt;
   they are retired, and the Vault's own prompts take their place. Nothing
   else refers to them (no guide, no gallery), so a delete is clean, but a
   copy goes to disk first in case anybody ever wants a title back. */
if (args.includes('--retire-videos')) {
  const gone = await sql`select * from library where kind = ${KIND} and meta->>'videoUrl' is not null and not (meta ? 'vault')`;
  console.log(`${gone.length} prompt(s) with the old videos to retire${LIVE ? '' : ' (dry run)'}`);
  for (const r of gone) console.log(`  ${r.category} | ${r.title}`);
  if (LIVE && gone.length) {
    mkdirSync('Claude outputs/vault', { recursive: true });
    const file = `Claude outputs/vault/retired-video-${KIND}-${stamp}.json`;
    writeFileSync(file, JSON.stringify(gone, null, 2));
    await sql`delete from library where kind = ${KIND} and meta->>'videoUrl' is not null and not (meta ? 'vault')`;
    console.log(`  deleted; copy kept at ${file}`);
  }
}
