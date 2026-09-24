/**
 * Put the Claude Routines into the member library.
 *
 *   node --env-file=.env.local scripts/ingest-routines.mjs [--dry]
 *
 * Reads content/routines/<n>-<category>/*.md, converts each to HTML and
 * upserts it as a library item of kind `routine`.
 *
 * Every item is written with requires = 'routines', which is what keeps the
 * product invisible to ordinary members while it is being built and,
 * afterwards, to anyone who has not bought it. The gate is enforced in the
 * queries behind /api/library and /api/content, not in the page, so an item
 * missing from the catalogue is also unreachable by id.
 *
 * Re-runnable: ids are derived from the file path, so editing a routine and
 * running again updates it rather than creating a second copy.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { upsertLibraryItem } from '../lib/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'content', 'routines');
const DRY = process.argv.includes('--dry');
const PRODUCT = 'routines';

// "1-reporting-and-finance" -> "Reporting & Finance"
function categoryName(dir) {
  if (dir === 'training') return 'Start Here';
  return dir.replace(/^\d+-/, '').split('-')
    .map((w) => (w === 'and' ? '&' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// Prepended to every routine, never to the guide itself. Somebody who bought
// this because they saw a Slack screenshot has never heard the word "routine",
// and dropping them straight into a cron expression loses them.
const FIRST_TIME =
  '> **New to this?** Read **Start Here** first — it explains what a Routine is, '
  + 'where to find them in Claude, and how to set one up, with screenshots. '
  + 'Two minutes, and then this page makes sense.\n\n';

/**
 * Pull the facts out of the document rather than keeping them in a sidecar
 * file: the markdown is the source of truth, so a routine cannot be edited
 * into disagreeing with its own catalogue entry.
 */
function parse(md) {
  const title = (md.match(/^#\s+(.+)$/m) || [])[1]?.trim() || 'Untitled routine';

  // The line under the title, before the first table, is the summary.
  const afterTitle = md.split(/^#\s+.+$/m)[1] || '';
  const description = (afterTitle.trim().split('\n').find((l) => l.trim() && !l.startsWith('|')) || '').trim();

  const cell = (label) => {
    const row = md.match(new RegExp(`^\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`, 'm'));
    return row ? row[1].replace(/`/g, '').trim() : null;
  };

  // The prompt itself, which is the thing people came for.
  const prompt = (md.match(/```\n([\s\S]*?)```/) || [])[1]?.trim() || null;

  return {
    title,
    description,
    runs: cell('Runs'),
    cron: cell('Cron'),
    connectors: cell('Connectors'),
    prompt
  };
}

const files = [];
for (const dir of (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory())) {
  // `training` is included: the start-here guide belongs in the same gated
  // section as the routines, or a first-time buyer never finds it.
  for (const f of (await readdir(join(ROOT, dir.name))).filter((f) => f.endsWith('.md'))) {
    files.push({ dir: dir.name, file: f });
  }
}
files.sort((a, b) => (a.dir + a.file).localeCompare(b.dir + b.file));

let n = 0;
for (const { dir, file } of files) {
  // Line endings normalised on the way in. Git rewrites these files to CRLF on
  // checkout, and every pattern below anchors on a bare newline — which
  // silently produced routines with no prompt at all rather than failing,
  // because a regex that does not match simply returns null.
  const md = (await readFile(join(ROOT, dir, file), 'utf8'))
    .replaceAll(String.fromCharCode(13), '');
  const meta = parse(md);
  const slug = basename(file, '.md').replace(/^\d+-/, '');
  const id = `routine:${slug}`;
  const category = categoryName(dir);
  const sort = dir === 'training' ? 0 : Number((file.match(/^(\d+)/) || [])[1] || 99);

  // The H1 and the summary line under it are both dropped: the reader already
  // renders the title and the description above the body, and leaving them in
  // showed each of them twice on the page.
  let source = md.replace(/^#\s+.+$/m, '').trim();
  if (meta.description) source = source.replace(meta.description, '').trim();
  // And the prompt itself, which now has its own panel with its own copy
  // button. Leaving it in the body printed the whole thing twice and gave
  // people two blocks to choose between when only one is the right one.
  if (meta.prompt) {
    source = source.replace(/```[\s\S]*?```/, '**↓ The instructions are in the panel below this one, with a copy button.**').trim();
  }
  const isGuide = dir === 'training';
  // Loud, not silent. A routine whose prompt failed to parse would otherwise
  // ingest cleanly and present an empty copy button to a paying customer.
  if (!isGuide && !meta.prompt) {
    console.error(`  !! ${file}: no prompt found. Check the fenced block.`);
    process.exitCode = 1;
  }
  const bodyHtml = marked.parse(isGuide ? source : FIRST_TIME + source);

  const tags = [category];
  if (meta.connectors) {
    for (const c of meta.connectors.split(/,| or /).map((x) => x.trim()).filter(Boolean)) {
      if (c.length < 24) tags.push(c.replace(/\s*\(.*\)$/, ''));
    }
  }

  if (DRY) {
    console.log(`${String(sort).padStart(2)}  ${category.padEnd(24)} ${meta.title}`);
    console.log(`     ${meta.runs || '(no schedule)'} · ${meta.connectors || '(no connectors)'}`);
    console.log(`     prompt: ${meta.prompt ? meta.prompt.length + ' chars' : 'MISSING'}`);
  } else {
    await upsertLibraryItem({
      id, kind: 'routine', category, title: meta.title,
      description: meta.description, bodyHtml, sort,
      tags: [...new Set(tags)],
      meta: { runs: meta.runs, cron: meta.cron, connectors: meta.connectors, prompt: meta.prompt },
      requires: PRODUCT
    });
  }
  n++;
}

console.log(DRY
  ? `\n${n} routines parsed, nothing written.`
  : `\n${n} routines ingested, all gated behind "${PRODUCT}".`);
