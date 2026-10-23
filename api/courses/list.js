import { sessionEmail } from '../../lib/session.js';
import { isActive, listCourses, entitlementsFor } from '../../lib/db.js';
import { isTester } from '../../lib/testers.js';
import { isAdmin } from '../../lib/admin.js';
import { EDWARD, DFY_OPERATORS, funnelEngineOnShow, funnelEngineLock } from '../../lib/products.js';

const BUMPS = new Set([EDWARD, DFY_OPERATORS]);

/** GET /api/courses/list — the Courses tab: one card per course, with stats. */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });
    // A course written but not announced is for the test account and staff
    // only. Separate from the lock: that says "not bought", this says "not
    // for sale yet".
    const preview = isTester(email) || isAdmin(email);
    const entitled = await entitlementsFor(email);
    const rows = await listCourses(entitled, { preview });
    const onShow = new Set(funnelEngineOnShow(entitled));
    /* The Funnel Engine is not lent by the membership, so its lock - and its
       two bumps' - sends people to its own page rather than to join.html. The
       bumps are sold only at that checkout, so somebody who already owns the
       engine without one has nowhere to buy it: a lock there would be a door
       with no handle, and the course is left out until it is theirs. */
    const courses = rows.filter((r) => !(r.locked && BUMPS.has(r.requires) && !onShow.has(r.requires))).map(r => ({
      slug: r.slug, title: r.title,
      lessonCount: r.lesson_count,
      sectionCount: r.section_count,
      stats: r.stats || null,
      // Shown with a lock rather than hidden: a course nobody can see is a
      // course nobody knows they are missing.
      locked: r.locked === true,
      ...(r.locked ? funnelEngineLock(r.requires) || {} : {})
    }));
    return res.status(200).json({ courses });
  } catch (err) {
    console.error('[courses/list]', err);
    return res.status(500).json({ error: 'server' });
  }
}
