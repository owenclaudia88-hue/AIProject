import { neon } from '@neondatabase/serverless';
import { ALL_ACCESS, MEMBERSHIP_UNLOCKS, MEMBERSHIP_ONLY } from './products.js';
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
    // Names the entitlement that unlocks a course (null = part of membership).
    // Lesson bodies are gated separately through the library table; without
    // this the card would still show for everyone and open on empty lessons.
    await sql`alter table courses add column if not exists requires text`;
    // Display name shown next to a member's comments. Nullable — the member
    // sets it the first time they post; until then the email local-part is used.
    await sql`alter table customers add column if not exists name text`;
    // Optional password. Null for everyone who only ever uses the magic link,
    // which is most people and stays the supported path.
    await sql`alter table customers add column if not exists password_hash text`;
    await sql`alter table customers add column if not exists password_set_at timestamptz`;
    // Bumped whenever a password changes. Sessions carry the number they were
    // minted with, so moving it on invalidates every cookie already out there.
    await sql`alter table customers add column if not exists session_epoch int not null default 1`;
    // Failed sign-ins, so a password can be throttled. Rows are pruned as they
    // are counted rather than on a schedule: the table only ever holds a
    // handful and nothing else depends on its history.
    await sql`
      create table if not exists auth_failures (
        id     bigserial primary key,
        email  text,
        ip     text,
        at     timestamptz not null default now()
      )`;
    await sql`create index if not exists auth_failures_email_idx on auth_failures (email, at desc)`;
    await sql`create index if not exists auth_failures_ip_idx on auth_failures (ip, at desc)`;
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
    // Addresses that do not exist. Someone typed a fake email at checkout, the
    // reminder hard-bounced, and nothing stopped the follow-up going to the
    // same dead mailbox a day later. Repeat hard bounces are what turn a clean
    // sending reputation into welcome emails landing in spam for real buyers,
    // so once an address bounces permanently we stop writing to it.
    //
    // email_id is Resend's, kept so re-syncing the same bounce is cheap and
    // cannot double-count.
    await sql`
      create table if not exists email_bounces (
        email      text primary key,
        kind       text,
        subtype    text,
        reason     text,
        email_id   text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists email_bounces_id_idx on email_bounces (email_id)`;
    // Add-ons a member has bought on top of their membership. Everything in
    // the library is included with membership unless its `requires` names a
    // product here, so the default stays "members see it" and gating is opt-in
    // per item — the opposite way round would eventually hide something by
    // accident.
    await sql`
      create table if not exists entitlements (
        email      text not null,
        product    text not null,
        created_at timestamptz not null default now(),
        primary key (email, product)
      )`;
    await sql`alter table library add column if not exists requires text`;
    await sql`alter table content add column if not exists requires text`;
    await sql`create index if not exists library_requires_idx on library (requires)`;
    // Small knobs staff can turn without a redeploy — how long to wait before
    // the checkout reminder goes out, and whether it goes at all.
    await sql`
      create table if not exists settings (
        key        text primary key,
        value      text,
        updated_at timestamptz not null default now()
      )`;
    // Traffic. Every page view and checkout start, kept here as well as sent
    // to Meta — Meta only reports on what its own attribution can see, and an
    // ad blocker or a refused consent prompt takes visitors out of its numbers
    // entirely. This table is the one we control.
    //
    // Deliberately anonymous: a random id the browser generates, the page, the
    // referring host and the country the CDN already knows. No IP address and
    // no user agent are stored, so there is nothing here that identifies a
    // person, only a repeat visit.
    await sql`
      create table if not exists page_events (
        id         bigserial primary key,
        event      text not null,
        path       text not null,
        visitor    text not null,
        session    text,
        referrer   text,
        country    text,
        device     text,
        created_at timestamptz not null default now()
      )`;
    await sql`alter table page_events add column if not exists region text`;
    await sql`alter table page_events add column if not exists city text`;
    // Whether the visit carried a Meta click id. Not the id itself — only
    // whether there was one — because this is the single thing that decides
    // if Meta can attribute a conversion back to the ad that paid for it, and
    // with no browser pixel setting an _fbp cookie there is nothing else to
    // match on. Without this column, "why does the ad report no conversions"
    // is unanswerable from our side.
    await sql`alter table page_events add column if not exists has_fbc boolean`;
    // IP -> place, keyed by a salted hash so the address itself is never kept.
    // Exists so IPinfo is asked once a month per address rather than once per
    // page view.
    await sql`
      create table if not exists ip_geo (
        ip_hash    text primary key,
        country    text,
        region     text,
        city       text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists page_events_time_idx on page_events (created_at desc)`;
    await sql`create index if not exists page_events_event_idx on page_events (event, created_at desc)`;
    await sql`create index if not exists page_events_visitor_idx on page_events (visitor, created_at)`;
    // Everyone who typed their name and email into the checkout, whether or not
    // they ever reached a card.
    //
    // This used to be read back from Stripe, which cannot work: the
    // PaymentIntent is created when the page loads, before anything is typed,
    // and Stripe only learns an email if somebody actually submits a card. So
    // the people most worth chasing — details in, no payment — existed nowhere.
    // They were missing from the CSV and, worse, from the reminder emails that
    // are supposed to go to exactly them.
    await sql`
      create table if not exists leads (
        email      text primary key,
        name       text,
        city       text,
        zip        text,
        country    text,
        first_seen timestamptz not null default now(),
        last_seen  timestamptz not null default now()
      )`;
    await sql`create index if not exists leads_seen_idx on leads (first_seen desc)`;
    // Which page they gave their details on. Added once there was more than
    // one thing to buy: without it every reminder chased everybody back to the
    // original checkout, which for the Automation Engine is a different product
    // at a different price. Null on rows written before this existed — those
    // predate the second product, so the default is the right answer for them.
    await sql`alter table leads add column if not exists source text`;
    // The buyer's address, kept when the sale is fulfilled. Stripe has it on
    // the charge, but reading it back for every row of a dashboard means a
    // round trip per member.
    await sql`alter table customers add column if not exists city text`;
    await sql`alter table customers add column if not exists zip text`;
    await sql`alter table customers add column if not exists country text`;
    await sql`alter table customers add column if not exists address text`;
    // Which reminder email the sale followed, when one did. Kept on the member
    // rather than worked out by joining dates afterwards, because the join can
    // only say a reminder went first - this says the buyer actually arrived
    // through it.
    await sql`alter table customers add column if not exists reminder text`;
    // The member's own profile. `name` is still the display name every comment
    // carries, and is kept in step with these rather than replaced by them.
    await sql`alter table customers add column if not exists first_name text`;
    await sql`alter table customers add column if not exists last_name text`;
    await sql`alter table customers add column if not exists photo_url text`;
    // Which funnel the sale came from and the page the visit started on, so a
    // buyer can be told apart the same way a lead already can. Null on rows
    // written before this existed — those predate the second lander.
    await sql`alter table customers add column if not exists source text`;
    await sql`alter table customers add column if not exists landing_url text`;
    await sql`alter table leads add column if not exists landing_url text`;
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
export async function grantAccess(email, {
  paymentIntent, stripeCustomerId, name, city, zip, country, address, source, landingUrl, reminder
} = {}) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  const cut = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const clean = cut(name, 60);
  const rows = await sql`
    insert into customers (email, status, stripe_customer_id, last_payment_intent, name,
                           city, zip, country, address, source, landing_url, reminder, updated_at)
    values (${e}, 'active', ${stripeCustomerId ?? null}, ${paymentIntent ?? null}, ${clean},
            ${cut(city, 80)}, ${cut(zip, 32)}, ${cut(country, 8)}, ${cut(address, 200)},
            ${cut(source, 60)}, ${cut(landingUrl, 500)}, ${cut(reminder, 60)}, now())
    on conflict (email) do update set
      status = 'active',
      stripe_customer_id = coalesce(${stripeCustomerId ?? null}, customers.stripe_customer_id),
      last_payment_intent = coalesce(${paymentIntent ?? null}, customers.last_payment_intent),
      -- The name they gave at checkout only fills a blank. If they have since
      -- set their own display name, that is the one they want to be known by
      -- and a repeat purchase must not overwrite it.
      name = coalesce(customers.name, ${clean}),
      -- The address, by contrast, is whatever they last paid with.
      city = coalesce(${cut(city, 80)}, customers.city),
      zip = coalesce(${cut(zip, 32)}, customers.zip),
      country = coalesce(${cut(country, 8)}, customers.country),
      address = coalesce(${cut(address, 200)}, customers.address),
      -- First touch wins, like the leads table. A buyer who later comes back
      -- through a second lander was still won by the first one, and rewriting
      -- it would quietly move the credit between funnels after the fact.
      source = coalesce(customers.source, ${cut(source, 60)}),
      landing_url = coalesce(customers.landing_url, ${cut(landingUrl, 500)}),
      -- Same first-touch rule: the reminder that won them keeps the credit.
      reminder = coalesce(customers.reminder, ${cut(reminder, 60)}),
      updated_at = now()
    returning (xmax = 0) as created`;
  return rows[0]?.created === true;
}

