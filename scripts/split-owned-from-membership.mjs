/**
 * Mark what the membership lends, so cancelling takes back the right things.
 *
 *   node --env-file=.env.local scripts/split-owned-from-membership.mjs          # dry run
 *   node --env-file=.env.local scripts/split-owned-from-membership.mjs --apply
 *   node --env-file=.env.local scripts/split-owned-from-membership.mjs --apply --undo
 *
 * Kept forever (left with no gate):
 *   - the six plugin packs that came with the purchase
 *   - the six specialist courses that teach them
 *
 * Lent while subscribed (gated with 'membership'):
 *   - the powerups and the Skills Bundle
 *   - the content library: prompts, image prompts, skills, tutorials,
 *     automation templates, GPTs and guides
 *
 * Untouched either way: anything already gated by a product entitlement -
 * routines, carousel-studio and the paid courses. Those are bought, and whether
 * somebody keeps them depends on whether they bought them, which is already how
 * they work.
 *
 * Re-runnable, and --undo puts everything back to open.
 */
import { neon } from '@neondatabase/serverless';
import { MEMBERSHIP_ONLY } from '../lib/products.js';

const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is needed in .env.local'); process.exit(1); }
const sql = neon(url);

/* The library kinds the membership lends. `lesson` is absent on purpose: the
   lessons of the six specialist courses are kept, and the paid courses' lessons
   already carry their own gate. */
const LENT_KINDS = ['prompt', 'image_prompt', 'skill', 'video', 'automation', 'gpt', 'guide'];

/* Downloads: `plugin` is the six packs they bought, so it stays open. `powerup`
   is the bonus material, which the membership lends. */
const LENT_CONTENT_KINDS = ['powerup'];

const gate = UNDO ? null : MEMBERSHIP_ONLY;
const verb = UNDO ? 'open up' : 'gate';

const libCounts = await sql`
  select kind, count(*)::int n from library
   where kind = any(${LENT_KINDS}) and requires is not distinct from ${UNDO ? MEMBERSHIP_ONLY : null}
   group by kind order by kind`;

const conCounts = await sql`
  select kind, count(*)::int n from content
   where kind = any(${LENT_CONTENT_KINDS}) and requires is not distinct from ${UNDO ? MEMBERSHIP_ONLY : null}
   group by kind order by kind`;

const libTotal = libCounts.reduce((n, r) => n + r.n, 0);
const conTotal = conCounts.reduce((n, r) => n + r.n, 0);

console.log(`would ${verb}:`);
libCounts.forEach((r) => console.log('   library  ' + r.kind.padEnd(14), r.n));
conCounts.forEach((r) => console.log('   download ' + r.kind.padEnd(14), r.n));
console.log(`   ${libTotal + conTotal} item(s) in total`);

// Said out loud, because it is the whole point and easy to get backwards.
const keptLib = await sql`select count(*)::int n from library
                           where requires is null and kind = 'lesson'`;
const keptCon = await sql`select count(*)::int n from content
                           where requires is null and kind = 'plugin'`;
console.log(`\nleft open to everybody who ever bought:`);
console.log('   ' + keptCon[0].n + ' plugin pack(s) and ' + keptLib[0].n + ' course lesson(s)');

if (APPLY) {
  await sql`update library set requires = ${gate}
             where kind = any(${LENT_KINDS})
               and requires is not distinct from ${UNDO ? MEMBERSHIP_ONLY : null}`;
  await sql`update content set requires = ${gate}
             where kind = any(${LENT_CONTENT_KINDS})
               and requires is not distinct from ${UNDO ? MEMBERSHIP_ONLY : null}`;
  console.log(`\n${UNDO ? 'opened' : 'gated'} ${libTotal + conTotal} item(s).`);
} else {
  console.log('\nDry run. Add --apply to write.\n');
}
