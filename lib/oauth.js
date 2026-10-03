/**
 * The OAuth 2.1 authorization server behind the Claude connector.
 *
 * Claude cannot be handed the member's session cookie, so the connector needs
 * its own credential: a token that says "this member, read-only, for this one
 * resource". That is all this file issues.
 *
 * Tokens are signed rather than stored, the same shape the session cookie
 * already uses, and they carry the member's session epoch. That is what makes
 * "sign out everywhere" and a password change reach the connector too - without
 * it, a token handed out once would outlive every other way of taking access
 * away. What it does not give is a per-connector revoke button; that needs a
 * token table, and can be added without changing anything a client sees.
 *
 * Codes and clients are stored, because a code has to be single-use and a
 * client's redirect URIs have to be fixed at registration. Codes are stored as
 * hashes: a leaked database should not contain anything still spendable.
 */
import crypto from 'node:crypto';
import { normalizeEmail, insertOauthClient, oauthClient, insertOauthCode, spendOauthCode } from './db.js';

/** The one scope. Read-only is the whole design, so there is nothing to pick. */
export const SCOPE = 'library:read';

const ACCESS_TTL = 60 * 60 * 8;          // 8 hours
const REFRESH_TTL = 60 * 60 * 24 * 60;   // 60 days
const CODE_TTL_MS = 5 * 60 * 1000;       // 5 minutes, per OAuth 2.1 guidance

/**
 * Derived from SESSION_SECRET rather than configured separately: one fewer
 * secret to set, and the label keeps these signatures from ever being
 * interchangeable with a session cookie's.
 */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is not set (or too short)');
  return crypto.createHmac('sha256', s).update('mcp-oauth-v1').digest();
}

/** The canonical origin. Taken from config, never from the request's Host. */
export function siteUrl() {
  return (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
}

/** The resource identifier this server issues tokens for (RFC 8707). */
export function resourceUrl() {
  return `${siteUrl()}/api/mcp`;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/* ---------------- tokens ---------------- */

/**
 * `<base64url(json)>.<sig>`. The claims are readable by anyone holding the
 * token, which is fine - they describe the holder to themselves - but they
 * cannot be edited without the secret.
 */
function issueToken(claims, ttl) {
  const body = b64(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttl }));
  return `${body}.${sign(body)}`;
}

function readToken(token, type) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = sign(body);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (claims.typ !== type) return null;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function issueAccessToken({ email, epoch, clientId, resource }) {
  return issueToken({
    typ: 'at', sub: normalizeEmail(email), epoch: Number(epoch) || 1,
    cid: clientId, aud: resource, scope: SCOPE
  }, ACCESS_TTL);
}

export function issueRefreshToken({ email, epoch, clientId, resource }) {
  return issueToken({
    typ: 'rt', sub: normalizeEmail(email), epoch: Number(epoch) || 1,
    cid: clientId, aud: resource, scope: SCOPE
  }, REFRESH_TTL);
}

export const readAccessToken = (t) => readToken(t, 'at');
export const readRefreshToken = (t) => readToken(t, 'rt');

/** Seconds an access token is good for, for the token response. */
export const accessTokenTtl = () => ACCESS_TTL;

/* ---------------- clients ---------------- */

/**
 * A redirect URI we are willing to send an authorization code to.
 *
 * HTTPS anywhere, because the client registering is a cloud service whose
 * callback we cannot know in advance, plus loopback for a client running on the
 * member's own machine. Everything else - and in particular plain http on a
 * host that is not loopback - is refused, because a code put on the wire in
 * clear is a code somebody else can spend.
 */
export function isAllowedRedirect(uri) {
  let u;
  try { u = new URL(String(uri)); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]');
}

export async function registerClient({ name, redirectUris }) {
  const clientId = `afu_${crypto.randomBytes(18).toString('base64url')}`;
  return insertOauthClient({ clientId, name, redirectUris });
}

export const getClient = (clientId) => oauthClient(clientId);

/* ---------------- authorization codes ---------------- */

/** Stored as a hash: a leaked database should hold nothing still spendable. */
export async function issueCode({ clientId, email, epoch, redirectUri, codeChallenge, resource }) {
  const code = crypto.randomBytes(32).toString('base64url');
  await insertOauthCode({
    codeHash: b64(sha256(code)),
    clientId, email, epoch, redirectUri, codeChallenge, resource,
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });
  return code;
}

/** Spends a code, or returns null. Single-use is enforced by the update. */
export function consumeCode(code) {
  return spendOauthCode(b64(sha256(String(code || ''))));
}

/** PKCE S256, the only method we advertise. */
export function verifyChallenge(verifier, challenge) {
  const v = String(verifier || '');
  if (v.length < 43 || v.length > 128) return false;
  const computed = b64(sha256(v));
  const given = String(challenge || '');
  if (computed.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(given));
}

/* ---------------- the pending-request cookie ---------------- */

/**
 * Where the authorize request is parked while the member signs in.
 *
 * It goes in a signed cookie rather than on the query string of the sign-in
 * redirect, so the sign-in flow keeps its allowlist of destinations and never
 * learns how to take a URL from outside and send somebody to it.
 */
const PENDING = 'afu_oauth_pending';

export function pendingCookie(params) {
  const body = b64(JSON.stringify({ ...params, exp: Math.floor(Date.now() / 1000) + 900 }));
  const value = `${body}.${sign(body)}`;
  return `${PENDING}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900`;
}

export function clearPendingCookie() {
  return `${PENDING}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readPending(req) {
  const m = String(req.headers?.cookie || '').match(new RegExp(`(?:^|;\\s*)${PENDING}=([^;]+)`));
  if (!m) return null;
  try {
    const [body, sig] = m[1].split('.');
    if (!body || !sig) return null;
    const expected = sign(body);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