/* ---------------- leads ---------------- */

/**
 * Somebody got far enough to give us a name and an email.
 *
 * Called the moment the checkout form's first step is completed, which is the
 * only point at which we reliably know who they are — everything after that
 * depends on them actually paying.
 *
 * Never throws: failing to file a lead must not break the page they are on.
 */
export async function recordLead(email, { name, city, zip, country, source, landingUrl } = {}) {
  try {
    const sql = db();
    await ensureSchema();
    const e = normalizeEmail(email);
    if (!e || !e.includes('@')) return false;
    const cut = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
    await sql`
      insert into leads (email, name, city, zip, country, source, landing_url, first_seen, last_seen)
      values (${e}, ${cut(name, 80)}, ${cut(city, 80)}, ${cut(zip, 32)}, ${cut(country, 8)},
              ${cut(source, 60)}, ${cut(landingUrl, 500)}, now(), now())
      on conflict (email) do update set
        -- Later visits only fill gaps. Somebody who comes back and types less
        -- than the first time should not erase what we already had.
        name = coalesce(leads.name, ${cut(name, 80)}),
        city = coalesce(leads.city, ${cut(city, 80)}),
        zip = coalesce(leads.zip, ${cut(zip, 32)}),
        country = coalesce(leads.country, ${cut(country, 8)}),
        -- First touch wins, and a row that never had one gets filled. The
        -- reminder clock runs on first_seen, so the product they are chased
        -- about has to be the one they first walked away from — otherwise a
        -- visit to a second lander would change the offer in a sequence that
        -- is already half sent.
        source = coalesce(leads.source, ${cut(source, 60)}),
        landing_url = coalesce(leads.landing_url, ${cut(landingUrl, 500)}),
        last_seen = now()`;
    return true;
  } catch (err) {
    console.error('[db] lead not recorded:', err.message);
    return false;
  }
}

