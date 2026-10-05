/**
 * Who can see the AI news feed, decided once.
 *
 * Not finished yet, so it is the test account's and staff's alone, the way the
 * weekly reports started. Checked before the membership rule on purpose:
 * telling somebody they need a subscription for something they could not have
 * either way answers a question they did not ask.
 *
 * To open it to everybody who subscribes, make `newsOpenTo` return true - the
 * member area reads `canSeeNews` off /api/me, so the sidebar follows on its
 * own, and the membership check below is already the one the reports settled
 * on: a live subscription, trial or paid.
 */
import { sessionEmail } from './session.js';
import { isActive, entitlementsFor } from './db.js';
import { isAdmin } from './admin.js';
import { isTester } from './testers.js';
import { MEMBERSHIP_ONLY } from './products.js';

export function newsOpenTo(email) {
  return isTester(email) || isAdmin(email);
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
