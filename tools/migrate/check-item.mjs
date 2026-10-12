/**
 * Is this row fit to publish without anybody looking at it?
 *
 * Nothing here is a taste test. The question is only whether the item we would
 * store is as complete as the one on the source site — because the thing that
 * actually goes wrong in a migration is not a bad item, it is a good item
 * arriving with its picture missing, its download lost, or its body left
 * behind in an HTML file nobody fetched.
 *
 * So the main check is parity: for every part the source row offers, we must
 * have got it. A row with no thumbnail passes happily; a row whose thumbnail we
 * failed to download does not. That rule needs no list of fields per kind and
 * does not go stale when they add one.
 *
 * On top of it sit a few floors, taken from measuring the 1,322 items already
 * published rather than from taste: every kind has a title and a description,
 * and each kind's own substance - the prompt text, the skill's file, the
 * automation's blueprint - has to be there. Deliberately NOT required: a video
 * URL on a video, because only 15 of the 71 videos already live have one, and
 * a rule demanding it would hold most of them back for being normal.
 */

/** Non-empty after trimming, and not one of the placeholders exports leave. */
const real = (v) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (!s) return false;
  return !/^(null|undefined|n\/a|tbd|untitled|test|lorem ipsum)\.?$/i.test(s);
};

const hasText = (v, min = 1) => real(v) && String(v).trim().length >= min;

