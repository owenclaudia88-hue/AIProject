import { readSession } from '../../lib/session.js';
import { normalizeEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { eligibleFor, sendStepTo, STEPS } from '../../lib/reminders.js';

/**
 * POST /api/admin/send-reminder  { emails: [...], kind }
 *
 * Sends one step of the abandoned-checkout sequence by hand, without waiting
 * for the schedule.
 *
 * The addresses are not taken at face value: the request says who to write to,
 * and anything not currently eligible for that step is refused. So a stray or
 * crafted request cannot turn this into a way to mail arbitrary strangers from
 * your domain, or to send the follow-up to someone who never got the first.
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
    const kind = String(body.kind || STEPS[0].kind);
    if (!STEPS.some((s) => s.kind === kind)) return res.status(400).json({ error: 'unknown reminder' });

    const asked = Array.isArray(body.emails) ? body.emails.map(normalizeEmail).filter(Boolean) : [];
    if (!asked.length) return res.status(400).json({ error: 'no addresses given' });

    const eligible = new Map((await eligibleFor(kind)).map((p) => [p.email, p]));
    const people = [], skipped = [];
    for (const email of asked) {
      const person = eligible.get(email);
      if (person) people.push(person);
      else skipped.push({ email, why: 'not currently due this email — already sent, unsubscribed, paid, or still owed the previous one' });
    }

    const result = await sendStepTo(kind, people);
    skipped.push(...result.skipped);

    console.log(`[admin] ${actor} sent ${result.sent.length} × ${kind}`);
    return res.status(200).json({ ok: true, sent: result.sent, skipped });
  } catch (err) {
    console.error('[admin/send-reminder]', err);
    return res.status(500).json({ error: 'server' });
  }
}
