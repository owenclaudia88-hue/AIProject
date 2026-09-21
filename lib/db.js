import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

/**
 * Neon Postgres access for the member area.
 *
 * Two tables (see schema.sql):
 *   customers      — one row per buyer, status active | revoked
 *   login_tokens   — single-use, hashed magic-link tokens
 *
 * ensureSchema() creates them if missing, so a fresh Neon database works with
 * no manual setup. It runs at most once per warm serverless instance.
 */

let _sql = null;
function db() {
  if (_sql) return _sql;
  // Vercel's Neon integration injects the connection string under one of these
  // names depending on how it was added; accept any so no manual renaming is
  // needed. Prefer a pooled URL for serverless.
  const url = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) throw new Error('No Postgres connection string set (DATABASE_URL / POSTGRES_URL)');
  _sql = neon(url);
  return _sql;
}

let _schemaReady = null;
export async function ensureSchema() {
  if (_schemaReady) return _schemaReady;
  const sql = db();
  _schemaReady = (async () => {
    await sql`
      create table if not exists customers (
        email               text primary key,
        status              text not null default 'active',
        stripe_customer_id  text,
        last_payment_intent text,
        created_at          timestamptz not null default now(),
        updated_at          timestamptz not null default now()
      )`;
    await sql`
      create table if not exists login_tokens (
        token_hash  text primary key,
        email       text not null,
        expires_at  timestamptz not null,
        used_at     timestamptz,
        created_at  timestamptz not null default now()
      )`;
    await sql`create index if not exists login_tokens_email_idx on login_tokens (email)`;
    // The member library: one row per downloadable item. blob_url is the private
    // Vercel Blob location, never sent to the browser — downloads stream through
    // the gated endpoint.
    await sql`
      create table if not exists content (
        key         text primary key,
        title       text not null,
        kind        text not null,
        filename    text,
        blob_url    text not null,
        size_bytes  bigint,
        sort        int not null default 0,
        created_at  timestamptz not null default now()
      )`;
    await sql`create index if not exists content_kind_idx on content (kind, sort)`;
    // Browsable text content (course lessons): body stays in the DB; inline
    // images are uploaded to Blob and referenced via library_assets.
    await sql`
      create table if not exists library (
        id          text primary key,
        kind        text not null,
        course      text,
        category    text,
        title       text not null,
        description text,
        body_html   text,
        thumb_key   text,
        sort        int not null default 0,
        created_at  timestamptz not null default now()
      )`;
    await sql`create index if not exists library_kind_idx on library (kind, category, sort)`;
    // Per-item extras carried over from the source tables: `tags` drives the
    // category chips and search, `meta` holds whatever is specific to a kind —
    // a video's url and duration, a skill's downloadable file, a prompt's use
    // cases and difficulty. Kept as jsonb so a new kind needs no migration.
    await sql`alter table library add column if not exists tags text[]`;
    await sql`alter table library add column if not exists meta jsonb`;
    // The source's own timestamp and favourite count, kept as columns rather
    // than in meta so the catalog can be sorted without loading every body.
    await sql`alter table library add column if not exists source_created_at timestamptz`;
    await sql`alter table library add column if not exists likes int`;
    // An image-prompt collection is many prompts, each with its own picture.
    // One row per tile, ordered by idx; asset_key points at the WebP in Blob.
    await sql`
      create table if not exists library_gallery (
        item_id    text not null references library (id) on delete cascade,
        idx        int not null,
        prompt     text,
        asset_key  text,
        primary key (item_id, idx)
      )`;
    await sql`create index if not exists library_gallery_item_idx on library_gallery (item_id, idx)`;
    // A long-form guide, already stripped of its own document shell and
    // restyled by the member area. Kept out of `library.meta` so the catalog
    // queries stay light — these run to ~30 KB each.
    await sql`
      create table if not exists library_guides (
        item_id text primary key references library (id) on delete cascade,
        html    text not null
      )`;
    await sql`
      create table if not exists library_assets (
        key           text primary key,
        blob_url      text not null,
        content_type  text
      )`;
    // Course structure (sections → lessons) for the Circle-style player. The
    // lesson bodies live in `library` (id = lesson:<slug>); this table only
    // holds the tree, in `data` (jsonb): { sections:[{ name, lessons:[…] }] }.
    await sql`
      create table if not exists courses (
        slug         text primary key,
        title        text not null,
        lesson_count int not null default 0,
        sort         int not null default 0,
        data         jsonb not null,
        created_at   timestamptz not null default now()
      )`;
    await sql`create index if not exists courses_sort_idx on courses (sort)`;
    // Display name shown next to a member's comments. Nullable — the member
    // sets it the first time they post; until then the email local-part is used.
    await sql`alter table customers add column if not exists name text`;
    // Course discussion. One thread per course: every member sees every
    // comment, replies hang off parent_id, and staff replies carry is_admin.
    // lesson_id / lesson_title are denormalised so the panel can label which
    // lesson a comment came from without loading the course tree.
    await sql`
      create table if not exists comments (
        id            bigserial primary key,
        course_slug   text not null,
        lesson_id     text,
        lesson_title  text,
        parent_id     bigint references comments (id) on delete cascade,
        email         text not null,
        is_admin      boolean not null default false,
        body          text not null,
        created_at    timestamptz not null default now(),
        deleted_at    timestamptz
      )`;
    await sql`create index if not exists comments_course_idx on comments (course_slug, created_at)`;
    await sql`create index if not exists comments_parent_idx on comments (parent_id)`;
    // Bookmarked lessons, per member. course_slug/title are denormalised so the
    // Bookmarks view renders without fetching every course tree.
    await sql`
      create table if not exists bookmarks (
        email       text not null,
        lesson_id   text not null,
        course_slug text not null,
        title       text,
        created_at  timestamptz not null default now(),
        primary key (email, lesson_id)
      )`;
    await sql`create index if not exists bookmarks_email_idx on bookmarks (email, created_at desc)`;
    // What members ask us to make next. Status is moved by staff from the
    // admin view; nothing here is ever shown to other members.
    await sql`
      create table if not exists content_requests (
        id          bigserial primary key,
        email       text not null,
        title       text not null,
        body        text,
        status      text not null default 'new',
        created_at  timestamptz not null default now()
      )`;
    await sql`create index if not exists content_requests_idx on content_requests (status, created_at desc)`;
    // Who we have written to, and about what. One row per person per kind of
    // message, so a reminder cannot be sent twice by two people clicking the
    // same button, and the dashboard can say when it went.
    await sql`
      create table if not exists outreach (
        email      text not null,
        kind       text not null,
        sent_at    timestamptz not null default now(),
        primary key (email, kind)
      )`;
    // Anyone who asked not to hear from us again. Checked before every send,
    // and never removed by us — only the person themselves gets to decide.
    await sql`
      create table if not exists email_optouts (
        email      text primary key,
        created_at timestamptz not null default now()
      )`;
    // Small knobs staff can turn without a redeploy — how long to wait before
    // the checkout reminder goes out, and whether it goes at all.
    await sql`
      create table if not exists settings (
        key        text primary key,
        value      text,
        updated_at timestamptz not null default now()
      )`;
  })();
  return _schemaReady;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Grant (or refresh) access for a buyer. Called from the Stripe webhook.
 * Returns true if this created a new customer (so the caller can send the
 * welcome email only on the first purchase). `xmax = 0` is Postgres's way of
 * telling an INSERT apart from an UPDATE in an upsert.
 */
export async function grantAccess(email, { paymentIntent, stripeCustomerId, name } = {}) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  const clean = String(name || '').trim().slice(0, 60) || null;
  const rows = await sql`
    insert into customers (email, status, stripe_customer_id, last_payment_intent, name, updated_at)
    values (${e}, 'active', ${stripeCustomerId ?? null}, ${paymentIntent ?? null}, ${clean}, now())
    on conflict (email) do update set
      status = 'active',
      stripe_customer_id = coalesce(${stripeCustomerId ?? null}, customers.stripe_customer_id),
      last_payment_intent = coalesce(${paymentIntent ?? null}, customers.last_payment_intent),
      -- The name they gave at checkout only fills a blank. If they have since
      -- set their own display name, that is the one they want to be known by
      -- and a repeat purchase must not overwrite it.
      name = coalesce(customers.name, ${clean}),
      updated_at = now()
    returning (xmax = 0) as created`;
  return rows[0]?.created === true;
}