/** Everyone who gave their details, newest first, flagged with whether they bought. */
export async function listLeads(limit = 1000) {
  const sql = db();
  await ensureSchema();
  return sql`
    select l.email, l.name, l.city, l.zip, l.country, l.source, l.landing_url, l.first_seen, l.last_seen,
           c.email is not null as purchased, c.status as member_status, c.created_at as bought_at
    from leads l
    left join customers c on c.email = l.email
    order by l.first_seen desc
    limit ${limit}`;
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

/* ---------------- bounces ---------------- */

/**
 * Addresses that permanently rejected mail. Only the hard ones: a full mailbox
 * or a server having a bad day is temporary and worth retrying, whereas
 * "mailbox not found" will be true forever.
 */
export async function bouncedEmails() {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email from email_bounces where kind = 'Permanent'`;
  return new Set(rows.map((r) => r.email));
}

/** Which Resend message ids we have already filed, so a re-sync stays cheap. */
export async function knownBounceIds() {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email_id from email_bounces where email_id is not null`;
  return new Set(rows.map((r) => r.email_id));
}

export async function recordBounce(email, { kind, subtype, reason, emailId } = {}) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  if (!e) return false;
  const cut = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  await sql`
    insert into email_bounces (email, kind, subtype, reason, email_id)
    values (${e}, ${cut(kind, 20)}, ${cut(subtype, 40)}, ${cut(reason, 400)}, ${cut(emailId, 64)})
    on conflict (email) do update set
      -- A later permanent bounce outranks an earlier temporary one; the other
      -- way round it would quietly un-suppress a dead address.
      kind = case when email_bounces.kind = 'Permanent' then 'Permanent' else excluded.kind end,
      subtype = excluded.subtype,
      reason = excluded.reason,
      email_id = excluded.email_id`;
  return true;
}

/** Everything that has bounced, newest first — for the dashboard. */
export async function listBounces(limit = 200) {
  const sql = db();
  await ensureSchema();
  return sql`select email, kind, subtype, reason, created_at
             from email_bounces order by created_at desc limit ${limit}`;
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
                    city, zip, country, address, source, landing_url, created_at, updated_at
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
  // password_hash comes back so callers can say whether one is set. The value
  // never leaves the server — /api/me turns it into a boolean.
  const rows = await sql`select email, status, name, stripe_customer_id, last_payment_intent,
                                password_hash, password_set_at, photo_url
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
export async function upsertContent({ key, title, kind, filename, blobUrl, sizeBytes, sort, requires }) {
  const sql = db();
  await ensureSchema();
  // `requires` names the entitlement that unlocks this download (null = part
  // of membership), e.g. 'carousel-studio' for the Carousel Studio add-on.
  await sql`
    insert into content (key, title, kind, filename, blob_url, size_bytes, sort, requires)
    values (${key}, ${title}, ${kind}, ${filename ?? null}, ${blobUrl}, ${sizeBytes ?? null}, ${sort ?? 0}, ${requires ?? null})
    on conflict (key) do update set
      title = excluded.title, kind = excluded.kind, filename = excluded.filename,
      blob_url = excluded.blob_url, size_bytes = excluded.size_bytes, sort = excluded.sort,
      requires = excluded.requires`;
}

/** Catalog for the member area — never includes the private blob_url. */
export async function listContent(entitled = []) {
  const sql = db();
  await ensureSchema();
  // Membership downloads come back flagged rather than hidden, so a cancelled
  // member sees a lock where their powerups were instead of an empty shelf.
  const owns = [...entitled];
  return sql`select key, title, kind, filename, size_bytes,
                    (requires = ${MEMBERSHIP_ONLY} and not (${MEMBERSHIP_ONLY} = any(${owns}))) as locked
             from content
             where requires is null
                or requires = any(${owns})
                or requires = ${MEMBERSHIP_ONLY}
             order by kind, sort, title`;
}

/** The private blob location for one item, for the gated download stream. */
export async function getContentBlobUrl(key, entitled = []) {
  const sql = db();
  await ensureSchema();
  // Same rule as the catalogue: a download nobody can see in the list but
  // anyone can fetch by key is not gated.
  const rows = await sql`select blob_url, filename from content
                         where key = ${key} and (requires is null or requires = any(${[...entitled]}))
                         limit 1`;
  return rows[0] || null;
}

/* ---------------- browsable library (courses, prompts, skills…) ---------------- */

export async function upsertLibraryItem({ id, kind, course, category, title, description, bodyHtml, thumbKey, sort, tags, meta, sourceCreatedAt, likes, requires }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into library (id, kind, course, category, title, description, body_html, thumb_key, sort, tags, meta, source_created_at, likes, requires)
    values (${id}, ${kind}, ${course ?? null}, ${category ?? null}, ${title}, ${description ?? null},
            ${bodyHtml ?? null}, ${thumbKey ?? null}, ${sort ?? 0},
            ${tags && tags.length ? tags : null}, ${meta ? JSON.stringify(meta) : null}::jsonb,
            ${sourceCreatedAt ?? null}, ${likes ?? null}, ${requires ?? null})
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
      source_created_at = excluded.source_created_at, likes = excluded.likes,
      -- Which add-on unlocks this, if any. Kept in the upsert so a re-ingest
      -- cannot quietly un-gate a paid item back into the free library.
      requires = excluded.requires`;
}

/** Catalog — titles/metadata only, no bodies, for the browse view. */
export async function listLibrary(kind, entitled = []) {
  const sql = db();
  await ensureSchema();
  // An item with no `requires` is kept by everybody who ever bought. One that
  // names a product appears for members who own it. Membership content comes
  // back either way, flagged, so a cancelled member sees a lock rather than an
  // empty library. Passed as an array so the driver parameterises it — never
  // built into the SQL string.
  const owns = [...entitled];
  if (kind) {
    return sql`select id, kind, course, category, title, description, thumb_key, tags,
                      source_created_at, likes,
                      (requires = ${MEMBERSHIP_ONLY} and not (${MEMBERSHIP_ONLY} = any(${owns}))) as locked
               from library
               where kind = ${kind}
                 and (requires is null
                      or requires = any(${owns})
                      or requires = ${MEMBERSHIP_ONLY})
               order by course, category, sort, title`;
  }
  return sql`select id, kind, course, category, title, description, thumb_key, tags,
                    source_created_at, likes,
                    (requires = ${MEMBERSHIP_ONLY} and not (${MEMBERSHIP_ONLY} = any(${owns}))) as locked
             from library
             where requires is null
                or requires = any(${owns})
                or requires = ${MEMBERSHIP_ONLY}
             order by kind, course, category, sort, title`;
}

