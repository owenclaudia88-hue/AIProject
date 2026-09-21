import { readSession } from '../../lib/session.js';
import { normalizeEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { eligibleForReminder, sendRemindersTo } from '../../lib/reminders.js';

/**
 * POST /api/admin/send-reminder  { emails: [...] }
 *
 * Nudges people who filled in the checkout and never finished.
 *
 * The addresses are not taken from the request: the request only says which
 * of the people Stripe reports as unconverted to write to. Anything that is
 * not currently on that list is refused, so a stray or crafted request cannot
 * turn this into a way to mail arbitrary strangers from your domain.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const actor = readSession(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const asked = Array.isArray(body.emails) ? body.emails.map(normalizeEmail).filter(Boolean) : [];
    if (!asked.length) return res.status(400).json({ error: 'no addresses given' });

    // Rebuild the eligible set rather than trusting the browser, so a stray or
    // crafted request cannot turn this into a way to mail arbitrary strangers.
    const eligible = new Map((await eligibleForReminder()).map((p) => [p.email, p]));
    const people = [], skipped = [];
    for (const email of asked) {
      const person = eligible.get(email);
      if (person) people.push(person);
      else skipped.push({ email, why: 'already reminded, unsubscribed, or not an unconverted checkout' });
    }

    const result = await sendRemindersTo(people);
    const sent = result.sent;
    skipped.push(...result.skipped);

    console.log(`[admin] ${actor} sent ${sent.length} checkout reminder(s)`);
    return res.status(200).json({ ok: true, sent, skipped });
  } catch (err) {
    console.error('[admin/send-reminder]', err);
    return res.status(500).json({ error: 'server' });
  }
}