/* ---------------- settings ---------------- */

export async function getSettings() {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select key, value from settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(key, value) {
  const sql = db();
  await ensureSchema();
  await sql`insert into settings (key, value) values (${key}, ${value == null ? null : String(value)})
            on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

/* ---------------- outreach ---------------- */

/** When, if ever, each address was last sent a message of this kind. */
export async function outreachLog(kind) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email, sent_at from outreach where kind = ${kind}`;
  return new Map(rows.map((r) => [r.email, r.sent_at]));
}

export async function recordOutreach(email, kind) {
  const sql = db();
  await ensureSchema();
  await sql`insert into outreach (email, kind) values (${normalizeEmail(email)}, ${kind})
            on conflict (email, kind) do update set sent_at = now()`;
}

/** Addresses that have asked not to be written to. */
export async function optOuts() {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email from email_optouts`;
  return new Set(rows.map((r) => r.email));
}

export async function optOut(email) {
  const sql = db();
  await ensureSchema();
  await sql`insert into email_optouts (email) values (${normalizeEmail(email)})
            on conflict (email) do nothing`;
}

/** Every customer row, newest first — the staff members list. */
export async function listCustomers() {
  const sql = db();
  await ensureSchema();
  return sql`select email, name, status, stripe_customer_id, last_payment_intent,
                    created_at, updated_at
               from customers order by created_at desc`;
}

/** Restore access to someone previously revoked. */
export async function restoreAccess(email) {
  const sql = db();
  await ensureSchema();
  await sql`update customers set status = 'active', updated_at = now()
             where email = ${normalizeEmail(email)}`;
}

/** Revoke access (refund/chargeback). */
export async function revokeAccess(email) {
  const sql = db();
  await ensureSchema();
  await sql`update customers set status = 'revoked', updated_at = now() where email = ${normalizeEmail(email)}`;
}

export async function getCustomer(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email, status, name, stripe_customer_id, last_payment_intent
                           from customers where email = ${normalizeEmail(email)} limit 1`;
  return rows[0] || null;
}

export async function isActive(email) {
  const c = await getCustomer(email);
  return !!c && c.status === 'active';
}

/* ---------------- magic-link tokens ---------------- */

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** Create a single-use login token; returns the raw token to email. */
export async function createLoginToken(email, ttlMinutes = 30) {
  const sql = db();
  await ensureSchema();
  const raw = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + ttlMinutes * 60_000);
  await sql`
    insert into login_tokens (token_hash, email, expires_at)
    values (${hashToken(raw)}, ${normalizeEmail(email)}, ${expires.toISOString()})`;
  return raw;
}

