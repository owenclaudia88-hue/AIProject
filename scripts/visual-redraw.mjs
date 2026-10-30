/**
 * Puts the pictures the audit turned down back in the drawing queue.
 *
 *   node scripts/visual-redraw.mjs            what would be redrawn
 *   node scripts/visual-redraw.mjs --live     queue them (then switch
 *                                             visual_images_run on)
 *   node scripts/visual-redraw.mjs --sync     after the redraw: put the new
 *                                             pictures onto the published sets
 *
 * A turned-down picture is kept under `vault.rejected` with the auditor's
 * reason; the next draw reads that reason. A row turned down twice is left
 * with its second picture and listed, for a person to look at.
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const SYNC = args.includes('--sync');

if (SYNC) {
  // A published set shows `asset_key`; a redraw lands in `vault.assetKey`.
  const rows = await sql`select g.item_id, g.idx, g.asset_key, g.vault->>'assetKey' new from library_gallery g join library l on l.id = g.item_id
                         where l.meta ? 'original' and g.original is not null and g.vault ? 'assetKey' and g.asset_key <> g.vault->>'assetKey'`;
  console.log(`${rows.length} published row(s) with a newer picture${LIVE ? '' : ' (dry run; pass --live)'}`);
  if (LIVE) {
    for (const r of rows) await sql`update library_gallery set asset_key = ${r.new} where item_id = ${r.item_id} and idx = ${r.idx}`;
    const thumbs = await sql`update library l set thumb_key = g.asset_key from library_gallery g
                             where g.item_id = l.id and g.idx = 0 and l.meta ? 'original' and l.thumb_key is distinct from g.asset_key returning l.id`;
    console.log(`${thumbs.length} cover picture(s) updated`);
  }
  process.exit(0);
}

const rows = await sql`select g.item_id, g.idx, g.vault, l.title from library_gallery g join library l on l.id = g.item_id
                       where (g.vault->'audit'->>'ok') = 'false' order by g.item_id, g.idx`;
const twice = rows.filter((r) => Array.isArray(r.vault.rejected) && r.vault.rejected.length >= 2);
const once = rows.filter((r) => !twice.includes(r));
console.log(`${once.length} picture(s) to redraw, ${twice.length} turned down twice and left as they are${LIVE ? '' : ' (dry run; pass --live)'}`);
for (const r of once) console.log(`  ${r.title} #${r.idx + 1}: ${r.vault.audit.reason}`);
for (const r of twice) console.log(`  (kept) ${r.title} #${r.idx + 1}: ${r.vault.audit.reason}`);
if (!LIVE) process.exit(0);

for (const r of once) {
  const v = r.vault;
  const rejected = [...(v.rejected || []), { assetKey: v.assetKey, imageModel: v.imageModel, imageUsd: v.imageUsd, reason: v.audit.reason, at: v.audit.at }];
  const next = { ...v, rejected };
  for (const k of ['assetKey', 'imageModel', 'imageUsd', 'imageTokens', 'drawnAt', 'audit', 'imageError']) delete next[k];
  await sql`update library_gallery set vault = ${JSON.stringify(next)}::jsonb where item_id = ${r.item_id} and idx = ${r.idx}`;
}
console.log(`${once.length} queued; switch visual_images_run on to draw them, visual_audit_run on to check them, then --sync`);
