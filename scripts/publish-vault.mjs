/**
 * Puts the AI Prompt Vault rebuilds in front of members, or takes them back.
 *
 *   node --env-file=.env.local scripts/publish-vault.mjs            # what would change
 *   node --env-file=.env.local scripts/publish-vault.mjs --live     # do it
 *   node --env-file=.env.local scripts/publish-vault.mjs --revert   # put the old text back
 *   node --env-file=.env.local scripts/publish-vault.mjs --live --ids prompt:abc,prompt:def
 *
 * Publishing moves the rebuild's title, description, tags and text into the
 * live fields and keeps the old ones in `meta.original`, so a revert is a
 * copy back rather than a restore from backup. The rebuild itself stays in
 * `meta.vault` with `draft: false`, which is what tells the member area to
 * draw the Vault frame around it. Ids and dates never change: likes, saved
 * items, roadmaps and the new-tools email all keep pointing at the same rows.
 *
 * A rebuild the checker flagged is left alone unless `--flagged` is passed;
 * a prompt with a `vault_error` or no rebuild is always left alone.
 */
import { neon } from '@neondatabase/serverless';
import { VAULT_HOWTO } from '../lib/vault.js';

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const REVERT = args.includes('--revert');
const FLAGGED = args.includes('--flagged');
const only = (args[args.indexOf('--ids') + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
const ids = args.includes('--ids') ? only : null;

const sql = neon(process.env.DATABASE_URL);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
const where = ids ? ' and id = any($1)' : '';
const params = ids ? [ids] : [];

if (REVERT) {
  const rows = await sql(`select id, title, meta from library where kind = 'prompt' and meta ? 'original'${where}`, params);
  console.log(`${rows.length} published rebuild(s) to revert${LIVE ? '' : ' (dry run; pass --live)'}`);
  for (const r of rows) {
    const o = r.meta.original;
    console.log(`  "${r.title}" → "${o.title}"`);
    if (!LIVE) continue;
    const meta = { ...r.meta, howTo: o.howTo, promptItems: o.promptItems, promptType: o.promptType, vault: { ...r.meta.vault, draft: true } };
    delete meta.original;
    if (meta.howTo == null) delete meta.howTo;
    if (meta.promptItems == null) delete meta.promptItems;
    await sql`update library set title = ${o.title}, description = ${o.description}, body_html = ${o.body_html},
              tags = ${o.tags}, meta = ${JSON.stringify(meta)}::jsonb where id = ${r.id}`;
  }
  process.exit(0);
}

const rows = await sql(`
  select id, title, description, body_html, tags, meta from library
  where kind = 'prompt' and meta ? 'vault' and not (meta ? 'original') and not (meta ? 'vault_error')${where}
  order by sort, id`, params);

let done = 0, skipped = 0;
for (const r of rows) {
  const v = r.meta.vault;
  if (v.problems && v.problems.length && !FLAGGED) { skipped += 1; continue; }
  const steps = Array.isArray(v.steps) && v.steps.length ? v.steps : null;
  console.log(`  "${r.title}" → "${v.title}"${steps ? ` (${steps.length} steps)` : ''}`);
  if (!LIVE) { done += 1; continue; }

  const original = {
    title: r.title, description: r.description, body_html: r.body_html, tags: r.tags,
    promptItems: r.meta.promptItems ?? null, promptType: r.meta.promptType ?? null, howTo: r.meta.howTo ?? null
  };
  const meta = {
    ...r.meta,
    original,
    howTo: VAULT_HOWTO,
    promptType: steps ? 'stack' : 'single',
    promptItems: steps ? steps.map((s) => ({ title: s.title, content: briefHtml(s.brief) })) : [],
    vault: { ...v, draft: false, publishedAt: new Date().toISOString() }
  };
  const body = steps ? '' : briefHtml(v.brief);
  await sql`update library set title = ${v.title}, description = ${v.description}, body_html = ${body},
            tags = ${v.tags}, meta = ${JSON.stringify(meta)}::jsonb where id = ${r.id}`;
  done += 1;
}
console.log(`${done} ${LIVE ? 'published' : 'would be published'}, ${skipped} flagged and left as drafts${LIVE ? '' : ' (dry run; pass --live)'}`);