/** One item's full body, for the reader. */
export async function getLibraryItem(id, entitled = []) {
  const sql = db();
  await ensureSchema();
  // Gated here as well as in the list. Hiding something from a catalogue but
  // serving it to anyone who knows the id is not gating it.
  const rows = await sql`select id, kind, course, category, title, description, body_html, thumb_key, tags, meta
                         from library
                         where id = ${id} and (requires is null or requires = any(${[...entitled]}))
                         limit 1`;
  return rows[0] || null;
}

/* ---------------- courses (structure for the player) ---------------- */

export async function upsertCourse({ slug, title, lessonCount, sort, data, requires }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into courses (slug, title, lesson_count, sort, data, requires)
    values (${slug}, ${title}, ${lessonCount ?? 0}, ${sort ?? 0}, ${JSON.stringify(data)}::jsonb, ${requires ?? null})
    on conflict (slug) do update set
      title = excluded.title, lesson_count = excluded.lesson_count,
      sort = excluded.sort, data = excluded.data, requires = excluded.requires`;
}

/** Course list for the Courses tab — no lesson tree, just the headline stats. */
export async function listCourses(entitled = []) {
  const sql = db();
  await ensureSchema();
  // Every course comes back, with a flag for the ones this member cannot open.
  // A course they have not got is still worth seeing: hiding it leaves them
  // with a shorter list and no idea anything else exists, which is the wrong
  // answer both for somebody who cancelled and for somebody deciding whether
  // to subscribe. Opening one is still refused — that is getCourse's job.
  const owns = [...entitled];
  return sql`select slug, title, lesson_count, sort,
                    jsonb_array_length(data->'sections') as section_count,
                    (data->'stats') as stats,
                    (requires is not null and not (requires = any(${owns}))) as locked
             from courses
             order by sort, title`;
}

/** One course with its full section/lesson tree, for the player. */
export async function getCourse(slug, entitled = []) {
  const sql = db();
  await ensureSchema();
  // Same rule as the catalogue. A course nobody can see in the list but anyone
  // can open by slug is not gated.
  const rows = await sql`select slug, title, lesson_count, sort, data from courses
                         where slug = ${slug}
                           and (requires is null or requires = any(${[...entitled]}))
                         limit 1`;
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

/* ---------------------------------------------------------------- traffic */

/**
 * Record one page view or checkout start.
 *
 * Never throws: tracking is the least important thing happening on any
 * request, and a visitor must not notice that it failed.
 */
export async function recordPageEvent({
  event, path, visitor, session, referrer, country, region, city, device, hasFbc
}) {
  try {
    const sql = db();
    await ensureSchema();
    const cut = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
    const id = cut(visitor, 64);
    if (!event || !id) return false;
    await sql`
      insert into page_events
        (event, path, visitor, session, referrer, country, region, city, device, has_fbc)
      values (${cut(event, 40)}, ${cut(path, 300) || '/'}, ${id}, ${cut(session, 64)},
              ${cut(referrer, 200)}, ${cut(country, 8)}, ${cut(region, 80)}, ${cut(city, 80)},
              ${cut(device, 16)}, ${hasFbc === true})`;
    return true;
  } catch (err) {
    console.error('[db] page event not recorded:', err.message);
    return false;
  }
}

/** A previously resolved address, if it was looked up recently enough. */
export async function getGeoCache(ipHash, ttlDays = 30) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`
    select country, region, city from ip_geo
    where ip_hash = ${ipHash}
      and created_at > now() - (${ttlDays} || ' days')::interval`;
  return rows[0] || null;
}

export async function putGeoCache(ipHash, { country, region, city }) {
  const sql = db();
  await ensureSchema();
  await sql`
    insert into ip_geo (ip_hash, country, region, city, created_at)
    values (${ipHash}, ${country ?? null}, ${region ?? null}, ${city ?? null}, now())
    on conflict (ip_hash) do update
      set country = excluded.country, region = excluded.region,
          city = excluded.city, created_at = now()`;
}

/**
 * The traffic dashboard, in one round trip.
 *
 * Visitors are counted distinctly per day, so somebody who comes back three
 * times in an afternoon is one visitor, not three — the same way any analytics
 * tool would count them, and the only way the conversion rate underneath means
 * anything.
 *
 * Purchases come from the customers table rather than page_events: the browser
 * never sees the payment succeed, so the only honest source is the row the
 * Stripe webhook wrote.
 */
export async function trafficStats(days = 30) {
  const sql = db();
  await ensureSchema();
  const n = Math.min(365, Math.max(1, Math.round(Number(days) || 30)));

  // Traffic has only been recorded since this shipped, but purchases go back
  // to the first sale. Counting a month of purchases against a few days of
  // visitors gives rates over 100% and a chart that lies, so the window is
  // clamped to the point we actually started watching — and the dashboard
  // says which date that is.
  const firstRow = await sql`select min(created_at) as first from page_events`;
  const first = firstRow[0] && firstRow[0].first ? new Date(firstRow[0].first) : null;
  if (!first) {
    return {
      days: n, trackingSince: null,
      totals: { views: 0, visitors: 0, checkouts: 0, purchases: 0,
                visitorToCheckout: 0, checkoutToPurchase: 0, visitorToPurchase: 0 },
      daily: [], paths: [], referrers: [], countries: [], devices: []
    };
  }
  const since = new Date(Math.max(Date.now() - n * 86400000, first.getTime()));
  // Buckets are whole UTC days, so the first partial day still counts.
  const startDay = new Date(Date.UTC(
    since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  // Purchases are cut at the exact moment tracking began, not at the start of
  // that day. Sales made earlier the same day had no page views recorded
  // against them, and counting them anyway is what produces a checkout
  // conversion rate above 100%.
  const purchasesFrom = new Date(Math.max(startDay.getTime(), first.getTime()));

  const [daily, totals, paths, referrers, countries, devices, cities, purchases] = await Promise.all([
    // to_char, not ::date — the driver returns a Date object for a date
    // column, and these values are map keys, where only a plain 'YYYY-MM-DD'
    // reliably compares equal.
    // "Started checkout" means reaching a checkout page, not firing an
    // InitiateCheckout event. Only the original checkout fires one — the
    // lifetime lander deliberately does not, because its Lead already fires
    // at that same moment and a second event would double-count one person.
    // Counting the page instead measures the step for every funnel without
    // sending Meta anything extra.
    sql`select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
               count(*) filter (where event = 'PageView')                     as views,
               count(distinct visitor)                                        as visitors,
               count(distinct visitor) filter (where path like '%checkout%') as checkouts
        from page_events where created_at >= ${startDay}
        group by 1 order by 1`,
    sql`select count(*) filter (where event = 'PageView')                      as views,
               count(distinct visitor)                                         as visitors,
               count(distinct visitor) filter (where path like '%checkout%') as checkouts,
               -- Visitors Meta can tie back to the ad that paid for them.
               -- Anyone else is invisible in the ad report whatever they do here.
               count(distinct visitor) filter (where has_fbc)                  as attributable
        from page_events where created_at >= ${startDay}`,
    sql`select path, count(*) as views, count(distinct visitor) as visitors
        from page_events where created_at >= ${startDay} and event = 'PageView'
        group by 1 order by views desc limit 12`,
    // 'direct' rather than null, so the biggest bucket on most sites is not a
    // blank row nobody can interpret.
    sql`select coalesce(nullif(referrer, ''), 'direct') as referrer,
               count(distinct visitor) as visitors
        from page_events where created_at >= ${startDay}
        group by 1 order by visitors desc limit 12`,
    sql`select coalesce(nullif(country, ''), '??') as country,
               count(distinct visitor) as visitors
        from page_events where created_at >= ${startDay}
        group by 1 order by visitors desc limit 12`,
    sql`select coalesce(nullif(device, ''), 'unknown') as device,
               count(distinct visitor) as visitors
        from page_events where created_at >= ${startDay}
        group by 1 order by visitors desc`,
    // City needs IPinfo — Vercel's header only carries the country — so this
    // stays empty until IPINFO_TOKEN is set, rather than showing nulls.
    sql`select city, country, count(distinct visitor) as visitors
        from page_events
        where created_at >= ${startDay} and city is not null and city <> ''
        group by 1, 2 order by visitors desc limit 12`,
    sql`select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
               count(*) as purchases
        from customers where created_at >= ${purchasesFrom}
        group by 1 order by 1`
  ]);

  const viewsBy = new Map(daily.map((d) => [d.day, d]));
  const boughtBy = new Map(purchases.map((p) => [p.day, Number(p.purchases)]));

  // Every day in the window, including the quiet ones — a chart that silently
  // drops empty days makes a gap look like a plateau.
  const series = [];
  for (let ms = startDay.getTime(); ms <= Date.now(); ms += 86400000) {
    const key = new Date(ms).toISOString().slice(0, 10);
    const d = viewsBy.get(key);
    series.push({
      day: key,
      views: d ? Number(d.views) : 0,
      visitors: d ? Number(d.visitors) : 0,
      checkouts: d ? Number(d.checkouts) : 0,
      purchases: boughtBy.get(key) || 0
    });
  }

  const t = totals[0] || { views: 0, visitors: 0, checkouts: 0 };
  const bought = series.reduce((a, b) => a + b.purchases, 0);
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

  return {
    days: n,
    trackingSince: first.toISOString(),
    totals: {
      views: Number(t.views), visitors: Number(t.visitors),
      checkouts: Number(t.checkouts), purchases: bought,
      attributable: Number(t.attributable || 0),
      attributableRate: pct(Number(t.attributable || 0), Number(t.visitors)),
      // Two rates, because they answer different questions: the first is what
      // the page does, the second is what the checkout does.
      visitorToCheckout: pct(Number(t.checkouts), Number(t.visitors)),
      checkoutToPurchase: pct(bought, Number(t.checkouts)),
      visitorToPurchase: pct(bought, Number(t.visitors))
    },
    daily: series,
    paths: paths.map((p) => ({ path: p.path, views: Number(p.views), visitors: Number(p.visitors) })),
    referrers: referrers.map((r) => ({ referrer: r.referrer, visitors: Number(r.visitors) })),
    // "United States" rather than "US". The codes are what we store, because
    // they are stable; the name is only ever for reading.
    countries: countries.map((c) => ({
      country: c.country, name: countryName(c.country), visitors: Number(c.visitors)
    })),
    cities: cities.map((c) => ({
      city: c.city, country: c.country, name: countryName(c.country),
      visitors: Number(c.visitors)
    })),
    devices: devices.map((d) => ({ device: d.device, visitors: Number(d.visitors) }))
  };
}

let _regionNames = null;
/** ISO code to something a person would recognise. */
function countryName(code) {
  if (!code || code === 'unknown') return 'Unknown';
  try {
    if (!_regionNames) _regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return _regionNames.of(String(code).toUpperCase()) || code;
  } catch {
    return code;
  }
}

/**
 * How many distinct people opened the checkout page, and since when.
 *
 * Deliberately counts visitors rather than views: somebody who opens the
 * checkout, wanders back to the sales page and returns is one person deciding,
 * not two.
 */
export async function checkoutCounts() {
  const sql = db();
  await ensureSchema();
  // Any checkout page, not just the original one. This was pinned to
  // '/checkout.html' when that was the only place to pay, and stayed pinned
  // when two more were added — so the lifetime lander and the Engine were
  // sending people to a checkout that the funnel counter did not believe
  // existed, and "started checkout" sat flat while they were being used.
  const [reached, byPage, first] = await Promise.all([
    sql`select count(distinct visitor) n from page_events where path like '%checkout%'`,
    sql`select path, count(distinct visitor)::int n from page_events
        where path like '%checkout%' group by path order by n desc`,
    sql`select min(created_at) t from page_events`
  ]);
  return {
    reachedCheckout: Number(reached[0]?.n || 0),
    // Broken out per page so one funnel going quiet is visible rather than
    // hidden inside a single total.
    reachedCheckoutByPage: byPage.map((r) => ({ path: r.path, visitors: r.n })),
    trackingSince: first[0]?.t ? new Date(first[0].t).toISOString() : null
  };
}

/* ---------------- passwords (optional, alongside the magic link) ---------------- */

/**
 * The stored hash for an address, or null.
 *
 * Deliberately returns null both for "no such customer" and "customer with no
 * password": the caller must not be able to tell those apart, because the
 * sign-in response must not either.
 */
export async function passwordHashFor(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select password_hash from customers where email = ${normalizeEmail(email)} limit 1`;
  return rows[0]?.password_hash || null;
}

