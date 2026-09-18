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
