/**
 * Who can see the AI news feed, decided once.
 *
 * Open to the membership. Anyone on a live subscription reads it, trial or paid
 * alike: ALL_ACCESS is granted the moment Stripe says `trialing` and taken back
 * when the subscription ends, and `entitlementsFor` expands it to
 * MEMBERSHIP_ONLY, which is what the check below asks for. So a trial opens the
 * feed on its first day and a cancellation closes it, with no rule here that
 * could drift from the one the webhook enforces.
 *
 * Everybody else is shown the section wearing a lock rather than not shown it
 * at all, the same way the reports and the roadmap read - a perk nobody can see
 * is a perk nobody subscribes for. That is the member area's job; this file
 * only answers who may read one.
 *
 * `newsOpenTo` is no longer a preview list but the feature's own switch.
 * Returning false here takes the feed out of the sidebar completely, which is
 * the thing to reach for if it ever has to come off the air.
 */
import { sessionEmail } from './session.js';
import { isActive, entitlementsFor } from './db.js';
import { isAdmin } from './admin.js';
import { MEMBERSHIP_ONLY } from './products.js';

export function newsOpenTo() {
  return true;
}

/** `{ email }`, or `{ error, status }`. */
export async function newsReader(req) {
  const email = await sessionEmail(req);
  if (!email) return { status: 401, error: 'not signed in' };

  if (!newsOpenTo(email)) {
    return { status: 403, error: 'not available', message: 'The AI News Feed is not open yet.' };
  }
  if (isAdmin(email)) return { email, isAdmin: true };

  if (!(await isActive(email))) return { status: 403, error: 'not active' };
  const held = await entitlementsFor(email);
  if (!held.has(MEMBERSHIP_ONLY)) {
    return { status: 403, error: 'membership', message: 'The AI News Feed is part of the membership.' };
  }
  return { email, isAdmin: false };
}