/** Set or replace the password hash. Also clears the throttle. */
export async function setPasswordHash(email, hash) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  await sql`update customers set password_hash = ${hash}, password_set_at = now(), updated_at = now()
            where email = ${e}`;
  await sql`delete from auth_failures where email = ${e}`;
}

/** Remove the password. The magic link still works — it always did. */
export async function clearPasswordHash(email) {
  const sql = db();
  await ensureSchema();
  await sql`update customers set password_hash = null, password_set_at = null, updated_at = now()
            where email = ${normalizeEmail(email)}`;
}

/** Whether this member has set a password, for the account screen. */
export async function hasPassword(email) {
  return !!(await passwordHashFor(email));
}

/**
 * What a session needs checking against: the account's status and the epoch its
 * cookie has to match. One row, one query — the callers that also need `active`
 * already had their own, and this replaces it rather than adding to it.
 *
 * Null means no such customer, which for staff is normal: they sign in without
 * ever having bought anything.
 */
export async function sessionCheck(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select status, session_epoch from customers
                         where email = ${normalizeEmail(email)} limit 1`;
  return rows[0] ? { status: rows[0].status, epoch: Number(rows[0].session_epoch || 1) } : null;
}

/** The number a new cookie for this address should carry. */
export async function sessionEpochFor(email) {
  return (await sessionCheck(email))?.epoch ?? 1;
}

/** Move it on, which stops every cookie minted before now. Returns the new one. */
export async function bumpSessionEpoch(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`update customers set session_epoch = session_epoch + 1, updated_at = now()
                         where email = ${normalizeEmail(email)}
                         returning session_epoch`;
  return Number(rows[0]?.session_epoch || 1);
}

/* ---------------- sign-in throttle ---------------- */

export async function recordAuthFailure(email, ip) {
  const sql = db();
  await ensureSchema();
  await sql`insert into auth_failures (email, ip) values (${normalizeEmail(email) || null}, ${ip || null})`;
}

export async function clearAuthFailures(email) {
  const sql = db();
  await ensureSchema();
  await sql`delete from auth_failures where email = ${normalizeEmail(email)}`;
}

/**
 * Recent failures for this address and this address's caller, within `minutes`.
 *
 * Counted per address so one account cannot be ground down, and per IP so a
 * spray across many addresses is caught too. Old rows are dropped on the way
 * past, which keeps the table to the size of one window.
 */
export async function recentAuthFailures(email, ip, minutes = 15) {
  const sql = db();
  await ensureSchema();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  await sql`delete from auth_failures where at < ${new Date(Date.now() - 24 * 3600 * 1000)}`;
  const rows = await sql`
    select
      count(*) filter (where email = ${normalizeEmail(email)}) as by_email,
      count(*) filter (where ip = ${ip || '~no-ip~'})         as by_ip
    from auth_failures where at >= ${cutoff}`;
  return {
    byEmail: Number(rows[0]?.by_email || 0),
    byIp: Number(rows[0]?.by_ip || 0)
  };
}

/* ---------------- entitlements (paid add-ons) ---------------- */

/**
 * Which add-on products this member has unlocked.
 *
 * Membership gets you the library. An entitlement gets you the things sold
 * separately on top of it, so a product can sit finished in the database
 * while only the people who bought it can see it.
 */
export async function entitlementsFor(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select product from entitlements where email = ${normalizeEmail(email)}`;
  const held = new Set(rows.map((r) => r.product));

  // A membership opens the whole member area. Expanded at the one place
  // entitlements are read, rather than written out as a row per product, so
  // that adding a course unlocks it for everyone who already subscribes with no
  // backfill - and so that cancelling takes back only the membership, leaving
  // whatever they bought outright still sitting in their own rows.
  if (held.has(ALL_ACCESS)) for (const e of MEMBERSHIP_UNLOCKS) held.add(e);
  return held;
}

