import { sessionEmail } from '../../lib/session.js';
import { listProjects, setProjectFeedback, displayNameFor, getCustomer } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET  /api/admin/projects          everything members have handed in
 * POST /api/admin/projects          { id, feedback } — reply to one
 *
 * Feedback is written back onto the submission it answers, so a reply can never
 * end up attached to a different attempt by the same person. Sending an empty
 * reply clears it and puts the row back in the queue, which is the only way to
 * take back something sent in error.
 */
export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'bad id' });

      const row = await setProjectFeedback(id, body.feedback);
      if (!row) return res.status(404).json({ error: 'no such project' });
      return res.status(200).json({ ok: true, project: row });
    }

    if (req.method === 'GET') {
      const rows = await listProjects(500);

      // Staff see who handed a project in, so the name is resolved the same way
      // it is everywhere else rather than showing a raw address.
      const names = new Map();
      for (const r of rows) {
        if (names.has(r.email)) continue;
        const c = await getCustomer(r.email).catch(() => null);
        names.set(r.email, displayNameFor(r.email, c?.name));
      }

      return res.status(200).json({
        projects: rows.map((r) => ({
          id: Number(r.id),
          email: r.email,
          name: names.get(r.email),
          courseSlug: r.course_slug,
          lessonId: r.lesson_id,
          title: r.title,
          body: r.body,
          url: r.url,
          status: r.status,
          feedback: r.feedback,
          feedbackAt: r.feedback_at,
          createdAt: r.created_at
        })),
        counts: {
          total: rows.length,
          waiting: rows.filter((r) => r.status !== 'reviewed').length
        }
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[admin/projects]', err);
    return res.status(500).json({ error: 'server' });
  }
}
