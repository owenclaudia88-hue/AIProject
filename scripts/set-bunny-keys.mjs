/**
 * Prompt for the two Bunny Stream secrets and write them into .env.local,
 * then optionally push all four video variables to Vercel.
 *
 *   node scripts/set-bunny-keys.mjs
 *
 * Input is masked and nothing is echoed, so the keys stay out of your shell
 * history and out of any transcript. The library id and CDN hostname are not
 * secret and are already in .env.local.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(ROOT, '.env.local');

/** Read one line without echoing it. */
function askSecret(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (ch) => {
      // repaint the prompt so the typed characters never appear
      if (!['\r', '\n', ''].includes(String(ch))) {
        process.stdout.clearLine(0); process.stdout.cursorTo(0); process.stdout.write(question);
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const ask = (q) => new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
});

/** Replace KEY=… in place, or append it if the file has no such line yet. */
function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp('^' + key + '=.*$', 'm');
  return re.test(text) ? text.replace(re, line) : text.replace(/\s*$/, '\n') + line + '\n';
}

console.log('Bunny Stream keys — paste each value, it will not be shown.\n');
console.log('  API key    : Bunny → Stream → your library → API → "API Key"');
console.log('  Token key  : that page → Pull zone → Manage → Security →');
console.log('               Token Authentication (turn it on) → security key\n');

const apiKey = await askSecret('BUNNY_STREAM_API_KEY  : ');
const tokenKey = await askSecret('BUNNY_STREAM_TOKEN_KEY: ');

if (!apiKey) { console.error('\nNo API key given — nothing written.'); process.exit(1); }
if (!tokenKey) console.log('\nNo token key given: playback URLs will be unsigned until you add one.');

let env = await readFile(ENV, 'utf8');
env = setVar(env, 'BUNNY_STREAM_API_KEY', apiKey);
if (tokenKey) env = setVar(env, 'BUNNY_STREAM_TOKEN_KEY', tokenKey);
await writeFile(ENV, env, 'utf8');
console.log('\n.env.local updated.');

/* ---------------- Vercel ---------------- */
const answer = (await ask('\nPush these to Vercel production as well? [y/N] ')).toLowerCase();
if (answer !== 'y' && answer !== 'yes') {
  console.log('Skipped. Add them by hand at Vercel → Settings → Environment Variables.');
  process.exit(0);
}

const vars = {
  BUNNY_STREAM_LIBRARY_ID: (env.match(/^BUNNY_STREAM_LIBRARY_ID=(.*)$/m) || [])[1] || '',
  BUNNY_STREAM_CDN_HOSTNAME: (env.match(/^BUNNY_STREAM_CDN_HOSTNAME=(.*)$/m) || [])[1] || '',
  BUNNY_STREAM_API_KEY: apiKey,
  ...(tokenKey ? { BUNNY_STREAM_TOKEN_KEY: tokenKey } : {})
};

for (const [name, value] of Object.entries(vars)) {
  if (!value) continue;
  const ok = await new Promise((resolve) => {
    // `vercel env add` takes the value on stdin, so it is never an argument
    // and never reaches the process list or your shell history.
    const p = spawn('vercel', ['env', 'add', name, 'production', '--force'], { stdio: ['pipe', 'inherit', 'inherit'], shell: true });
    p.stdin.write(value + '\n'); p.stdin.end();
    p.on('close', (code) => resolve(code === 0));
  });
  console.log(ok ? `  set ${name}` : `  FAILED ${name} — add it in the dashboard`);
}

console.log('\nRedeploy for the deployed site to pick these up:  vercel --prod');