/* ---------------- content library ---------------- */

/** Add or replace one library item. Used by the upload tool. */
export async function upsertContent({ key, title, kind, filename, blobUrl, sizeBytes, sort }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into content (key, title, kind, filename, blob_url, size_bytes, sort)
    values (${key}, ${title}, ${kind}, ${filename ?? null}, ${blobUrl}, ${sizeBytes ?? null}, ${sort ?? 0})
    on conflict (key) do update set
      title = excluded.title, kind = excluded.kind, filename = excluded.filename,
      blob_url = excluded.blob_url, size_bytes = excluded.size_bytes, sort = excluded.sort`;
}

/** Catalog for the member area — never includes the private blob_url. */
export async function listContent() {
  const sql = db();
  await ensureSchema();
  return sql`select key, title, kind, filename, size_bytes from content order by kind, sort, title`;
}

/** The private blob location for one item, for the gated download stream. */
export async function getContentBlobUrl(key) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select blob_url, filename from content where key = ${key} limit 1`;
  return rows[0] || null;
}

/* ---------------- browsable library (courses, prompts, skills…) ---------------- */

export async function upsertLibraryItem({ id, kind, course, category, title, description, bodyHtml, thumbKey, sort, tags, meta, sourceCreatedAt, likes }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into library (id, kind, course, category, title, description, body_html, thumb_key, sort, tags, meta, source_created_at, likes)
    values (${id}, ${kind}, ${course ?? null}, ${category ?? null}, ${title}, ${description ?? null},
            ${bodyHtml ?? null}, ${thumbKey ?? null}, ${sort ?? 0},
            ${tags && tags.length ? tags : null}, ${meta ? JSON.stringify(meta) : null}::jsonb,
            ${sourceCreatedAt ?? null}, ${likes ?? null})
    on conflict (id) do update set
      kind = excluded.kind, course = excluded.course, category = excluded.category,
      title = excluded.title, description = excluded.description, body_html = excluded.body_html,
      thumb_key = excluded.thumb_key, sort = excluded.sort,
      tags = excluded.tags,
      -- Merge rather than replace. Other jobs write keys this one knows nothing
      -- about — the read time and level lifted out of an article's hero, for
      -- instance — and a plain assignment silently deleted them every time the
      -- main ingest ran again. Keys this ingest does set still win.
      meta = coalesce(library.meta, '{}'::jsonb) || coalesce(excluded.meta, '{}'::jsonb),
      source_created_at = excluded.source_created_at, likes = excluded.likes`;
}

/** Catalog — titles/metadata only, no bodies, for the browse view. */
export async function listLibrary(kind) {
  const sql = db();
  await ensureSchema();
  if (kind) {
    return sql`select id, kind, course, category, title, description, thumb_key, tags, source_created_at, likes
               from library where kind = ${kind} order by course, category, sort, title`;
  }
  return sql`select id, kind, course, category, title, description, thumb_key, tags, source_created_at, likes
             from library order by kind, course, category, sort, title`;
}

/** One item's full body, for the reader. */
export async function getLibraryItem(id) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select id, kind, course, category, title, description, body_html, thumb_key, tags, meta
                         from library where id = ${id} limit 1`;
  return rows[0] || null;
}

