/**
 * The weekly writer, on a Tuesday.
 *
 *   read the week the sources had → pick what deserves a piece → write each
 *   one → check it → store as a draft for somebody to read.
 *
 * Nothing it writes reaches a member. Every piece lands as a draft and waits
 * for a person, which is the whole difference between this and a content farm:
 * the machine does the typing and a human decides whether it was worth saying.
 * A week where nothing is good enough is a week with no new tutorials, and
 * that is a correct outcome rather than a failure.
 *
 * `?dry=1` writes nothing down, which is how to look at a week before trusting
 * it. `?want=N` changes how many to attempt.
 */
import { writeTheWeek } from '../../lib/library-generate.js';
import { illustrate } from '../../lib/library-figures.js';
import { listNews, saveDraftItem, draftItems } from '../../lib/db.js';
import { neon } from '@neondatabase/serverless';

/* Writing one piece is about two minutes and drawing its pictures another one,
   so this does not fit in the default 300 seconds - the first run with figures
   timed out and stored nothing at all. */
export const config = { maxDuration: 800 };

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 60);

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'no_key', message: 'ANTHROPIC_API_KEY is not set.' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  const want = Math.max(1, Math.min(5, Number(url.searchParams.get('want')) || 4));
  const started = Date.now();

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Eight days, so a Tuesday run still has the previous week's Friday in it.
    const stories = (await listNews({ limit: 60, offset: 0 })).map((r) => ({
      title: r.title, sourceName: r.source_name, url: r.url, source: r.source,
      summary: r.summary, publishedAt: r.published_at,
      // Who else covered the same announcement, so the writer can read all of it.
      also: r.also || []
    }));

    if (stories.length < 8) {
      return res.status(200).json({
        ok: true, skipped: `only ${stories.length} stories in the feed`, ms: Date.now() - started
      });
    }

    /* What we have already written about, so a second Dots tutorial does not
       appear a fortnight after the first. Drafts count too - something waiting
       to be read is still something we have covered. */
    const recent = await sql`
      select title from library
      where kind = 'video'
      order by coalesce(written_at, source_created_at) desc nulls last limit 14`;

    const out = await writeTheWeek({
      stories, recentTitles: recent.map((r) => r.title), want
    });

    if (dry) {
      return res.status(200).json({
        ok: true, dry: true,
        passed: out.passed,
        pieces: out.pieces.map(({ pick, piece, fail }) => ({
          shape: pick.shape, from: pick.url, held: fail,
          title: piece?.title, description: piece?.description, heroText: piece?.heroText,
          readMinutes: piece?.readMinutes, difficulty: piece?.difficulty, category: piece?.category,
          tags: piece?.tags,
          words: piece ? piece.bodyHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0,
          sections: piece ? [...piece.bodyHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
            .map((m) => m[1].replace(/<[^>]*>/g, '').trim()) : []
        })),
        stats: out.stats, ms: Date.now() - started
      });
    }

    const saved = [];
    for (const { pick, story, piece, fail, sources } of out.pieces) {
      if (!piece) continue;
      /* Held pieces are stored too, marked with what stopped them. A near miss
         is worth ten minutes of editing; deleting it makes that impossible and
         hides from the admin that the writer is drifting. */
      const id = `w-${slug(piece.title)}-${Date.now().toString(36).slice(-4)}`;

      /* The pictures, drawn after the words because they are described by them.
         A figure that cannot be drawn takes its marker out of the text with
         it, so a published tutorial never shows "[[FIGURE 3]]". */
      let art = { html: piece.bodyHtml, made: [], failed: [{ n: 0, why: 'not attempted' }] };
      try {
        art = await illustrate({ piece, itemId: id, subject: pick.title, story });
      } catch (err) {
        console.error('[cron/library] figures', err?.message);
        art = { html: piece.bodyHtml.replace(/\[\[FIGURE\s*\d+\]\]/gi, ''), made: [],
          failed: [{ n: 0, why: String(err.message || err).slice(0, 120) }] };
      }

      await saveDraftItem({
        id, kind: 'video', category: piece.category, title: piece.title,
        description: piece.description, bodyHtml: art.html,
        tags: (piece.tags || []).slice(0, 5), sourceStory: story.url,
        meta: {
          level: piece.difficulty, readTime: `${piece.readMinutes} min read`,
          heroText: piece.heroText, shape: pick.shape,
          sources: piece.sources || [], held: fail,
          // What it was actually written from, so the admin can see whether a
          // thin piece was thin because the material was.
          readFrom: sources || [],
          figures: art.made.length, figuresFailed: art.failed
        }
      });
      saved.push({ id, title: piece.title, held: fail, figures: art.made.length,
        readFrom: (sources || []).length });
    }

    const waiting = await draftItems();

    return res.status(200).json({
      ok: true,
      considered: out.stats.considered,
      picked: out.stats.picked,
      written: saved.length,
      clean: saved.filter((s) => !s.held.length).length,
      held: saved.filter((s) => s.held.length).map((s) => ({ title: s.title, why: s.held })),
      /* Why a chosen piece produced nothing. Without this the run answered
         "picked 1, written 0" and said no more, which is the least useful
         thing a report can do: the reason was that the writer had been given
         too small a token budget for the length it was asked for, and nothing
         on the screen could have told anybody that. */
      failedToWrite: out.pieces.filter((p) => !p.piece)
        .map((p) => ({ title: p.pick.title, why: p.fail })),
      waitingForReview: waiting.length,
      passed: out.passed,
      cost: out.stats.cost,
      ms: Date.now() - started
    });
  } catch (err) {
    console.error('[cron/library]', err);
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}
