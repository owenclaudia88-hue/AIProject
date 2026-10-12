/**
 * Take the old brand out of the content library.
 *
 *   node --env-file=.env.local _rebrand-library.mjs --dry
 *   node --env-file=.env.local _rebrand-library.mjs
 *   node --env-file=.env.local _rebrand-library.mjs --undo
 *
 * Every original is copied to brand_rewrite_backup first, so this is
 * reversible in one command. Four cases, and three of them are not a plain
 * find and replace:
 *
 *   the name       prose, headings and alt text        -> renamed
 *   their links    three "part two" links to their      -> pointed at our own
 *                  mini-courses, which we also hold        copies of those
 *   a storage key  meta.fileKey is where the file       -> left alone, or the
 *                  actually lives                          download breaks
 *   demo sites     four vercel.app builds a tutorial    -> left alone, and
 *                  made, which are the lesson's point      reported
 */
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');
const OLD = 'AI Black Magic';
const NEW = 'AI Founder University';

await sql`create table if not exists brand_rewrite_backup (
  id bigserial primary key, at timestamptz not null default now(),
  tbl text not null, row_id text not null, col text not null, old_value text)`;

if (UNDO) {
  const rows = await sql`select * from brand_rewrite_backup order by id desc`;
  for (const r of rows) {
    if (r.tbl === 'library_guides') {
      await sql`update library_guides set html = ${r.old_value} where item_id = ${r.row_id}`;
    } else if (r.tbl === 'library') {
      await sql`update library set meta = ${r.old_value}::jsonb where id = ${r.row_id}`;
    }
  }
  await sql`delete from brand_rewrite_backup`;
  console.log(`put ${rows.length} row(s) back as they were.`);
  process.exit(0);
}

const save = async (tbl, rowId, col, old) => {
  if (DRY) return;
  await sql`insert into brand_rewrite_backup (tbl, row_id, col, old_value)
            values (${tbl}, ${rowId}, ${col}, ${old})`;
};

/* The name, wherever it is read. "AIBM" only as a word, so the storage key
   bm/files/AIBM-….zip inside a meta blob is not caught by it. */
const rename = (s) => String(s)
  .replace(/AI Black Magic/g, NEW)
  .replace(/\bAIBM\b(?!-)/g, NEW);

let guides = 0, metas = 0, links = 0;

/* ---- the long-form bodies ---- */
const g = await sql`select item_id, html from library_guides where html like ${'%' + OLD + '%'} or html ~ '\\mAIBM\\M'`;
for (const r of g) {
  const next = rename(r.html);
  if (next === r.html) continue;
  await save('library_guides', r.item_id, 'html', r.html);
  if (!DRY) await sql`update library_guides set html = ${next} where item_id = ${r.item_id}`;
  guides++;
}

/* ---- the parts of meta a member reads ---- */
const TEXT_KEYS = ['heroText', 'supportingText', 'howTo', 'richHtml', 'videoText'];
const m = await sql`select id, title, meta from library
                     where meta::text ilike '%black magic%' or meta::text ilike '%aiblackmagic%'
                        or meta::text ~ '\\mAIBM\\M'`;

// Our own copies of the three mini-course parts they linked out to.
const parts = Object.fromEntries((await sql`
  select id, title from library where title ilike '%AI Terminologies Explained%'`)
  .map((p) => [p.title.replace(/.*Part\s*/i, '').trim(), p.id]));

for (const r of m) {
  const meta = { ...r.meta };
  let touched = false;

  for (const k of TEXT_KEYS) {
    if (typeof meta[k] !== 'string') continue;
    let v = rename(meta[k]);
    /* Their "part two" links, pointed at our own copy of part two. Sending a
       member to somebody else's paywall for the next lesson is worse than any
       name on a page, and we hold all four parts ourselves. */
    v = v.replace(/https?:\/\/(?:www\.)?aiblackmagic\.com\/mini-courses\/ai-terminologies-explained---part-(\d)/gi,
      (whole, n) => {
        const id = parts[n];
        if (!id) return whole;
        links++;
        return `/members/#item-${id}`;
      });
    if (v !== meta[k]) { meta[k] = v; touched = true; }
  }

  // The download's display name, never its storage key.
  if (typeof meta.fileName === 'string' && /AIBM/i.test(meta.fileName)) {
    meta.fileName = meta.fileName.replace(/AIBM/gi, 'AI-Founder-University');
    touched = true;
  }

  if (!touched) continue;
  await save('library', r.id, 'meta', JSON.stringify(r.meta));
  if (!DRY) await sql`update library set meta = ${JSON.stringify(meta)}::jsonb where id = ${r.id}`;
  metas++;
  console.log(`  ${DRY ? 'would fix' : 'fixed'}: ${r.title}`);
}

console.log(`\n${DRY ? 'would change' : 'changed'}: ${guides} guide(s), ${metas} item meta, ${links} outbound link(s) pointed inward`);

/* ---- what is deliberately left ---- */
const left = await sql`
  select item_id, (regexp_matches(html, '(?:src|href)="([^"]*aiblackmagic[^"]*)"', 'g'))[1] as url
    from library_guides where html ~* '(src|href)="[^"]*aiblackmagic'`;
if (left.length) {
  console.log('\nleft alone — demo sites a tutorial built, which are the lesson:');
  for (const l of left) console.log('   ', l.url);
}
const keys = await sql`select id, meta->>'fileKey' as k from library where meta->>'fileKey' ilike '%AIBM%'`;
for (const k of keys) console.log(`\nleft alone — a storage key, renaming it breaks the download:\n    ${k.k}`);

console.log('\nstill mentioning them anywhere a member reads:');
const rest = await sql`
  select count(*)::int as guides from library_guides where html ilike '%black magic%'`;
const rest2 = await sql`
  select count(*)::int as metas from library
   where meta->>'heroText' ilike '%black magic%' or meta->>'supportingText' ilike '%black magic%'`;
console.log('  guides:', rest[0].guides, '| item meta:', rest2[0].metas);
