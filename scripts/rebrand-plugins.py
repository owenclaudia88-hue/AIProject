"""
Rebrand the downloadable plugins to AI Founder University.

    python scripts/rebrand-plugins.py           # show what would change
    python scripts/rebrand-plugins.py --write   # rewrite the zips in place

The plugins ship with the original vendor's name in their manifests, and Claude
puts that name straight on screen once the plugin is installed — so a buyer
installs a product bought from us and sees somebody else's domain. This fixes
the fields Claude actually displays.

Run it again whenever a new version of a plugin is dropped into export/product,
then `npm run upload` to push the rebuilt zips to Blob. It is idempotent: a
second run reports nothing left to do.

What it deliberately does NOT touch:

  * LICENSE files. Those are third-party copyright notices, and rewriting one
    to name us would be claiming authorship of someone else's work. If the
    licence permits rebranding, change them by hand and knowingly.
  * "Hyper Entrepreneur Light/Dark", "Darius Lukas Light". These are the names
    of real Canva and Gamma templates the skills look up; renaming the labels
    would break the lookup.
  * ~/.claude/darius-lukas-team/ config paths, and the he- skill directory
    prefixes. Both are functional identifiers, not display text — moving them
    changes behaviour rather than branding.
"""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

BRAND_DOMAIN = 'aifounderuniversity.com'
BRAND_NAME = 'AI Founder University'
BRAND_URL = f'https://{BRAND_DOMAIN}'

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [ROOT / 'export' / 'product']

# Only text a human reads. Anything matching a path or an identifier is left
# alone by keeping these patterns anchored to the domain or to a full phrase.
TEXT_SUFFIXES = ('.md', '.txt', '.html', '.htm')
TEXT_RULES = [
    (re.compile(r'hyperentrepreneur\.com', re.I), BRAND_DOMAIN),
    (re.compile(r'Built by Darius-Lukas-Team'), f'Built by {BRAND_NAME}'),
]


def fix_manifest(name, raw):
    """Rewrite the author/owner/homepage fields Claude puts on screen."""
    try:
        data = json.loads(raw.decode('utf8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, []

    notes = []

    def set_holder(holder, key):
        # The field is a dict in every plugin we ship, but the spec allows a
        # bare string, so handle both rather than crashing on the first one
        # that differs.
        node = data.get(holder)
        if isinstance(node, dict):
            if node.get('name') and node['name'] != BRAND_DOMAIN:
                notes.append(f'{holder}.name: {node["name"]} -> {BRAND_DOMAIN}')
                node['name'] = BRAND_DOMAIN
            if node.get('url') and node['url'] != BRAND_URL:
                notes.append(f'{holder}.url: {node["url"]} -> {BRAND_URL}')
                node['url'] = BRAND_URL
        elif isinstance(node, str) and node != BRAND_DOMAIN:
            notes.append(f'{holder}: {node} -> {BRAND_DOMAIN}')
            data[holder] = BRAND_DOMAIN

    if name.endswith('plugin.json'):
        set_holder('author', 'name')
        # Only rewritten where it already exists — adding one would put a link
        # on screen that was not there before.
        if data.get('homepage') and data['homepage'] != BRAND_URL:
            notes.append(f'homepage: {data["homepage"]} -> {BRAND_URL}')
            data['homepage'] = BRAND_URL
    elif name.endswith('marketplace.json'):
        set_holder('owner', 'name')

    if not notes:
        return None, []
    return (json.dumps(data, indent=2) + '\n').encode('utf8'), notes


def fix_text(name, raw):
    if Path(name).name.upper().startswith('LICENSE'):
        return None, []
    try:
        text = raw.decode('utf8')
    except UnicodeDecodeError:
        return None, []

    notes = []
    out = text
    for pattern, replacement in TEXT_RULES:
        out, n = pattern.subn(replacement, out)
        if n:
            notes.append(f'{n}x {pattern.pattern}')
    if out == text:
        return None, []
    return out.encode('utf8'), notes


def process(path, write):
    changes = {}
    with zipfile.ZipFile(path) as zf:
        entries = [(info, zf.read(info.filename)) for info in zf.infolist()]

    rebuilt = []
    for info, raw in entries:
        new = None
        if info.filename.endswith(('plugin.json', 'marketplace.json')):
            new, notes = fix_manifest(info.filename, raw)
        elif info.filename.lower().endswith(TEXT_SUFFIXES):
            new, notes = fix_text(info.filename, raw)
        if new is not None:
            changes[info.filename] = notes
            raw = new
        rebuilt.append((info, raw))

    if not changes or not write:
        return changes

    # Rebuild rather than edit: a zip cannot be modified in place. Every entry
    # keeps its original name, order, timestamp and compression so the only
    # difference between the old file and the new one is the bytes we changed.
    tmp = path.with_suffix('.zip.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for info, raw in rebuilt:
            copy = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            copy.compress_type = info.compress_type
            copy.external_attr = info.external_attr
            copy.internal_attr = info.internal_attr
            copy.create_system = info.create_system
            out.writestr(copy, raw)
    shutil.move(str(tmp), str(path))
    return changes


def main():
    write = '--write' in sys.argv
    total = 0
    for directory in TARGETS:
        for path in sorted(directory.glob('*.zip')):
            changes = process(path, write)
            if not changes:
                print(f'  ok   {path.name}')
                continue
            total += len(changes)
            print(f'{"FIXED" if write else "would":>5}  {path.name}')
            for filename, notes in changes.items():
                print(f'         {filename}')
                for note in notes:
                    print(f'           - {note}')
    if not total:
        print('\nNothing to change.')
    elif write:
        print(f'\n{total} file(s) rewritten. Now run:  npm run upload')
    else:
        print(f'\n{total} file(s) would change. Re-run with --write to apply.')


if __name__ == '__main__':
    main()