/* ---------------- courses (structure for the player) ---------------- */

export async function upsertCourse({ slug, title, lessonCount, sort, data }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into courses (slug, title, lesson_count, sort, data)
    values (${slug}, ${title}, ${lessonCount ?? 0}, ${sort ?? 0}, ${JSON.stringify(data)}::jsonb)
    on conflict (slug) do update set
      title = excluded.title, lesson_count = excluded.lesson_count,
      sort = excluded.sort, data = excluded.data`;
}

/** Course list for the Courses tab — no lesson tree, just the headline stats. */
export async function listCourses() {
  const sql = db();
  await ensureSchema();
  return sql`select slug, title, lesson_count, sort,
                    jsonb_array_length(data->'sections') as section_count,
                    (data->'stats') as stats
             from courses order by sort, title`;
}

/** One course with its full section/lesson tree, for the player. */
export async function getCourse(slug) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select slug, title, lesson_count, sort, data from courses where slug = ${slug} limit 1`;
  return rows[0] || null;
}

/**
 * The Bunny video id for one lesson, looked up by its library id.
 *
 * The id lives in the course tree rather than being handed to the browser with
 * the rest of the lesson, so an unauthenticated visitor never learns it: the
 * player asks /api/video/sign for a URL and gets one only if its session is a
 * paying member's.
 */
export async function lessonVideoId(libId, clip = null) {
  const sql = db();
  await ensureSchema();

  // A lesson can also walk through several recordings inside its body — the
  // "Demo" lesson is three of them — each stored as a numbered clip.
  if (clip !== null) {
    const rows = await sql`
      -- the index arrives as text, and -> treats text as an object key rather
      -- than an array position, so it has to be cast
      select l->'clips'->(${clip}::int)->>'videoId' as video_id
        from courses c,
             jsonb_array_elements(c.data->'sections') s,
             jsonb_array_elements(s->'lessons') l
       where l->>'libId' = ${libId}
       limit 1`;
    return rows[0]?.video_id || null;
  }

  const rows = await sql`
    select l->>'videoId' as video_id
      from courses c,
           jsonb_array_elements(c.data->'sections') s,
           jsonb_array_elements(s->'lessons') l
     where l->>'libId' = ${libId} and l->>'videoId' is not null
     limit 1`;
  return rows[0]?.video_id || null;
}

