// The rewrite rules on the strings that actually appear, before 65 files are
// rebuilt with them.
const rewrite = (s) => String(s)
  .replace(/AI Black Magic/g, 'AI Founder University')
  .replace(/\bAIBM\b/g, 'AI Founder University')
  .replace(/https?:\/\/(?:www\.)?aiblackmagic\.com(\/api\/[^\s"')>\]]*)/gi,
    'https://aifounderuniversity.com$1')
  .replace(/https?:\/\/(?:www\.)?aiblackmagic\.com[^\s"')>\]]*/gi,
    'https://aifounderuniversity.com/members/')
  .replace(/\baiblackmagic\.com\b/gi, 'aifounderuniversity.com')
  .replace(/\baiblackmagic\b/gi, 'aifounderuniversity')
  .replace(/\/members\/>/g, '/members/');

const cases = [
  ['author: "AI Black Magic"', 'author: "AI Founder University"'],
  ['"url": "https://aiblackmagic.com/api/mcp"', '"url": "https://aifounderuniversity.com/api/mcp"'],
  ['Connect to https://aiblackmagic.com/api/mcp.', 'Connect to https://aifounderuniversity.com/api/mcp.'],
  ['see https://aiblackmagic.com/claude-skill/<id>', 'see https://aifounderuniversity.com/members/'],
  ['Visit https://aiblackmagic.com', 'Visit https://aifounderuniversity.com/members/'],
  ['from your AIBM library', 'from your AI Founder University library'],
  ['AIBM-Design-Systems-Pack.zip', 'AI Founder University-Design-Systems-Pack.zip'],
  ['the aiblackmagic.com team', 'the aifounderuniversity.com team'],
  ['<code>https://aiblackmagic.com/api/mcp</code>', '<code>https://aifounderuniversity.com/api/mcp</code>']
];

let pass = 0, fail = 0;
for (const [input, want] of cases) {
  const got = rewrite(input);
  if (got === want) { pass++; console.log('  PASS', input.slice(0, 48)); }
  else { fail++; console.log('  FAIL', input, '\n        got:', got, '\n       want:', want); }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

