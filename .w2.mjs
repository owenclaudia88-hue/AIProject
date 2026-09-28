import fs from 'fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const sql = neon(env.DATABASE_URL);
// Exit as soon as Vercel's own scheduler stamps a run. Nothing here calls the
// endpoint, so a stamp can only mean the schedule fired by itself.
for (;;) {
  const r = await sql`select key, value from settings where key like 'reminderLastRun%'`;
  const s = Object.fromEntries(r.map(x=>[x.key,x.value]));
  if (s.reminderLastRunAt) {
    console.log('CRON FIRED BY ITSELF at', s.reminderLastRunAt, '| report:', s.reminderLastRunReport || '(none)');
    const o = await sql`select email, kind, sent_at from outreach`;
    console.log('outreach rows:', o.length ? JSON.stringify(o) : 'none yet');
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 20000));
}
