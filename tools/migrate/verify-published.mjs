/**
 * The last word, asked of the database rather than of the export.
 *
 * Everything before this checked what we fetched. This checks what a member
 * would open: the row as it now sits in `library`, and whether the picture and
 * the download it points at are really in storage. An item that fails here is
 * hidden again at once — marked draft, which takes it out of every shelf and
 * every search while leaving it on file to look at.
 *
 * Nobody is reviewing these before they go out, so this is the thing standing
 * between a member and a page with a broken picture on it.
 */
import { neon } from '@neondatabase/serverless';
import { checkStored } from './check-item.mjs';

export async function verifyPublished({ since, held = [] } = {}) {
  const sql = neon(process.env.DATABASE_URL);

  /* The long-form body and the gallery tiles live in their own tables, so they
     are read here and handed to the check. Looking only at `library` is what
     let seven blank pages through. */
  const added = await sql`
    select l.id, l.kind, l.title, l.description, l.body_html, l.thumb_key, l.meta,
           l.source_created_at,
           length(coalesce(g.html, '')) as guide_chars,
           (select count(*)::int from library_gallery p where p.item_id = l.id) as gallery_tiles
      from library l
      left join library_guides g on g.item_id = l.id
     where l.source_created_at >= ${since}
       and l.id ~ '^(prompt|image_prompt|skill|gpt|automation|guide|video):'
     order by l.source_created_at`;

  if (!added.length) {
    console.log('\nNothing new in the library. Either it was all held, or the ingest added nothing.\n');
    return { added: 0, hidden: 0, held };
  }

  // Every asset key those rows point at, resolved in one query rather than one
  // per item.
  const keys = [...new Set(added.flatMap((r) => [r.thumb_key, r.meta?.fileKey].filter(Boolean)))];
  const found = keys.length
    ? new Set((await sql`select key from library_assets where key = any(${keys}::text[])`).map((r) => r.key))
    : new Set();

  const bad = [];
  for (const item of added) {
    const problems = checkStored(item, found, {
      guideChars: Number(item.guide_chars) || 0,
      galleryTiles: Number(item.gallery_tiles) || 0
    });
    if (problems.length) bad.push({ item, problems });
  }

  // Out of sight immediately. A member seeing a broken item is worse than a
  // member not seeing it at all, and it stays on file either way.
  for (const b of bad) {
    await sql`update library set draft = true where id = ${b.item.id}`;
  }

  /* ---- what happened, in the order somebody would want to read it ---- */
  console.log(`\n${'='.repeat(58)}`);
  console.log(`  ${added.length - bad.length} item(s) published`);
  if (bad.length) console.log(`  ${bad.length} hidden again after publishing`);
  if (held.length) console.log(`  ${held.length} never left the source site`);
  console.log('='.repeat(58));

  const live = added.filter((a) => !bad.some((b) => b.item.id === a.id));
  if (live.length) {
    console.log('\nNow in the member area:');
    for (const i of live) {
      console.log(`  ${i.kind.padEnd(13)} ${String(i.title).slice(0, 56)}`);
    }
  }
  if (bad.length) {
    console.log('\nHidden — published, then found wanting:');
    for (const b of bad) {
      console.log(`  ${String(b.item.title).slice(0, 48)} — ${b.problems.join('; ')}`);
    }
  }
  if (held.length) {
    console.log('\nHeld before publishing:');
    for (const h of held) {
      console.log(`  ${String(h.title).slice(0, 48)} — ${h.problems.join('; ')}`);
    }
  }
  console.log('');
  return { added: live.length, hidden: bad.length, held };
}
