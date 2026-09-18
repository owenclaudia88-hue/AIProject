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
export async function grantAccess(email, { paymentIntent, stripeCustomerId } = {}) {
  const sql = db();
  await ensureSchema();
  const e = normalizeEmail(email);
  const rows = await sql`
    insert into customers (email, status, stripe_customer_id, last_payment_intent, updated_at)
    values (${e}, 'active', ${stripeCustomerId ?? null}, ${paymentIntent ?? null}, now())
    on conflict (email) do update set
      status = 'active',
      stripe_customer_id = coalesce(${stripeCustomerId ?? null}, customers.stripe_customer_id),
      last_payment_intent = coalesce(${paymentIntent ?? null}, customers.last_payment_intent),
      updated_at = now()
    returning (xmax = 0) as created`;
  return rows[0]?.created === true;
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
  const rows = await sql`select email, status from customers where email = ${normalizeEmail(email)} limit 1`;
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
