/**
 * Add a real "fill in the settings" step to every routine's Set it up list.
 *
 *   node scripts/add-settings-step.mjs [--dry]
 *
 * The bracket convention was only ever explained inside the prompt itself,
 * at the bottom of the settings block. Somebody who copies the prompt and
 * pastes it into Claude never reads that — they read the numbered steps on
 * this page, follow them, and paste a prompt still full of examples.
 *
 * So the explanation goes where people actually look: as its own numbered
 * step, in the sequence they are already following, with an example of what
 * a filled-in line looks like next to an unfilled one.
 *
 * Re-runnable: a list that already has the step is skipped.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'routines');
const DRY = process.argv.includes('--dry');
const MARK = 'Fill in the settings';

const WITH_BRACKETS =
  '**Fill in the settings** at the bottom of the instructions, under the '
  + '`--- EDIT BELOW THIS LINE ---` marker. Anything in `[square brackets]` '
  + 'is an example showing the kind of answer that works — **replace it with '
  + 'your own and delete the brackets**. Lines that already have a real value '
  + 'after the colon are sensible defaults; change them or leave them';

const NO_BRACKETS =
  '**Check the settings** at the bottom of the instructions, under the '
  + '`--- EDIT BELOW THIS LINE ---` marker. They come with sensible defaults, '
  + 'so this one works as-is — but the channel name and the thresholds are '
  + 'yours to change, and they are all in that one place';

const files = [];
for (const d of (await readdir(ROOT, { withFileTypes: true })).filter((x) => x.isDirectory())) {
  for (const f of (await readdir(join(ROOT, d.name))).filter((x) => x.endsWith('.md'))) {
    files.push(join(ROOT, d.name, f));
  }
}
files.sort();

let changed = 0;
const skipped = [];

for (const path of files) {
  const raw = await readFile(path, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const md = raw.replaceAll('\r', '');

  if (md.includes(MARK) || md.includes('Check the settings')) { skipped.push(basename(path) + ' (already has it)'); continue; }

  // Does this routine even have a settings block, and does it use brackets?
  const fence = md.match(/```\n([\s\S]*?)```/);
  if (!fence) { skipped.push(basename(path) + ' (no prompt)'); continue; }
  const at = fence[1].indexOf('--- EDIT BELOW THIS LINE ---');
  if (at < 0) { skipped.push(basename(path) + ' (no settings block)'); continue; }
  const step = fence[1].slice(at).includes('[') ? WITH_BRACKETS : NO_BRACKETS;

  const lines = md.split('\n');
  const head = lines.findIndex((l) => /^##\s+Set it up\s*$/.test(l));
  if (head < 0) { skipped.push(basename(path) + ' (no Set it up section)'); continue; }

  // The numbered list runs from the first "N." after the heading until the
  // first line that is neither a list item nor its continuation.
  const items = [];
  let i = head + 1;
  let firstItem = -1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\d+\.\s/.test(l)) { if (firstItem < 0) firstItem = i; items.push([i]); continue; }
    if (items.length && (/^\s+\S/.test(l))) { items[items.length - 1].push(i); continue; }
    if (items.length && !l.trim()) continue;
    if (items.length) break;
  }
  if (!items.length) { skipped.push(basename(path) + ' (no numbered list)'); continue; }

  // Insert after the step that mentions pasting, or after the first step.
  let afterIdx = items.findIndex((it) => /paste/i.test(lines[it[0]]));
  if (afterIdx < 0) afterIdx = 0;
  const insertAt = items[afterIdx][items[afterIdx].length - 1] + 1;

  const out = lines.slice();
  out.splice(insertAt, 0, 'X. ' + step);

  // Renumber the whole list so the sequence still reads correctly.
  let n = 0;
  for (let j = firstItem; j < out.length; j++) {
    if (/^(?:\d+|X)\.\s/.test(out[j])) { n++; out[j] = out[j].replace(/^(?:\d+|X)\./, n + '.'); continue; }
    if (/^\s+\S/.test(out[j]) || !out[j].trim()) continue;
    break;
  }

  changed++;
  if (!DRY) await writeFile(path, out.join('\n').split('\n').join(eol), 'utf8');
}

if (skipped.length) console.log('Skipped:\n  ' + skipped.join('\n  ') + '\n');
console.log(DRY ? `${changed} routines would gain the step.` : `${changed} routines gained the step.`);
