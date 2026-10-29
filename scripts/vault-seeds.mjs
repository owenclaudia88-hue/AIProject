/**
 * The Vault's own prompts: the ones that replace the 29 that came over with
 * somebody else's videos attached.
 *
 *   node --env-file=.env.local scripts/vault-seeds.mjs          # what would be added
 *   node --env-file=.env.local scripts/vault-seeds.mjs --live   # add them
 *
 * Each seed in vault-seeds.json is a job described in a paragraph, not a
 * finished prompt. It goes in as a library row only the test account and
 * staff can see, and the Vault rebuild (api/cron/vault.js) writes the actual
 * prompt from it the same way it rewrites the old ones. Publishing
 * (publish-vault.mjs) is what makes them visible to members.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIVE = process.argv.includes('--live');
const here = path.dirname(fileURLToPath(import.meta.url));
const seeds = JSON.parse(readFileSync(path.join(here, 'vault-seeds.json'), 'utf8'));
const sql = neon(process.env.DATABASE_URL);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const [{ s: top }] = await sql`select coalesce(max(sort), 0)::int as s from library where kind = 'prompt'`;
const have = new Set((await sql`select id from library where id like 'prompt:vault-%'`).map((r) => r.id));

let added = 0;
for (const [i, seed] of seeds.entries()) {
  const id = `prompt:vault-${seed.slug}`;
  if (have.has(id)) { console.log(`  already there: ${id}`); continue; }
  console.log(`  ${seed.category} | ${seed.title}`);
  if (!LIVE) { added += 1; continue; }
  await sql`
    insert into library (id, kind, category, title, description, body_html, tags, sort, meta, testers_only, draft)
    values (${id}, 'prompt', ${seed.category}, ${seed.title}, ${seed.description}, ${'<p>' + esc(seed.brief) + '</p>'},
            ${seed.tags}, ${top + i + 1}, ${JSON.stringify({ seed: true, promptType: 'single' })}::jsonb, true, false)`;
  added += 1;
}
console.log(`${added} ${LIVE ? 'added' : 'would be added'}, hidden from members until published${LIVE ? '' : ' (dry run; pass --live)'}`);
