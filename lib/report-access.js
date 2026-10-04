/**
 * Who can see the weekly reports, decided once.
 *
 * Not finished yet, so it is the test account's and staff's alone. Checked
 * before the membership rule on purpose: telling somebody they need a
 * subscription for something they could not have either way answers a question
 * they did not ask.
 *
 * To open it to everybody who subscribes, delete the isTester block here and
 * the one in `audienceFor` below - the member area reads `canSeeReports` off
 * /api/me, so the sidebar follows on its own.
 */
import { sessionEmail } from './session.js';
import { isActive, entitlementsFor } from './db.js';
import { isAdmin } from './admin.js';
import { isTester } from './testers.js';
import { MEMBERSHIP_ONLY } from './products.js';

export function reportsOpenTo(email) {
  return isTester(email) || isAdmin(email);
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
 * While the reports are behind the preview, so is the email. A member who
 * cannot open the report should not be told it is ready - that is a worse
 * experience than not hearing about it at all, and it is the mistake a
 * half-opened feature makes.
 */
export function audienceFor(members) {
  return members.filter((m) => reportsOpenTo(m.email));
}
