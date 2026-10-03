/**
 * Who is allowed into the community, decided once.
 *
 * The rule has three parts and every endpoint needs all three, which is
 * exactly the kind of thing that drifts when it is written out five times:
 * signed in, still a customer, and holding the membership. Staff are exempt
 * from the last two because they have never bought anything — the same
 * exception the comment endpoints already make.
 */
import { sessionEmail } from './session.js';
import { isActive, entitlementsFor } from './db.js';
import { isAdmin } from './admin.js';
import { isTester } from './testers.js';
import { MEMBERSHIP_ONLY } from './products.js';

/**
 * `{ email, isAdmin }`, or `{ error, status }`.
 *
 * Returned rather than thrown so a caller cannot forget to handle it: there is
 * no shape here that looks like success and is not.
 */
export async function communityMember(req) {
  const email = await sessionEmail(req);
  if (!email) return { status: 401, error: 'not signed in' };

  // Not finished yet, so it is open to the test account and to staff only.
  // Checked before the membership rule on purpose: telling a member they need
  // a subscription for something they could not have either way would be a
  // misleading answer to the wrong question. Remove this once every phase is
  // done and the community opens to everybody who subscribes.
  if (!isTester(email) && !isAdmin(email)) {
    return { status: 403, error: 'not available', message: 'The community is not open yet.' };
  }

  if (isAdmin(email)) return { email, isAdmin: true };

  if (!(await isActive(email))) return { status: 403, error: 'not active' };

  const held = await entitlementsFor(email);
  if (!held.has(MEMBERSHIP_ONLY)) {
    return { status: 403, error: 'membership', message: 'The community is part of the membership.' };
  }
  return { email, isAdmin: false };
}
