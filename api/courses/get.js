import { readSession } from '../../lib/session.js';
import { isActive, getCourse } from '../../lib/db.js';

/**
 * GET /api/courses/get?slug=…  — one course's full section/lesson tree, for the
 * player. Lesson bodies are fetched separately via /api/library/item.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const slug = new URL(req.url, 'http://localhost').searchParams.get('slug');
    if (!slug) return res.status(400).json({ error: 'missing slug' });

    const row = await getCourse(slug);
    if (!row) return res.status(404).json({ error: 'not found' });

    // The Bunny video id stays server-side: the player asks /api/video/sign for
    // a short-lived URL instead, so the id is never sitting in the page for
    // someone to lift. All the tree needs to say is whether a video exists.
    const data = row.data || {};
    const sections = (data.sections || []).map(s => ({
      ...s,
      lessons: (s.lessons || []).map(({ videoId, clips, ...l }) => ({
        ...l,
        hasVideo: !!videoId,
        // The shape is not secret and the player needs it before the video
        // loads, or the frame is drawn at 16:9 and then jumps.
        // Clips keep their titles for the same reason; only the ids are held back.
        clips: (clips || []).map(({ videoId: _id, ...c }) => c)
      }))
    }));

    return res.status(200).json({
      slug: row.slug, title: row.title,
      lessonCount: row.lesson_count,
      sections,
      stats: data.stats || null
    });
  } catch (err) {
    console.error('[courses/get]', err);
    return res.status(500).json({ error: 'server' });
  }
}
