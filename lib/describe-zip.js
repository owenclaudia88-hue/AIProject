import AdmZip from 'adm-zip';

/**
 * One line saying what a downloadable pack is, read from inside the pack.
 *
 * The roadmap can only tell a member what something does if it knows, and a
 * download used to be a title and a filename — "Ads", "Automate", "Niche".
 * Nothing here is written by us: a plugin states its own description in its
 * manifest, and a pack that has no manifest usually opens its README with a
 * sentence about itself.
 *
 * Returns null rather than a guess. A download with no description is better
 * than a download described wrongly, because the roadmap quotes it.
 */
const clean = (s) => String(s || '')
  .replace(/^#+\s*/, '')
  .replace(/\*\*|__|`/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const slugLike = (s) => !s || /^[a-z0-9]+([-_.][a-z0-9]+)+$/.test(s);

export function describeZip(source, { title = '' } = {}) {
  let zip;
  try { zip = typeof source === 'string' ? new AdmZip(source) : new AdmZip(source); }
  catch { return null; }

  const entries = zip.getEntries()
    .filter((e) => !e.isDirectory && !e.entryName.includes('__MACOSX'));
  if (!entries.length) return null;

  /* What the pack calls itself — the single top-level folder, when there is
     one and it reads as English rather than as a slug. */
  const tops = new Set(entries.map((e) => e.entryName.split('/')[0]).filter(Boolean));
  const folder = tops.size === 1 ? [...tops][0] : null;
  const name = folder && !slugLike(folder) && folder.toLowerCase() !== String(title).toLowerCase()
    ? folder : null;

  /* The author's own sentence, from the plugin manifest. Better than a README
     every time: it describes the whole plugin rather than whichever folder the
     first README happened to sit in. */
  const manifest = entries.find((e) => /(^|\/)\.claude-plugin\/plugin\.json$/.test(e.entryName));
  if (manifest) {
    try {
      const stated = JSON.parse(manifest.getData().toString('utf8')).description;
      if (stated && String(stated).trim().length >= 25) {
        return [name, clean(stated)].filter(Boolean).join(' — ');
      }
    } catch { /* unreadable manifest is simply not a source */ }
  }

  /* Otherwise the first real sentence of the shallowest README. Headings are
     skipped on the raw line, because "# Claude Ad Creative Studio" cleans down
     to something that reads like prose. */
  const readme = entries
    .filter((e) => /(^|\/)README\.md$/i.test(e.entryName))
    .sort((a, b) => a.entryName.split('/').length - b.entryName.split('/').length)[0];

  if (readme) {
    for (const raw of readme.getData().toString('utf8').split(/\r?\n/)) {
      if (/^\s*#/.test(raw)) continue;
      const t = clean(raw);
      if (!t || t.startsWith('![') || t.startsWith('|') || t.startsWith('---') || t.startsWith('>')) continue;
      if (t.length < 40) continue;
      const line = t.length > 200 ? t.slice(0, 197).replace(/[\s,;:]+\S*$/, '') + '…' : t;
      return [name, line].filter(Boolean).join(' — ');
    }
  }

  return name || null;
}