/** Raw JSON or a template that never got filled in, rendered as a body. */
function looksBroken(html) {
  const s = String(html || '');
  if (!s.trim()) return null;
  if (/^\s*[[{]/.test(s.trim()) && /"[a-z_]+"\s*:/i.test(s)) return 'the body is raw JSON';

  /* A placeholder is ordinary content here, and that took two goes to accept.
     A voice-agent tutorial says to use {{first_name}} in a <code> tag; it also
     hands you a call script, in a plain div, reading "Hi {{first_name}}, you
     asked about [service] on {{inquiry_date}}". Both were held, and both are
     the thing the tutorial exists to teach. On a library of prompts and
     templates, variables are the subject matter.

     What a filled-in template never looks like is a stub. So this fires only
     on a body with barely any text in it that is nonetheless carrying
     placeholders — "Hi {{first_name}}, welcome to {{product}}" and nothing
     else — and leaves every real document alone. */
  const text = s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
  const STUB = 400;
  if (text.length < STUB && /\{\{\s*[a-z_.]+\s*\}\}/i.test(text)) {
    return 'the body is a stub with {{placeholders}} and nothing else';
  }
  if (text.length < STUB && /\bundefined\b/.test(text)) {
    return 'the body is a stub with "undefined" in it';
  }
  // Tags and spacing only — "<p>&nbsp;</p><br>" and friends. Closing tags go
  // in the list too; without them this matched nothing real.
  if (/^(?:\s|<\/?(?:p|br|div|span|em|strong)\s*\/?>|&nbsp;|&#160;)*$/i.test(s)) {
    return 'the body is empty markup';
  }
  return null;
}

/* What each kind must carry to be worth a member's click.
   Taken from the field names the source actually uses and how often it fills
   them, counted over the 1,191 rows already on disk — not from what the fields
   sound like they should be called. A skill's download is `skill_url`, a GPT's
   body is `instructions` and there is no gpt_url on any of the fifteen, an
   automation's blueprint is `template_content`, and fifty of the image prompts
   are gallery collections whose prompts live in `gallery_prompts`. Every one
   of those was wrong on the first pass and would have held good items back. */
const some = (v) => Array.isArray(v) ? v.length > 0 : v != null && v !== '';

const SUBSTANCE = {
  prompts: (r) => (hasText(r.content, 20) ? null : 'no prompt text'),
  image_prompts: (r) => (hasText(r.prompt_text, 10) || some(r.prompt_items) || some(r.gallery_prompts)
    ? null : 'no prompt text, prompt items or gallery'),
  claude_skills: (r) => (r.skill_url || r.html_file_url || hasText(r.instructions, 40)
    ? null : 'no skill file and no instructions'),
  custom_gpts: (r) => (hasText(r.instructions, 40) || some(r.prompt_items)
    ? null : 'no instructions and no prompts'),
  automation_templates: (r) => (some(r.template_content) || hasText(r.instructions, 40)
    ? null : 'no blueprint and no instructions'),
  /* A video counts as the body here. Four of the nine guides already published
     carry "New, updated video coming soon!" as their text and the whole lesson
     in a video_url — thin prose, but not a broken item, and holding them would
     be holding working guides for being video-first. */
  guides: (r) => (hasText(r.content, 60) || some(r.rich_content) || r.html_file_url || r.video_url
    ? null : 'no guide body'),
  // Deliberately permissive: of the 71 videos already published only 15 carry
  // a video_url, so demanding one would hold most of them back for being
  // ordinary.
  videos: (r) => (r.video_url || hasText(r.content, 40) || hasText(r.instructions, 40) || r.html_file_url
    ? null : 'no video and no write-up')
};

/** The file an item offers a member, wherever that kind keeps it. */
export function downloadUrlFor(row) {
  if (row.skill_url) return row.skill_url;
  const tc = row.template_content;
  if (tc && typeof tc === 'object' && tc.downloadUrl) return tc.downloadUrl;
  if (typeof tc === 'string' && /^https?:\/\//.test(tc)) return tc;
  return null;
}

/**
 * @param table  the source table the row came from
 * @param row    the row exactly as the source API returned it
 * @param got    what we actually managed to fetch for it:
 *               { thumb, guideHtml, files: [names], bodyHtml }
 * @returns      [] when it is fit to publish, otherwise the reasons it is not
 */
export function checkItem(table, row, got = {}) {
  const problems = [];

  /* ---- the floors ---- */
  if (!hasText(row.title, 3)) problems.push('no usable title');
  if (!hasText(row.description, 20)) problems.push('no description');

  const substance = SUBSTANCE[table];
  if (substance) {
    const missing = substance(row);
    if (missing) problems.push(missing);
  }

  /* ---- parity: what the source has, we must have ---- */
  if (row.thumbnail_url && !got.thumb) {
    problems.push('the source has a thumbnail and we did not get it');
  }
  if (row.example_image_url && !got.exampleImage) {
    problems.push('the source has an example image and we did not get it');
  }
  if (row.html_file_url && !got.guideHtml) {
    problems.push('the body lives in a separate file and we did not get it');
  }
  // The file is the whole point of a skill, and of an automation's blueprint.
  if (downloadUrlFor(row) && !(got.files || []).length) {
    problems.push('the source offers a download and we did not get it');
  }

  /* ---- what we would actually store ---- */
  const bodyFault = looksBroken(got.bodyHtml ?? row.content ?? row.instructions);
  if (bodyFault) problems.push(bodyFault);

  return problems;
}

/**
 * The same question asked of the row after it is in our database, which is the
 * only place that can tell us whether what we stored is what a member will see.
 * Run after the ingest, so anything that slipped through is taken straight back
 * down rather than sitting live and wrong.
 */
export function checkStored(item, assetsResolve) {
  const problems = [];
  if (!hasText(item.title, 3)) problems.push('stored without a title');
  if (!hasText(item.description, 20)) problems.push('stored without a description');
  if (item.thumb_key && !assetsResolve.has(item.thumb_key)) {
    problems.push('its picture is not in storage');
  }
  const fileKey = item.meta?.fileKey;
  if (fileKey && !assetsResolve.has(fileKey)) problems.push('its download is not in storage');
  const bodyFault = looksBroken(item.body_html);
  if (bodyFault) problems.push(bodyFault);
  return problems;
}

export { real, hasText, looksBroken };
