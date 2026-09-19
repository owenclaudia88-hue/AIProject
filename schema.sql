-- Run once against your Neon database (psql, or the Neon SQL editor).
-- The app also self-heals on boot via lib/db.js ensureSchema(), so this is
-- mainly here as the readable source of truth.

create table if not exists customers (
  email               text primary key,
  status              text not null default 'active',   -- active | revoked
  stripe_customer_id  text,
  last_payment_intent text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Single-use, short-lived magic-link tokens. Only the hash is stored, so a
-- database leak cannot be replayed into logins.
create table if not exists login_tokens (
  token_hash  text primary key,
  email       text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists login_tokens_email_idx on login_tokens (email);
create index if not exists login_tokens_expiry_idx on login_tokens (expires_at);

-- Display name shown next to a member's comments (set on their first post).
alter table customers add column if not exists name text;

-- Course discussion: one thread per course, visible to every member. Replies
-- hang off parent_id; staff replies carry is_admin. lesson_id / lesson_title are
-- denormalised so the panel can label a comment without loading the course tree.
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
  deleted_at    timestamptz            -- soft delete, so answered questions keep their thread
);

create index if not exists comments_course_idx on comments (course_slug, created_at);
create index if not exists comments_parent_idx on comments (parent_id);

-- Bookmarked lessons, per member.
create table if not exists bookmarks (
  email       text not null,
  lesson_id   text not null,
  course_slug text not null,
  title       text,
  created_at  timestamptz not null default now(),
  primary key (email, lesson_id)
);

create index if not exists bookmarks_email_idx on bookmarks (email, created_at desc);
