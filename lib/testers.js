/**
 * Who sees a feature that is not finished yet.
 *
 * New course features go live to one account first so they can be broken in
 * private. Everybody else sees the member area exactly as it was, which is the
 * point: a half-built tab in front of paying members is worse than no tab.
 *
 * Set TESTER_EMAILS to a comma-separated list to change who that is. The
 * default is the account the member area is tested on.
 *
 * This gates visibility, never access to anything paid for. A tester sees an
 * unfinished tab; they do not get content they have not bought.
 */
const DEFAULT_TESTERS = 'owenclaudia88@gmail.com';

const list = () =>
  String(process.env.TESTER_EMAILS ?? DEFAULT_TESTERS)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function isTester(email) {
  const e = String(email ?? '').trim().toLowerCase();
  return !!e && list().includes(e);
}
