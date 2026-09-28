import fs from 'fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const sql = neon(env.DATABASE_URL);
// Danny is due at 11:15:41Z. Wait for the outreach row that proves the first
// reminder actually went, or give up well after the boundary and say so.
const giveUp = Date.parse('2026-09-23T11:35:00Z');
for (;;) {
  const o = await sql`select email, kind, sent_at from outreach order by sent_at`;
  if (o.length) {
    console.log('REMINDER SENT:', JSON.stringify(o));
    process.exit(0);
  }
  if (Date.now() > giveUp) {
    const s = await sql`select key, value from settings where key like 'reminderLastRun%'`;
    console.log('NO REMINDER by 11:35Z. Last cron run:', JSON.stringify(Object.fromEntries(s.map(x=>[x.key,x.value]))));
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 60000));
}
