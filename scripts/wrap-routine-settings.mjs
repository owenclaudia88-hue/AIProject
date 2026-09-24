/**
 * Hard-wrap over-long lines in a routine's settings block.
 *
 *   node scripts/wrap-routine-settings.mjs [--dry]
 *
 * The bracketed examples pushed some settings lines past 200 characters.
 * The reader wraps them, but the prompt is also meant to be pasted into
 * Claude's Instructions box and read there, where a 209-character line among
 * 72-character ones looks like a mistake.
 *
 * Wraps at word boundaries with a hanging indent, keeping the label and the
 * start of its example on the same line — a field must never end on a bare
 * colon, which is the whole point of the placeholders.
 *
 * Re-runnable: lines already within the limit are left alone.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'routines');
const DRY = process.argv.includes('--dry');
const MARKER = '--- EDIT BELOW THIS LINE ---';
const WIDTH = 74;

function wrap(line) {
  if (line.length <= WIDTH) return [line];
  const lead = line.match(/^ */)[0];
  const hang = lead + '  ';
  const out = [];
  let cur = '';
  for (const word of line.trim().split(/\s+/)) {
    const prefix = out.length === 0 ? lead : hang;
    if (cur && (prefix + cur + ' ' + word).length > WIDTH) { out.push(prefix + cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) out.push((out.length === 0 ? lead : hang) + cur);

  // Never break straight after the colon. Doing so leaves the label alone on
  // its line ending in ":" — which is exactly the truncated look the
  // placeholders exist to remove, and it orphans the value onto the next
  // line. A label that cannot fit its value needs shortening, not wrapping,
  // so say so and leave it alone.
  if (out.length > 1 && /:$/.test(out[0])) {
    console.error(`  !! too long to wrap without orphaning the value — shorten this label:\n     ${line.trim()}`);
    process.exitCode = 1;
    return [line];
  }
  return out;
}

const files = [];
for (const d of (await readdir(ROOT, { withFileTypes: true })).filter((x) => x.isDirectory())) {
  for (const f of (await readdir(join(ROOT, d.name))).filter((x) => x.endsWith('.md'))) {
    files.push(join(ROOT, d.name, f));
  }
}
files.sort();

let changed = 0, wrapped = 0;
for (const path of files) {
  const raw = await readFile(path, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const md = raw.replaceAll('\r', '');

  const fence = md.match(/```\n([\s\S]*?)```/);
  if (!fence) continue;
  const at = fence[1].indexOf(MARKER);
  if (at < 0) continue;

  const head = fence[1].slice(0, at);
  const out = [];
  let touched = false;
  for (const line of fence[1].slice(at).split('\n')) {
    if (line.length <= WIDTH) { out.push(line); continue; }
    const parts = wrap(line);
    if (parts.length > 1) { touched = true; wrapped++; }
    out.push(...parts);
  }
  if (!touched) continue;
  changed++;
  if (!DRY) {
    await writeFile(path, md.replace(fence[1], head + out.join('\n')).split('\n').join(eol), 'utf8');
  }
  console.log(`  ${basename(path)}`);
}

console.log(DRY
  ? `\n${wrapped} lines would be wrapped across ${changed} routines.`
  : `\n${wrapped} lines wrapped across ${changed} routines.`);