/** Remove every library row of a kind (used before a clean re-ingest). */
export async function deleteLibraryByKind(kind) {
  const sql = db();
  await ensureSchema();
  await sql`delete from library where kind = ${kind}`;
}

export async function upsertAsset(key, blobUrl, contentType) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into library_assets (key, blob_url, content_type)
    values (${key}, ${blobUrl}, ${contentType ?? null})
    on conflict (key) do update set blob_url = excluded.blob_url, content_type = excluded.content_type`;
}

export async function getAsset(key) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select blob_url, content_type from library_assets where key = ${key} limit 1`;
  return rows[0] || null;
}

/** Consume a token: valid, unused, unexpired → returns email and marks it used. */
export async function consumeLoginToken(raw) {
  if (!raw) return null;
  const sql = db();
  await ensureSchema();
  const h = hashToken(raw);
  const rows = await sql`
    update login_tokens set used_at = now()
    where token_hash = ${h} and used_at is null and expires_at > now()
    returning email`;
  return rows[0]?.email || null;
}

/* ---------------- display name ---------------- */

/** What to show next to a comment when the member has not set a name. */
export function displayNameFor(email, name) {
  if (name && String(name).trim()) return String(name).trim();
  const local = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Member';
  return local.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Set the member's public display name (used on their comments). */
export async function setCustomerName(email, name) {
  const sql = db();
  await ensureSchema();
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) return;
  await sql`update customers set name = ${clean}, updated_at = now() where email = ${normalizeEmail(email)}`;
}

/* ---------------- course comments ---------------- */

/**
 * The whole discussion for one course, oldest first.
 *
 * A soft-deleted comment is dropped, unless it still has live replies — then it
 * is kept as a tombstone so an admin's answer doesn't lose its question. Emails
 * never leave this function: callers get a display name only.
 */
export async function listComments(courseSlug) {
  const sql = db();
  await ensureSchema();
  return sql`
    select c.id, c.lesson_id, c.lesson_title, c.parent_id, c.email, c.is_admin,
           c.body, c.created_at, c.deleted_at, cu.name
    from comments c
    left join customers cu on cu.email = c.email
    where c.course_slug = ${courseSlug}
      and (c.deleted_at is null
           or exists (select 1 from comments r where r.parent_id = c.id and r.deleted_at is null))
    order by c.created_at asc
    limit 500`;
}

/** How many live comments each course has, for the unread-ish counter. */
export async function countCommentsByCourse() {
  const sql = db();
  await ensureSchema();
  return sql`select course_slug, count(*)::int as n from comments
             where deleted_at is null group by course_slug`;
}

export async function createComment({ courseSlug, lessonId, lessonTitle, parentId, email, isAdmin, body }) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`
    insert into comments (course_slug, lesson_id, lesson_title, parent_id, email, is_admin, body)
    values (${courseSlug}, ${lessonId ?? null}, ${lessonTitle ?? null}, ${parentId ?? null},
            ${normalizeEmail(email)}, ${!!isAdmin}, ${body})
    returning id, lesson_id, lesson_title, parent_id, email, is_admin, body, created_at`;
  return rows[0] || null;
}

/**
 * Soft-delete one comment. A member may only delete their own; an admin may
 * delete any. Returns true when a row was actually removed.
 */
export async function deleteComment(id, { email, isAdmin } = {}) {
  const sql = db();
  await ensureSchema();
  const rows = isAdmin
    ? await sql`update comments set deleted_at = now()
                where id = ${id} and deleted_at is null returning id`
    : await sql`update comments set deleted_at = now()
                where id = ${id} and deleted_at is null and email = ${normalizeEmail(email)}
                returning id`;
  return rows.length > 0;
}

/* ---------------- bookmarked lessons ---------------- */

export async function listBookmarks(email) {
  const sql = db();
  await ensureSchema();
  return sql`select lesson_id, course_slug, title, created_at
             from bookmarks where email = ${normalizeEmail(email)}
             order by created_at desc`;
}

/**
 * Bookmark on/off for one lesson. Returns the state it ended up in, so the
 * button can settle on the server's answer rather than its own guess.
 */
