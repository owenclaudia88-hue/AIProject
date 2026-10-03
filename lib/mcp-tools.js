/**
 * What Claude can do with a member's library.
 *
 * Everything here is read-only, and - this is the part that matters - every
 * tool reaches the content through the same `listLibrary` / `getLibraryItem` /
 * `listCourses` / `getCourse` functions the website calls, handed the same
 * entitlement set. There is no second query path, so the connector cannot drift
 * away from what the member area shows and start handing out content somebody
 * has not got. A new course gated tomorrow is gated here the same day.
 */
import {
  listLibrary, getLibraryItem, listCourses, getCourse, relatedLibraryItems,
  getGuide, getGallery
} from './db.js';
import { siteUrl } from './oauth.js';

/** The content kinds, named as the member area names them. */
export const KINDS = {
  prompt: 'LLM Prompts',
  image_prompt: 'Image & Video Prompts',
  skill: 'Agents & Skills',
  gpt: 'Custom GPTs',
  automation: 'Automation Templates',
  guide: 'Prompting Fundamentals',
  video: 'Tutorials',
  routine: 'Claude Routines'
};

const KIND_KEYS = Object.keys(KINDS);

/**
 * Course lessons live in the same table as everything else, under their own
 * kind. The member area leaves them out of the library views because courses
 * have their own player, and the same applies here: they are not a category
 * anybody browses. Search still finds them, because "which lesson covers
 * connectors" is a fair question - they are just labelled for what they are.
 */
const LESSON = 'lesson';

/* ---------------- helpers ---------------- */

/** Markup is for a browser. Claude gets text. */
function toText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The course overview, which is a structured object rather than a blob of
 * HTML. Flattened in the order the member area renders it.
 */
function aboutText(about) {
  if (typeof about === 'string') return about;
  const out = [];
  const push = (v) => { if (v) out.push(v); };
  push(about.summary);
  (about.intro || []).forEach(push);
  if (about.forWho) {
    push(about.forWho.lead);
    (about.forWho.items || []).forEach((i) => push(`• ${i}`));
  }
  if (about.learn) {
    push(about.learn.lead);
    (about.learn.items || []).forEach((i) => push(Array.isArray(i) ? `• ${i[0]} — ${i[1]}` : `• ${i}`));
  }
  (about.why || []).forEach(push);
  if (about.project) {
    push(about.project.lead);
    (about.project.items || []).forEach((i) => push(`• ${i}`));
  }
  return out.join('\n\n');
}

const brief = (r) => ({
  id: r.id,
  kind: r.kind,
  kind_label: r.kind === LESSON ? 'Course lesson' : (KINDS[r.kind] || r.kind),
  title: r.title,
  category: r.category || undefined,
  course: r.course || undefined,
  description: r.description || undefined,
  likes: r.likes ?? 0
});

/** Scores a row against the words asked for. Title beats everything else. */
function score(row, words) {
  const title = String(row.title || '').toLowerCase();
  const cat = `${row.category || ''} ${row.course || ''}`.toLowerCase();
  const desc = String(row.description || '').toLowerCase();
  const tags = (Array.isArray(row.tags) ? row.tags : []).join(' ').toLowerCase();
  let n = 0;
  for (const w of words) {
    if (title.includes(w)) n += 10;
    else if (tags.includes(w)) n += 5;
    else if (cat.includes(w)) n += 3;
    else if (desc.includes(w)) n += 2;
    else return 0; // every word has to land somewhere, or it is not a match
  }
  // A nudge from what other members liked, never enough to beat a title hit.
  return n + Math.min(Number(row.likes) || 0, 20) / 100;
}

/* ---------------- the tools ---------------- */

