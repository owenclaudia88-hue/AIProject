/**
 * Dynamic Client Registration (RFC 7591).
 *
 * Claude has to be able to introduce itself before anybody can authorize it, so
 * this endpoint is open. What it hands back is only a name - a client_id is not
 * a credential here, because every client is public and proves itself with PKCE
 * instead. The thing worth guarding is the redirect URI: that is where an
 * authorization code gets sent, so it is fixed at registration and checked
 * again at every step afterwards.
 */
import { registerClient, isAllowedRedirect, SCOPE } from '../../lib/oauth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'invalid_request' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];

  if (!uris.length) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris is required'
    });
  }
  if (uris.length > 10) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'too many redirect_uris'
    });
  }
  const bad = uris.find((u) => !isAllowedRedirect(u));
  if (bad) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: `not an allowed redirect URI: ${bad}`
    });
  }

  try {
    const name = typeof body.client_name === 'string' ? body.client_name.slice(0, 120) : null;
    const client = await registerClient({ name, redirectUris: uris });

    // 201 with the registered metadata echoed back, per RFC 7591 §3.2.1.
    return res.status(201).json({
      client_id: client.clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.name || undefined,
      redirect_uris: client.redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: SCOPE
    });
  } catch (err) {
    console.error('[oauth/register]', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
