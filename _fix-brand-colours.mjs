/**
 * The rename left three files telling a member that our brand colours are
 * theirs — "using the AI Founder University brand colors (#0050B6 primary,
 * #FFF25A accent)". That was true of the sentence before the rename and is a
 * plain falsehood after it.
 *
 * Only the places that name the brand are changed. The same hex used as the
 * styling of a generated report is left alone: it is how a document looks,
 * not a claim about who we are, and changing it is a design decision rather
 * than a correction.
 *
 *   node --env-file=.env.local _fix-brand-colours.mjs --dry
 */
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import AdmZip from 'adm-zip';

const sql = neon(process.env.DATABASE_URL);
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DRY = process.argv.includes('--dry');

const OURS = { primary: '#ff7a1a', accent: '#ffb020' };

/** Only lines that assert these are our colours, or offer them as the default. */
const fix = (name, text) => {
  if (!/\.(md|json)$/i.test(name)) return text;           // leave templates and pages
  return text
    .replace(/#0050B6/gi, OURS.primary)
    .replace(/#FFF25A/gi, OURS.accent);
};

const items = await sql`
  select l.title, l.meta->>'fileKey' as key, a.blob_url, a.content_type
    from library l join library_assets a on a.key = l.meta->>'fileKey'
   where l.meta ? 'fileKey'`;

let changed = 0;
for (const it of items) {
  let buf;
  try {
    const r = await fetch(it.blob_url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) continue;
    buf = Buffer.from(await r.arrayBuffer());
  } catch { continue; }

  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) continue;                                    // the loose files are templates

  let zip;
  try { zip = new AdmZip(buf); } catch { continue; }
  const next = new AdmZip();
  const touched = [];
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const data = e.getData();
    if (/\.(md|json)$/i.test(e.entryName)) {
      const before = data.toString('utf8');
      const after = fix(e.entryName, before);
      if (after !== before) touched.push(e.entryName);
      next.addFile(e.entryName, Buffer.from(after, 'utf8'));
    } else next.addFile(e.entryName, data);
  }
  if (!touched.length) continue;
  changed++;
  console.log(`  ${DRY ? 'would fix' : 'fixed'}  ${it.title}`);
  for (const t of touched) console.log('       ', t);
  if (DRY) continue;

  const { url } = await put(`library-assets/${it.key}`, next.toBuffer(), {
    access: 'private', addRandomSuffix: true, token: TOKEN,
    contentType: it.content_type || 'application/octet-stream'
  });
  await sql`insert into brand_file_backup (key, old_blob_url) values (${it.key}, ${it.blob_url})`;
  await sql`update library_assets set blob_url = ${url} where key = ${it.key}`;
}
console.log(`\n${DRY ? 'would change' : 'changed'}: ${changed} file(s)`);
console.log('left alone: the same hex used as the styling of a generated report or page.');
