/**
 * Who can see the weekly reports, decided once.
 *
 * Open to the membership. Anyone on a live subscription reads them, trial or
 * paid alike: ALL_ACCESS is granted the moment Stripe says `trialing` and
 * taken back when the subscription ends, and `entitlementsFor` expands it to
 * MEMBERSHIP_ONLY, which is what the check below asks for. So a trial opens
 * the reports on its first day and a cancellation closes them, with no rule
 * here that could drift from the one the webhook enforces.
 *
 * Everybody else is shown the section wearing a lock rather than not shown it
 * at all - the same way the roadmap and the community rooms read - because a
 * perk nobody can see is a perk nobody subscribes for. That is the member
 * area's job; this file only answers who may read one.
 *
 * `reportsOpenTo` is no longer a preview list but the feature's own switch.
 * Returning false here takes the section out of the sidebar completely and
 * stops the Monday email, which is the one thing to reach for if the weekly
 * run ever has to come off the air.
 */
import { sessionEmail } from './session.js';
import { isActive, entitlementsFor } from './db.js';
import { isAdmin } from './admin.js';
import { MEMBERSHIP_ONLY } from './products.js';

export function reportsOpenTo() {
  return true;
}

/** `{ email, isAdmin }`, or `{ error, status }`. */
export async function reportReader(req) {
  const email = await sessionEmail(req);
  if (!email) return { status: 401, error: 'not signed in' };

  if (!reportsOpenTo(email)) {
    return { status: 403, error: 'not available', message: 'The AI Reports are not open yet.' };
  }
  if (isAdmin(email)) return { email, isAdmin: true };

  if (!(await isActive(email))) return { status: 403, error: 'not active' };
  const held = await entitlementsFor(email);
  if (!held.has(MEMBERSHIP_ONLY)) {
    return { status: 403, error: 'membership', message: 'The AI Reports are part of the membership.' };
  }
  return { email, isAdmin: false };
}

/**
 * Who gets the Monday email.
 *
 * `members` is digestAudience(), which is already the live subscribers who
 * have not turned email off - its join on ALL_ACCESS is the subscription test
 * and a trial satisfies it. This narrows that to the people the reports are
 * open to, which while the feature is on is all of them.
 *
 * It stays as its own step rather than being dropped, because the rule it
 * carries is the one that matters when the switch above is thrown: a member
 * who cannot open the report must not be told it is ready.
 */
export function audienceFor(members) {
  return members.filter((m) => reportsOpenTo(m.email));
}