export async function toggleBookmark(email, { lessonId, courseSlug, title }) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  const gone = await sql`delete from bookmarks where email = ${e} and lesson_id = ${lessonId} returning lesson_id`;
  if (gone.length) return false;
  await sql`
    insert into bookmarks (email, lesson_id, course_slug, title)
    values (${e}, ${lessonId}, ${courseSlug}, ${title ?? null})
    on conflict (email, lesson_id) do update set course_slug = excluded.course_slug, title = excluded.title`;
  return true;
}

/* ---------------- image-prompt galleries ---------------- */

/** Replace one collection's tiles wholesale, so a re-ingest cannot duplicate. */
export async function replaceGallery(itemId, entries) {
  const sql = db();
  await ensureSchema();
  await sql`delete from library_gallery where item_id = ${itemId}`;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await sql`insert into library_gallery (item_id, idx, prompt, asset_key)
              values (${itemId}, ${i}, ${e.prompt ?? null}, ${e.assetKey ?? null})`;
  }
}

export async function getGallery(itemId) {
  const sql = db();
  await ensureSchema();
  return sql`select idx, prompt, asset_key from library_gallery
             where item_id = ${itemId} order by idx`;
}

/** Which items have tiles — lets the catalog badge a collection with its count. */
export async function galleryCounts() {
  const sql = db();
  await ensureSchema();
  return sql`select item_id, count(*)::int as n from library_gallery group by item_id`;
}

/**
 * A few more items worth showing under the one being read: same kind, preferring
 * the same category, then anything else of that kind. Never returns itself.
 */
export async function relatedLibraryItems(id, kind, category, limit = 4) {
  const sql = db();
  await ensureSchema();
  return sql`
    select id, kind, category, title, description, thumb_key
    from library
    where kind = ${kind} and id <> ${id}
    order by (category is not distinct from ${category ?? null}) desc, sort, title
    limit ${limit}`;
}

/* ---------------- long-form guides ---------------- */

export async function putGuide(itemId, html) {
  const sql = db();
  await ensureSchema();
  await sql`insert into library_guides (item_id, html) values (${itemId}, ${html})
            on conflict (item_id) do update set html = excluded.html`;
}

export async function getGuide(itemId) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select html from library_guides where item_id = ${itemId} limit 1`;
  return rows[0]?.html || null;
}

/** Merge a few keys into an item's meta without disturbing the rest. */
export async function mergeMeta(id, patch) {
  const sql = db();
  await ensureSchema();
  await sql`update library set meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
            where id = ${id}`;
}

/* ---------------- content requests ---------------- */

export async function createRequest(email, { title, body }) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`
    insert into content_requests (email, title, body)
    values (${normalizeEmail(email)}, ${title}, ${body ?? null})
    returning id, title, body, status, created_at`;
  return rows[0] || null;
}

/** A member's own requests, so they can see what they already asked for. */
export async function listMyRequests(email) {
  const sql = db();
  await ensureSchema();
  return sql`select id, title, body, status, created_at from content_requests
             where email = ${normalizeEmail(email)} order by created_at desc limit 50`;
}

/** Everything, for staff. */
export async function listAllRequests() {
  const sql = db();
  await ensureSchema();
  return sql`select r.id, r.email, r.title, r.body, r.status, r.created_at, c.name
             from content_requests r
             left join customers c on c.email = r.email
             order by (r.status = 'new') desc, r.created_at desc limit 500`;
}

export async function setRequestStatus(id, status) {
  const sql = db();
  await ensureSchema();
  await sql`update content_requests set status = ${status} where id = ${id}`;
}

/** Every comment across every course, newest first — the staff moderation view. */
export async function listAllComments(limit = 200) {
  const sql = db();
  await ensureSchema();
  return sql`select c.id, c.course_slug, c.lesson_title, c.parent_id, c.email,
                    c.is_admin, c.body, c.created_at, c.deleted_at, cu.name
             from comments c
             left join customers cu on cu.email = c.email
             order by c.created_at desc limit ${limit}`;
}

/** Drop an item's body — used when its full article replaces it. */
export async function clearBody(id) {
  const sql = db();
  await ensureSchema();
  await sql`update library set body_html = null where id = ${id}`;
}
