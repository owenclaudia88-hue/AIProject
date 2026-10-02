import { sessionEmail } from '../../lib/session.js';
import { isActive, entitlementsFor, getCourse, addProject, projectsFor } from '../../lib/db.js';
import { isTester } from '../../lib/testers.js';

/**
 * The Projects & Resources tab.
 *
 *   GET  /api/projects?course=<slug>   what this member has handed in, plus the
 *                                      course's own brief
 *   POST /api/projects                 hand one in
 *
 * A submission is only accepted for a course the member can actually open, so
 * the entitlement check that gates the lessons gates this too — otherwise the
 * tab becomes a way to attach anything to any course.
 */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isTester(email)) return res.status(404).json({ error: 'not available' });

  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });
    const entitled = await entitlementsFor(email);

    if (req.method === 'GET') {
      const slug = String(req.query.course ?? '');
      const course = await getCourse(slug, entitled);
      if (!course) return res.status(404).json({ error: 'no such course' });

      return res.status(200).json({
        // The brief, written beside the course's other copy. Null until one
        // exists, and the tab says so rather than showing an empty box.
        brief: course.data?.projects || null,
        mine: await projectsFor(email, slug)
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const slug = String(body.course ?? '');
      const course = await getCourse(slug, entitled);
      if (!course) return res.status(404).json({ error: 'no such course' });

      const text = String(body.body ?? '').trim();
      const url = String(body.url ?? '').trim();
      if (!text && !url) {
        return res.status(400).json({ error: 'Write something about it, or add a link.' });
      }
      // A link has to be a link. Anything else is pasted into the body, where
      // it is text and cannot become a clickable destination.
      if (url && !/^https?:\/\/\S+$/i.test(url)) {
        return res.status(400).json({ error: 'That link does not look like a web address.' });
      }

      const saved = await addProject(email, {
        courseSlug: slug,
        lessonId: typeof body.lessonId === 'string' ? body.lessonId : null,
        title: body.title,
        body: text,
        url
      });
      return res.status(200).json({ ok: true, project: saved });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[projects]', err);
    return res.status(500).json({ error: 'server' });
  }
}
