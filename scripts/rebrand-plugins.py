"""
Rebrand the downloadable plugins to AI Founder University.

    python scripts/rebrand-plugins.py           # show what would change
    python scripts/rebrand-plugins.py --write   # rewrite the zips in place

The plugins ship with the original vendor's name all over them, and Claude puts
that name on screen the moment one is installed — so a buyer purchases from us,
installs, and is told the thing belongs to somebody else. Worse, the email
plugin writes every email in a named person's voice, so a customer's own
mailing list gets messages signed by a stranger.

Run it again whenever a new version of a plugin is dropped into export/product,
then `npm run upload` to push the rebuilt zips to Blob. It is idempotent: a
second run reports nothing left to do.

What it deliberately does NOT touch:

  * "Darius Lukas Pte. Ltd." — a legal entity in an MIT licence. MIT grants the
    right to redistribute only on condition the copyright notice is kept, so
    removing it is the one edit the licence itself forbids.
  * "Hyper Entrepreneur Light/Dark", "Darius Lukas Light". These name real
    Canva and Gamma templates the skills look up; renaming the labels here
    would break the lookup. They are being replaced separately.
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
SUPPORT_EMAIL = f'support@{BRAND_DOMAIN}'
CONFIG_DIR = 'ai-founder-university'
LEGACY_CONFIG_DIR = 'darius-lukas-team'

ROOT = Path(__file__).resolve().parent.parent
PRODUCT_DIR = ROOT / 'export' / 'product'

TEXT_SUFFIXES = ('.md', '.txt', '.html', '.htm', '.mjs', '.js', '.example')

# ---------------------------------------------------------------- rule sets

# Applied to every plugin. The Darius-Lukas-Team rule is case-SENSITIVE on
# purpose: the lowercase darius-lukas-team is a filesystem path, handled
# separately and with a migration, not a brand name to swap out.
GLOBAL_RULES = [
    # Before the brand rule below, or this turns into a broken URL containing
    # spaces. The vendor's issue tracker is no use to our buyers anyway.
    (re.compile(r'https://github\.com/Darius-Lukas-Team/plugins/issues'), SUPPORT_EMAIL),
    (re.compile(r'hyperentrepreneur\.com', re.I), BRAND_DOMAIN),
    (re.compile(r'Darius-Lukas-Team'), BRAND_NAME),
]

# Only for the two plugins whose copyright is the vendor's own proprietary
# notice rather than a third-party MIT one.
PROPRIETARY_RULES = [
    (re.compile(r'Copyright \(c\) (\d{4}) Hyper Entrepreneur'),
     lambda m: f'Copyright (c) {m.group(1)} {BRAND_NAME}'),
    # The notice reads "... Hyper Entrepreneur (hyperentrepreneur.com)", and a
    # licence file is held back from the global rules, so without this the
    # domain survives in the brackets right next to our own name.
    (re.compile(r'hyperentrepreneur\.com', re.I), BRAND_DOMAIN),
]

# The email plugin hard-codes a person as the sender: roughly forty files tell
# it to sign off as him, and the examples are written in his first person. Left
# alone, every email a customer generates goes out in a stranger's name.
PERSONA_RULES = [
    (re.compile(r'Sign off as "Best, Darius" or just "Darius"'),
     f'Sign off as "{BRAND_NAME}"'),
    (re.compile(r'Sign off as "Darius" or "Best, Darius"'),
     f'Sign off as "{BRAND_NAME}"'),
    (re.compile(r'Sign-off matches voice: "Darius" or "Best, Darius"'),
     f'Sign-off matches voice: "{BRAND_NAME}"'),
    (re.compile(r'Sign-off: "Darius" \(no "Best,"\)'),
     f'Sign-off: "{BRAND_NAME}"'),
    (re.compile(r'Sign off as "Darius"'), f'Sign off as "{BRAND_NAME}"'),

    # Prose. The pronouns have to move with the name — a brand is a "we", and
    # leaving "he" behind reads as though a person was simply renamed.
    (re.compile(r"Quick intro: I'm Darius — I help course creators turn their "
                r"funnels into actual income"),
     f"Quick intro: I'm from {BRAND_NAME} — we help founders turn AI into actual income"),
    (re.compile(r'Darius sharing something he made because he genuinely wants to help'),
     f'{BRAND_NAME} sharing something we made because we genuinely want to help'),
    (re.compile(r"Darius telling you about an event he's genuinely excited about"),
     f"{BRAND_NAME} telling you about an event we're genuinely excited about"),
    (re.compile(r'Darius offering something he genuinely believes in'),
     f'{BRAND_NAME} offering something we genuinely believe in'),
    (re.compile(r'Darius reminding you about plans you made together'),
     f'{BRAND_NAME} reminding you about plans you made together'),
    (re.compile(r'Darius as a helpful mentor'), f'{BRAND_NAME} as a helpful mentor'),

    # Anything left: the bare sign-off line at the foot of ~45 templates, and
    # the odd incidental mention.
    (re.compile(r'\bDarius\b'), BRAND_NAME),
]

# The carousel plugin keeps API keys in a folder named after the vendor.
# Renaming it is safe because exactly one function computes the path, but an
# existing customer already has keys in the old folder — hence the fallback.
CONFIG_DIR_RULES = [
    # This file is CRLF, so the pattern tolerates either ending and the
    # replacement is rejoined with whichever one the match actually used —
    # mixing them inside a single file trips up editors and diffs.
    (re.compile(
        r"export function getUserConfigDir\(\) \{\r?\n"
        r"  return path\.join\(os\.homedir\(\), '\.claude', '" + LEGACY_CONFIG_DIR + r"'\);\r?\n"
        r"\}"
     ),
     lambda m: ('\r\n' if '\r\n' in m.group(0) else '\n').join([
        "export function getUserConfigDir() {",
        f"  const dir = path.join(os.homedir(), '.claude', '{CONFIG_DIR}');",
        "  // Earlier releases stored keys under the original vendor's folder.",
        "  // If an upgrading user still has that one and not this one, keep",
        "  // reading it: renaming a folder must not silently cost somebody the",
        "  // API keys they already saved.",
        "  if (!fs.existsSync(dir)) {",
        f"    const legacy = path.join(os.homedir(), '.claude', '{LEGACY_CONFIG_DIR}');",
        "    if (fs.existsSync(legacy)) return legacy;",
        "  }",
        "  return dir;",
        "}",
     ])),
    # Every other mention is documentation. Anchored on ~/ so it cannot match
    # the legacy literal the replacement above just introduced.
    (re.compile(r'~/\.claude/' + LEGACY_CONFIG_DIR), f'~/.claude/{CONFIG_DIR}'),
]

SCOPES = [
    ('email-specialist', PERSONA_RULES),
    ('carousel-post-specialists', CONFIG_DIR_RULES),
    ('70-ai-specialists', PROPRIETARY_RULES),
    ('image-designers', PROPRIETARY_RULES),
]


def rules_for(zip_name, entry_name):
    """Which rules apply to one file inside one plugin."""
    is_licence = Path(entry_name).name.upper().startswith('LICENSE')
    scoped = []
    for marker, rules in SCOPES:
        if marker in zip_name:
            scoped += rules
    if is_licence:
        # A licence is only ever touched by a rule written for that plugin's
        # own copyright line — never by the sweeping brand rules.
        return [r for r in scoped if r in PROPRIETARY_RULES]
    return GLOBAL_RULES + scoped


# ---------------------------------------------------------------- mechanics

def fix_manifest(name, raw):
    """Rewrite the author/owner/homepage fields Claude puts on screen."""
    try:
        data = json.loads(raw.decode('utf8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, []

    notes = []

    def set_holder(holder):
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
        set_holder('author')
        # Only rewritten where it already exists — adding one would put a link
        # on screen that was not there before.
        if data.get('homepage') and data['homepage'] != BRAND_URL:
            notes.append(f'homepage: {data["homepage"]} -> {BRAND_URL}')
            data['homepage'] = BRAND_URL
    elif name.endswith('marketplace.json'):
        set_holder('owner')

    if not notes:
        return None, []
    return (json.dumps(data, indent=2) + '\n').encode('utf8'), notes


def fix_text(zip_name, entry_name, raw):
    try:
        text = raw.decode('utf8')
    except UnicodeDecodeError:
        return None, []

    notes, out = [], text
    for pattern, replacement in rules_for(zip_name, entry_name):
        out, n = pattern.subn(replacement, out)
        if n:
            notes.append(f'{n}x {pattern.pattern.splitlines()[0][:64]}')
    if out == text:
        return None, []
    return out.encode('utf8'), notes


def process(path, write):
    changes = {}
    with zipfile.ZipFile(path) as zf:
        entries = [(info, zf.read(info.filename)) for info in zf.infolist()]

    rebuilt = []
    for info, raw in entries:
        new, notes = None, []
        if info.filename.endswith(('plugin.json', 'marketplace.json')):
            new, notes = fix_manifest(info.filename, raw)
        elif (info.filename.lower().endswith(TEXT_SUFFIXES)
              or Path(info.filename).name.upper().startswith('LICENSE')):
            new, notes = fix_text(path.name, info.filename, raw)
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
    verbose = '-v' in sys.argv or '--verbose' in sys.argv
    total = 0
    for path in sorted(PRODUCT_DIR.glob('*.zip')):
        changes = process(path, write)
        if not changes:
            print(f'  ok   {path.name}')
            continue
        total += len(changes)
        print(f'{"FIXED" if write else "would":>5}  {path.name}  ({len(changes)} files)')
        for filename, notes in sorted(changes.items()):
            if verbose:
                print(f'         {filename}')
                for note in notes:
                    print(f'           - {note}')
    if not total:
        print('\nNothing to change.')
    elif write:
        print(f'\n{total} file(s) rewritten. Now run:  npm run upload')
    else:
        print(f'\n{total} file(s) would change. Re-run with --write to apply'
              f'{"" if verbose else ", or -v for detail"}.')


if __name__ == '__main__':
    main()
