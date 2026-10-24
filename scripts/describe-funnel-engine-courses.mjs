/**
 * The one-line descriptions of the Funnel Engine and its two bumps, written
 * for members rather than generated from lesson titles. The Friday email
 * shows them, and the course ingests never touch this column, so a rebuild
 * keeps them.
 *
 *   node --env-file=.env.local scripts/describe-funnel-engine-courses.mjs
 */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const DESCRIPTIONS = {
  'the-funnel-engine':
    'Tell Claude what you want to sell and it builds the whole offer for you: sales page, checkout, ' +
    'order bumps, upsells and emails, live on your own domain. No funnel builder, no tech skills. ' +
    '$100 once, with a 72-hour money-back guarantee.',
  'edward-evergreen-ads':
    'Edward is your AI media buyer: he writes your Meta ads, makes the images and builds your campaign ' +
    'with you, with the full Evergreen Ads 3.0 workshop and ad templates. An add-on with The Funnel Engine.',
  'dfy-ai-operators':
    'Sixteen AI operators in one Claude skill that build your offer, sales page, emails and upsells ' +
    'with you. Type "start micro offer" and they take it from there. An add-on with The Funnel Engine.'
};

for (const [slug, text] of Object.entries(DESCRIPTIONS)) {
  const rows = await sql`update courses set description = ${text} where slug = ${slug} returning slug`;
  console.log(rows.length ? `described ${slug}` : `no course ${slug}`);
}
