/**
 * Swaps an authorization code for a token, and refreshes one.
 *
 * Every client here is public - there is no secret to present - so what proves
 * the caller is the same program that started the flow is PKCE: it sent a hash
 * up front and has to show the value it hashed. A code stolen in transit is
 * useless without it.
 */
import { sessionEpochFor, grantFor, liveGrant } from '../../lib/db.js';
import {
  consumeCode, verifyChallenge, issueAccessToken, issueRefreshToken,
  readRefreshToken, accessTokenTtl, resourceUrl, SCOPE, getClient
} from '../../lib/oauth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return fail(res, 405, 'invalid_request', 'POST only');

  const body = parseBody(req);

  try {
    if (body.grant_type === 'authorization_code') return await byCode(res, body);
    if (body.grant_type === 'refresh_token') return await byRefresh(res, body);
    return fail(res, 400, 'unsupported_grant_type', 'authorization_code or refresh_token');
  } catch (err) {
    console.error('[oauth/token]', err);
    return fail(res, 500, 'server_error');
  }
}

async function byCode(res, body) {
  if (!body.code) return fail(res, 400, 'invalid_request', 'code is required');
  if (!body.code_verifier) return fail(res, 400, 'invalid_request', 'code_verifier is required');

  // Spent here, whatever happens next: a code that was presented once is burnt
  // even if the rest of the request turns out to be wrong.
  const row = await consumeCode(body.code);
  if (!row) return fail(res, 400, 'invalid_grant', 'that code is unknown, used or expired');

  if (body.client_id && body.client_id !== row.clientId) {
    return fail(res, 400, 'invalid_grant', 'that code was issued to a different client');
  }
  // The redirect URI is part of what the code is bound to, so a code cannot be
  // replayed against a different callback than the one that was approved.
  if (body.redirect_uri && body.redirect_uri !== row.redirectUri) {
    return fail(res, 400, 'invalid_grant', 'redirect_uri does not match the one authorized');
  }
  if (!verifyChallenge(body.code_verifier, row.codeChallenge)) {
    return fail(res, 400, 'invalid_grant', 'code_verifier does not match the challenge');
  }

  // The grant is made here rather than at the consent screen, so a member who
  // opens the screen and wanders off does not leave a connector listed on
  // their account that was never actually connected.
  const client = await getClient(row.clientId);
  const grantId = await grantFor(row.email, row.clientId, client?.name);

  const resource = row.resource || resourceUrl();
  return issue(res, { email: row.email, epoch: row.epoch, clientId: row.clientId, resource, grantId });
}

async function byRefresh(res, body) {
  const claims = readRefreshToken(body.refresh_token);
  if (!claims) return fail(res, 400, 'invalid_grant', 'that refresh token is not valid');
  if (body.client_id && body.client_id !== claims.cid) {
    return fail(res, 400, 'invalid_grant', 'that token was issued to a different client');
  }

  // The epoch is bumped when somebody changes their password or signs out
  // everywhere. Checking it here is what makes those reach a connector that was
  // authorized before: the refresh stops, and the access token expires on its
  // own within hours.
  const [epoch, grant] = await Promise.all([
    sessionEpochFor(claims.sub),
    // Disconnected from the account screen: the token is still perfectly
    // signed, and refused anyway because the grant behind it is gone.
    claims.gid ? liveGrant(claims.gid) : Promise.resolve(null)
  ]);
  if (Number(epoch) !== Number(claims.epoch)) {
    return fail(res, 400, 'invalid_grant', 'this authorization was ended, please reconnect');
  }
  if (claims.gid && !grant) {
    return fail(res, 400, 'invalid_grant', 'this connector was disconnected, please reconnect');
  }

  return issue(res, {
    email: claims.sub, epoch: claims.epoch, clientId: claims.cid, grantId: claims.gid,
    resource: claims.aud || resourceUrl()
  });
}

function issue(res, who) {
  return res.status(200).json({
    access_token: issueAccessToken(who),
    token_type: 'Bearer',
    expires_in: accessTokenTtl(),
    refresh_token: issueRefreshToken(who),
    scope: SCOPE
  });
}

function fail(res, status, error, description) {
  return res.status(status).json({
    error,
    ...(description ? { error_description: description } : {})
  });
}

/** Token requests are form-encoded; some clients send JSON anyway. */
function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'object') return b;
  const s = String(b);
  if (s.trim().startsWith('{')) {
    try { return JSON.parse(s); } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(s));
}