export async function hasEntitlement(email, product) {
  return (await entitlementsFor(email)).has(product);
}

export async function grantEntitlement(email, product) {
  const sql = db();
  await ensureSchema();
  await sql`insert into entitlements (email, product) values (${normalizeEmail(email)}, ${product})
            on conflict (email, product) do nothing`;
}

export async function revokeEntitlement(email, product) {
  const sql = db();
  await ensureSchema();
  await sql`delete from entitlements where email = ${normalizeEmail(email)} and product = ${product}`;
}

/** Everyone who has a given add-on, for the dashboard. */
export async function listEntitled(product) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email, created_at from entitlements
                         where product = ${product} order by created_at desc`;
  return rows;
}

/**
 * The SQL fragment shape used by the catalogue queries: an item is visible if
 * it needs nothing, or if it needs something this member has.
 *
 * Passed as an array because the driver parameterises it safely; building the
 * list into the string would put member data into SQL text.
 */
export function visibleProducts(entitled) {
  return [...entitled];
}


/**
 * Buyers who were sent a reminder and then bought.
 *
 * Two kinds of evidence, and the difference matters. `reminder` is the name of
 * the email the buyer actually arrived through, carried from the link they
 * clicked - that is proof. The join on dates only says a reminder went out
 * first, which for somebody who was going to buy anyway is a coincidence. Both
 * are returned, labelled, so the dashboard can show the difference rather than
 * flatten it into one misleading number.
 */
export async function convertedAfterReminder() {
  const sql = db();
  await ensureSchema();
  return sql`
    select c.email,
           c.name,
           c.source,
           c.reminder            as arrived_through,
           c.created_at          as bought_at,
           o.kind                as reminder_kind,
           o.sent_at,
           round(extract(epoch from (c.created_at - o.sent_at)) / 3600.0, 1) as hours_after
      from customers c
      join outreach o on o.email = c.email
     where c.created_at > o.sent_at
     order by c.created_at desc, o.sent_at desc`;
}


/* ---------------- project submissions ---------------- */

/**
 * What members build and hand in for a course.
 *
 * One row per submission rather than one per member: somebody who reworks their
 * project should be able to show both, and staff should be able to see that they
 * did. Feedback lives on the row it answers, so a reply can never end up
 * attached to a different attempt.
 */
export async function ensureProjects() {
  const sql = db();
  await ensureSchema();
  await sql`
    create table if not exists projects (
      id          bigserial primary key,
      email       text not null,
      course_slug text not null,
      lesson_id   text,
      title       text,
      body        text,
      url         text,
      status      text not null default 'new',
      feedback    text,
      feedback_at timestamptz,
      created_at  timestamptz not null default now()
    )`;
  await sql`create index if not exists projects_course_idx on projects (course_slug, created_at desc)`;
  await sql`create index if not exists projects_email_idx on projects (email, created_at desc)`;
}

export async function addProject(email, { courseSlug, lessonId, title, body, url } = {}) {
  const sql = db();
  await ensureProjects();
  const cut = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
  const rows = await sql`
    insert into projects (email, course_slug, lesson_id, title, body, url)
    values (${normalizeEmail(email)}, ${courseSlug}, ${cut(lessonId, 120)},
            ${cut(title, 160)}, ${cut(body, 8000)}, ${cut(url, 500)})
    returning id, title, body, url, status, created_at`;
  return rows[0];
}

/** One member's submissions for one course. */
export async function projectsFor(email, courseSlug) {
  const sql = db();
  await ensureProjects();
  return sql`select id, course_slug, lesson_id, title, body, url, status,
                    feedback, feedback_at, created_at
               from projects
              where email = ${normalizeEmail(email)} and course_slug = ${courseSlug}
              order by created_at desc`;
}

/** Everything handed in, for staff. */
export async function listProjects(limit = 500) {
  const sql = db();
  await ensureProjects();
  return sql`select id, email, course_slug, lesson_id, title, body, url, status,
                    feedback, feedback_at, created_at
               from projects order by created_at desc limit ${limit}`;
}

/**
 * Staff reply. Clearing it puts the row back in the queue, so a reply sent in
 * error can be taken back rather than only overwritten.
 */
export async function setProjectFeedback(id, feedback) {
  const sql = db();
  await ensureProjects();
  const text = typeof feedback === 'string' && feedback.trim()
    ? feedback.trim().slice(0, 8000) : null;
  const rows = text
    ? await sql`update projects set feedback = ${text}, feedback_at = now(), status = 'reviewed'
                 where id = ${id} returning id, email, course_slug, status, feedback, feedback_at`
    : await sql`update projects set feedback = null, feedback_at = null, status = 'new'
                 where id = ${id} returning id, email, course_slug, status, feedback, feedback_at`;
  return rows[0] || null;
}


/* ---------------- the member's own profile ---------------- */

/** First name, last name and photo, for the account page. */
export async function profileFor(email) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select name, first_name, last_name, photo_url
                           from customers where email = ${normalizeEmail(email)} limit 1`;
  const r = rows[0];
  if (!r) return null;

  // Nobody has filled these in yet, so the first visit is pre-filled by
  // splitting whatever name we already hold. A one-word name is a first name:
  // guessing a surname out of it would be worse than leaving it blank.
  const parts = String(r.name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: r.first_name ?? (parts.length ? parts[0] : ''),
    lastName: r.last_name ?? (parts.length > 1 ? parts.slice(1).join(' ') : ''),
    photoUrl: r.photo_url || null,
    displayName: displayNameFor(email, r.name)
  };
}

