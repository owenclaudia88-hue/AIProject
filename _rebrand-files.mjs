/**
 * Take the old brand out of the files members download.
 *
 *   node --env-file=.env.local _rebrand-files.mjs --dry
 *   node --env-file=.env.local _rebrand-files.mjs
 *
 * Skills, plugins and automations ship a .md, a .skill or a .zip, and 65 of
 * the 96 carry the old name inside — in an `author:` line, in a README, in a
 * plugin.json. A member unzips it and finds somebody else's brand.
 *
 * The storage key never changes, so nothing that points at the file has to be
 * told. Only the blob behind it is replaced, and the previous URL is written
 * to brand_file_backup first so this is reversible.
 *
 * Binary entries inside a zip are copied through untouched.
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import AdmZip from 'adm-zip';

const sql = neon(process.env.DATABASE_URL);
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DRY = process.argv.includes('--dry');
const TEXT = /\.(md|txt|json|ya?ml|js|ts|html|xml|csv|skill|plugin|toml|cfg|ini)$/i;

const rewrite = (s) => String(s)
  .replace(/AI Black Magic/g, 'AI Founder University')
  .replace(/\bAIBM\b/g, 'AI Founder University')
  /* Their site. An /api/ path keeps its path, because ours is the same shape
     and the one that matters is /api/mcp — a skill's .mcp.json points at it,
     and collapsing that to the library would not rebrand the connector, it
     would break it. Every content path goes to the library the member already
     owns, rather than to a deep path on our domain that does not exist. */
  .replace(/https?:\/\/(?:www\.)?aiblackmagic\.com(\/api\/[^\s"')>\]]*)/gi,
    'https://aifounderuniversity.com$1')
  .replace(/https?:\/\/(?:www\.)?aiblackmagic\.com[^\s"')>\]]*/gi,
    'https://aifounderuniversity.com/members/')
  .replace(/\baiblackmagic\.com\b/gi, 'aifounderuniversity.com')
  .replace(/\baiblackmagic\b/gi, 'aifounderuniversity')
  /* Docs that illustrate a URL shape — ".../claude-skill/<id>" — leave the
     closing bracket behind once the path is gone. */
  .replace(/\/members\/>/g, '/members/');

await sql`create table if not exists brand_file_backup (
  id bigserial primary key, at timestamptz not null default now(),
  key text not null, old_blob_url text not null)`;

/* --recent=<hours> looks only at what has just arrived, which is what the
   weekly run needs: every new skill and plugin comes down carrying their name,
   so without this the pipeline quietly puts it back every Friday. Unset, it
   sweeps everything. */
const recentArg = process.argv.find((a) => a.startsWith('--recent='));
const hours = recentArg ? Number(recentArg.split('=')[1]) : null;

const items = hours
  ? await sql`
      select l.id, l.kind, l.title, l.meta->>'fileKey' as key, a.blob_url, a.content_type
        from library l join library_assets a on a.key = l.meta->>'fileKey'
       where l.meta ? 'fileKey'
         and l.created_at > now() - make_interval(hours => ${hours})
       order by l.kind, l.title`
  : await sql`
      select l.id, l.kind, l.title, l.meta->>'fileKey' as key, a.blob_url, a.content_type
        from library l join library_assets a on a.key = l.meta->>'fileKey'
       where l.meta ? 'fileKey' order by l.kind, l.title`;
if (hours) console.log(`looking at the ${items.length} file(s) added in the last ${hours}h\n`);

const urls = new Set();
let changed = 0, untouched = 0, failed = 0;

for (const it of items) {
  let buf;
  try {
    const r = await fetch(it.blob_url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) { failed++; continue; }
    buf = Buffer.from(await r.arrayBuffer());
  } catch { failed++; continue; }

  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  let out = null, touchedNames = [];

  if (isZip) {
    let zip;
    try { zip = new AdmZip(buf); } catch { failed++; continue; }
    const next = new AdmZip();
    let any = false;
    for (const e of zip.getEntries()) {
      if (e.isDirectory) continue;
      const data = e.getData();
      if (TEXT.test(e.entryName)) {
        const before = data.toString('utf8');
        for (const u of before.match(/https?:\/\/(?:www\.)?aiblackmagic\.com[^\s"')>\]]*/gi) || []) urls.add(u);
        const after = rewrite(before);
        if (after !== before) { any = true; touchedNames.push(e.entryName); }
        next.addFile(e.entryName, Buffer.from(after, 'utf8'));
      } else {
        next.addFile(e.entryName, data);
      }
    }
    if (any) out = next.toBuffer();
  } else {
    const before = buf.toString('utf8');
    for (const u of before.match(/https?:\/\/(?:www\.)?aiblackmagic\.com[^\s"')>\]]*/gi) || []) urls.add(u);
    const after = rewrite(before);
    if (after !== before) { out = Buffer.from(after, 'utf8'); touchedNames.push('(the file)'); }
  }

  if (!out) { untouched++; continue; }
  changed++;
  console.log(`  ${DRY ? 'would fix' : 'fixed'}  ${String(it.title).slice(0, 40).padEnd(42)} ${touchedNames.slice(0, 2).join(', ')}`);

  if (DRY) continue;
  const { url } = await put(`library-assets/${it.key}`, out, {
    access: 'private', addRandomSuffix: true, token: TOKEN,
    contentType: it.content_type || 'application/octet-stream'
  });
  await sql`insert into brand_file_backup (key, old_blob_url) values (${it.key}, ${it.blob_url})`;
  await sql`update library_assets set blob_url = ${url} where key = ${it.key}`;
}

console.log(`\n${DRY ? 'would change' : 'changed'}: ${changed} | already clean: ${untouched} | could not read: ${failed}`);
if (urls.size) {
  console.log('\nlinks to their site found inside these files:');
  for (const u of [...urls].slice(0, 20)) console.log('   ', u);
  console.log('  all of the above now point at /members/ instead.');
}