export const TOOLS = [
  {
    name: 'search_library',
    description:
      'Search the member\'s AI Founder University library: LLM prompts, image and video prompts, '
      + 'Claude skills and agents, custom GPTs, automation templates, tutorials and guides. '
      + 'Returns matching items with their ids. Use get_item to read one in full.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, e.g. "cold outreach email" or "carousel".' },
        kind: { type: 'string', enum: KIND_KEYS, description: 'Restrict to one kind of content.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
      },
      required: ['query']
    },
    async run({ query, kind, limit }, entitled) {
      const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
      if (!words.length) return { error: 'Give something to search for.' };

      const rows = await listLibrary(KIND_KEYS.includes(kind) ? kind : undefined, entitled);
      const hits = rows
        .filter((r) => !r.locked)
        .map((r) => ({ r, s: score(r, words) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, Math.min(Number(limit) || 20, 50))
        .map((x) => brief(x.r));

      return {
        query, matches: hits.length, results: hits,
        ...(hits.length ? {} : { hint: 'Nothing matched. Try fewer or broader words, or call list_categories to see what is in the library.' })
      };
    }
  },

  {
    name: 'get_item',
    description:
      'Read one library item in full — the whole prompt, skill, template or guide, ready to use. '
      + 'Takes an id from search_library or list_categories.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The item id.' } },
      required: ['id']
    },
    async run({ id }, entitled) {
      const row = await getLibraryItem(String(id || ''), entitled);
      if (!row) return { error: 'No item with that id is open to this member.' };

      // body_html is not the only place content lives, and reading only that
      // would have reported a third of the library as empty: long-form guides
      // are in their own table, an image-prompt collection keeps its prompts
      // on the gallery tiles, and automation blueprints are a file. Each one
      // is fetched from wherever the site fetches it.
      const [related, guide, tiles] = await Promise.all([
        relatedLibraryItems(row.id, row.kind, row.category, 4).catch(() => []),
        getGuide(row.id).catch(() => null),
        row.kind === 'image_prompt' ? getGallery(row.id).catch(() => []) : Promise.resolve([])
      ]);

      const meta = row.meta || {};
      const content = toText(row.body_html);
      const guideText = toText(guide);
      const prompts = (tiles || []).map((t) => t.prompt).filter(Boolean);

      const out = {
        ...brief(row),
        tags: (row.tags || []).length ? row.tags : undefined,
        // Where to open it themselves — the file behind a download is served
        // against their session, so it has to be fetched from the member area.
        open_at: `${siteUrl()}/members/#${row.kind}`
      };
      if (content) out.content = content;
      if (guideText) out.guide = guideText;
      if (prompts.length) out.prompts = prompts;
      if (meta.fileKey || meta.fileName) {
        out.download = `This item is a downloadable file${meta.fileName ? ` (${meta.fileName})` : ''}. `
          + `Open it from the member area at ${out.open_at}.`;
      }
      if (!content && !guideText && !prompts.length && !out.download) {
        out.note = 'This item is a video with no written notes. Its title and description are above.';
      }
      out.related = related.map((r) => ({ id: r.id, title: r.title }));
      return out;
    }
  },

  {
    name: 'list_categories',
    description:
      'What is in the library: every kind of content, its categories, and how many items each holds. '
      + 'Good for getting your bearings before searching.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: KIND_KEYS, description: 'Only this kind.' } }
    },
    async run({ kind }, entitled) {
      const rows = (await listLibrary(KIND_KEYS.includes(kind) ? kind : undefined, entitled))
        .filter((r) => !r.locked && r.kind !== LESSON);
      const out = {};
      for (const r of rows) {
        const k = (out[r.kind] ||= { label: KINDS[r.kind] || r.kind, total: 0, categories: {} });
        k.total++;
        const c = r.category || r.course || 'General';
        k.categories[c] = (k.categories[c] || 0) + 1;
      }
      return { kinds: out };
    }
  },

  {
    name: 'popular',
    description:
      'The most-liked items in the member\'s library — what other members actually use. '
      + 'Use when asked for the best, most popular or proven prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: KIND_KEYS, description: 'Only this kind.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 15 }
      }
    },
    async run({ kind, limit }, entitled) {
      const rows = (await listLibrary(KIND_KEYS.includes(kind) ? kind : undefined, entitled))
        .filter((r) => !r.locked && r.kind !== LESSON && (Number(r.likes) || 0) > 0)
        .sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0))
        .slice(0, Math.min(Number(limit) || 15, 50));
      return { results: rows.map(brief) };
    }
  },

  {
    name: 'list_courses',
    description:
      'The member\'s courses, with how many sections and lessons each has. '
      + 'Use get_course for the lesson list of one.',
    inputSchema: { type: 'object', properties: {} },
    async run(_args, entitled) {
      const rows = await listCourses(entitled);
      return {
        courses: rows.filter((r) => !r.locked).map((r) => ({
          slug: r.slug,
          title: r.title,
          lessons: r.lesson_count ?? 0,
          sections: r.section_count ?? 0
        }))
      };
    }
  },

  {
    name: 'get_course',
    description:
      'A course\'s full outline: every section and every lesson, with the lesson ids needed by get_lesson.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The course slug from list_courses.' } },
      required: ['slug']
    },
    async run({ slug }, entitled) {
      const row = await getCourse(String(slug || ''), entitled);
      if (!row) return { error: 'No course with that slug is open to this member.' };
      const data = row.data || {};
      return {
        slug: row.slug,
        title: row.title,
        lessons: row.lesson_count ?? 0,
        about: data.about ? toText(aboutText(data.about)) : undefined,
        sections: (data.sections || []).map((s) => ({
          name: s.name || s.label,
          // Named fields rather than a spread with the secrets deleted. The
          // tree also holds each lesson's Bunny video id, which never leaves
          // the server - the site signs a short-lived URL instead - and an
          // allowlist cannot start leaking it because the shape changed.
          lessons: (s.lessons || []).map((l) => ({
            id: l.libId,
            title: l.title,
            duration: l.duration || undefined,
            hasVideo: !!l.videoId
          }))
        }))
      };
    }
  },

  {
    name: 'get_lesson',
    description:
      'The written content of one course lesson. Lesson ids come from get_course. '
      + 'Returns the lesson notes and transcript text, not the video.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The lesson id from get_course.' } },
      required: ['id']
    },
    async run({ id }, entitled) {
      const row = await getLibraryItem(String(id || ''), entitled);
      if (!row) return { error: 'No lesson with that id is open to this member.' };
      const text = toText(row.body_html);
      return {
        id: row.id,
        title: row.title,
        course: row.course || undefined,
        content: text || undefined,
        ...(text ? {} : { note: 'This lesson is a video with no written notes. Its title and course are above.' })
      };
    }
  }
];

export const TOOL_SCHEMAS = TOOLS.map(({ name, description, inputSchema }) => ({
  name, description, inputSchema
}));

export function toolByName(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