/**
 * Save the name. `name` is written from the two parts, so comments, emails and
 * the dashboard greeting all keep working off the one field they already read.
 */
export async function setProfileName(email, firstName, lastName) {
  const sql = db();
  await ensureSchema();
  const cut = (v) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const first = cut(firstName);
  const last = cut(lastName);
  const full = [first, last].filter(Boolean).join(' ').slice(0, 60);

  await sql`update customers
               set first_name = ${first || null},
                   last_name = ${last || null},
                   name = coalesce(nullif(${full}, ''), name),
                   updated_at = now()
             where email = ${normalizeEmail(email)}`;
  return { firstName: first, lastName: last, displayName: full };
}

/** Point the profile at an uploaded photo, or clear it with null. */
export async function setProfilePhoto(email, url) {
  const sql = db();
  await ensureSchema();
  const clean = typeof url === 'string' && /^https:\/\//i.test(url) ? url.slice(0, 500) : null;
  await sql`update customers set photo_url = ${clean}, updated_at = now()
             where email = ${normalizeEmail(email)}`;
  return clean;
}


/** Every email holding one entitlement, for the admin's catch-up view. */
export async function listEntitlementHolders(product) {
  const sql = db();
  await ensureSchema();
  const rows = await sql`select email from entitlements where product = ${product}`;
  return rows.map((r) => r.email);
}


/* ---------------- the Claude connector's OAuth tables ---------------- */

/**
 * Clients that have registered, and codes waiting to be spent.
 *
 * Tokens are not here: they are signed rather than stored (see lib/oauth.js).
 * These two have to be, because a redirect URI must be fixed at registration
 * and a code must be spendable exactly once.
 */
let _oauthReady = null;
export async function ensureOauth() {
  if (_oauthReady) return _oauthReady;
  _oauthReady = (async () => {
    const sql = db();
    await ensureSchema();
    await sql`
      create table if not exists oauth_clients (
        client_id     text primary key,
        name          text,
        redirect_uris jsonb not null,
        created_at    timestamptz not null default now()
      )`;
    await sql`
      create table if not exists oauth_codes (
        code_hash      text primary key,
        client_id      text not null,
        email          text not null,
        epoch          integer not null default 1,
        redirect_uri   text not null,
        code_challenge text not null,
        resource       text,
        expires_at     timestamptz not null,
        used_at        timestamptz
      )`;
    await sql`create index if not exists oauth_codes_expiry_idx on oauth_codes (expires_at)`;
    // One row per connector a member has approved. A token names its grant, so
    // revoking the row stops that connector and leaves their others alone.
    await sql`
      create table if not exists oauth_grants (
        id           bigserial primary key,
        email        text not null,
        client_id    text not null,
        client_name  text,
        created_at   timestamptz not null default now(),
        last_used_at timestamptz,
        revoked_at   timestamptz
      )`;
    await sql`create index if not exists oauth_grants_email_idx on oauth_grants (email, created_at desc)`;
    await sql`create unique index if not exists oauth_grants_live_idx
              on oauth_grants (email, client_id) where revoked_at is null`;
  })().catch((err) => { _oauthReady = null; throw err; });
  return _oauthReady;
}

export async function insertOauthClient({ clientId, name, redirectUris }) {
  const sql = db();
  await ensureOauth();
  await sql`insert into oauth_clients (client_id, name, redirect_uris)
            values (${clientId}, ${name || null}, ${JSON.stringify(redirectUris)})`;
  return { clientId, name: name || null, redirectUris };
}

export async function oauthClient(clientId) {
  const sql = db();
  await ensureOauth();
  const rows = await sql`select * from oauth_clients where client_id = ${String(clientId || '')}`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    clientId: r.client_id,
    name: r.name,
    redirectUris: Array.isArray(r.redirect_uris) ? r.redirect_uris : JSON.parse(r.redirect_uris || '[]')
  };
}

export async function insertOauthCode(row) {
  const sql = db();
  await ensureOauth();
  await sql`
    insert into oauth_codes (code_hash, client_id, email, epoch, redirect_uri, code_challenge, resource, expires_at)
    values (${row.codeHash}, ${row.clientId}, ${normalizeEmail(row.email)}, ${Number(row.epoch) || 1},
            ${row.redirectUri}, ${row.codeChallenge}, ${row.resource || null}, ${row.expiresAt})`;
  // Opportunistic sweep; an expired code is useless and there is no job for it.
  await sql`delete from oauth_codes where expires_at < now() - interval '1 day'`;
}

/**
 * Spends a code, or returns null.
 *
 * `used_at is null` being part of the where clause is what makes it single-use:
 * two simultaneous redemptions cannot both come back with a row, however they
 * interleave.
 */
export async function spendOauthCode(codeHash) {
  const sql = db();
  await ensureOauth();
  const rows = await sql`
    update oauth_codes set used_at = now()
    where code_hash = ${codeHash} and used_at is null and expires_at > now()
    returning *`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    clientId: r.client_id, email: r.email, epoch: r.epoch,
    redirectUri: r.redirect_uri, codeChallenge: r.code_challenge, resource: r.resource
  };
}

/**
 * The live grant for this member and client, made if there is not one.
 *
 * Approving the same connector twice should not leave two rows for the member
 * to puzzle over, so an existing live grant is reused - which the partial
 * unique index makes safe under a race.
 */
export async function grantFor(email, clientId, clientName) {
  const sql = db();
  await ensureOauth();
  const who = normalizeEmail(email);
  const rows = await sql`
    insert into oauth_grants (email, client_id, client_name)
    values (${who}, ${clientId}, ${clientName || null})
    on conflict (email, client_id) where revoked_at is null
      do update set client_name = coalesce(excluded.client_name, oauth_grants.client_name)
    returning id`;
  return Number(rows[0].id);
}

/** A grant, only while it is still live. */
export async function liveGrant(id) {
  const sql = db();
  await ensureOauth();
  const rows = await sql`select id, email, client_id, client_name, created_at, last_used_at
                         from oauth_grants where id = ${Number(id) || 0} and revoked_at is null`;
  return rows[0] || null;
}

/** Every connector this member has approved and not taken back. */
export async function listGrants(email) {
  const sql = db();
  await ensureOauth();
  return sql`select id, client_name, created_at, last_used_at
             from oauth_grants
             where email = ${normalizeEmail(email)} and revoked_at is null
             order by created_at desc`;
}

/**
 * Takes one back. Scoped to the member, so an id guessed from somewhere else
 * cannot disconnect a connector belonging to anybody but the caller.
 */
export async function revokeGrant(email, id) {
  const sql = db();
  await ensureOauth();
  const rows = await sql`update oauth_grants set revoked_at = now()
                         where id = ${Number(id) || 0}
                           and email = ${normalizeEmail(email)}
                           and revoked_at is null
                         returning id`;
  return rows.length > 0;
}

/**
 * Notes that a grant was used, at most once every few minutes.
 *
 * Without the throttle this would be a write on every single tool call, which
 * is a lot of writing to power a line of text on the account screen.
 */
export async function touchGrant(id) {
  const sql = db();
  await ensureOauth();
  await sql`update oauth_grants set last_used_at = now()
            where id = ${Number(id) || 0}
              and (last_used_at is null or last_used_at < now() - interval '5 minutes')`;
}
