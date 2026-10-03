/**
 * The MCP endpoint — Streamable HTTP, JSON-RPC over POST.
 *
 * No SSE. The transport allows a request to be answered with a single
 * `application/json` response, and every tool here returns in one go, so there
 * is nothing to stream and no long-lived connection for a serverless function
 * to hold open. GET is refused with 405, which the spec names as the way to say
 * "no server-initiated stream here".
 *
 * Authorization is Bearer only. Deliberately: this endpoint must never accept
 * the member's session cookie, because a cookie would let any page in their
 * browser drive it. The token has to be presented, and only Claude has one.
 */
import { getCustomer, sessionEpochFor, entitlementsFor } from '../lib/db.js';
import { MEMBERSHIP_ONLY } from '../lib/products.js';
import { readAccessToken, resourceUrl, siteUrl, SCOPE } from '../lib/oauth.js';
import { TOOL_SCHEMAS, toolByName } from '../lib/mcp-tools.js';

const SERVER = { name: 'ai-founder-university', title: 'AI Founder University', version: '1.0.0' };

/** Handshake revisions we speak. Newest first; a client's choice wins. */
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.status(204).send('');
  }
  // No stream to open, and no session to end. Both are allowed answers.
  if (req.method === 'GET' || req.method === 'DELETE') {
    return res.status(405).json({ error: 'this endpoint takes POST only' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  /* ---- who is calling ---- */
  const token = bearer(req);
  if (!token) return unauthorized(res, 'a bearer token is required');

  const claims = readAccessToken(token);
  if (!claims) return unauthorized(res, 'that token is not valid or has expired');
  // The token has to have been minted for this server. A token for somewhere
  // else, however genuine, is not usable here.
  if (claims.aud && !sameResource(claims.aud, resourceUrl())) {
    return unauthorized(res, 'that token was issued for a different resource');
  }

  let email;
  try {
    email = claims.sub;
    const [customer, epoch] = await Promise.all([getCustomer(email), sessionEpochFor(email)]);
    if (!customer || customer.status !== 'active') {
      return unauthorized(res, 'this account is no longer active');
    }
    // Signing out everywhere or changing a password bumps the epoch, which is
    // what reaches a connector authorized before it happened.
    if (Number(epoch) !== Number(claims.epoch)) {
      return unauthorized(res, 'this authorization was ended, please reconnect');
    }
  } catch (err) {
    console.error('[mcp] auth', err);
    return rpcError(res, null, -32603, 'server error');
  }

  /* ---- the message ---- */
  const msg = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  if (Array.isArray(msg)) {
    // Batching was removed from the protocol; nothing we talk to sends it.
    return rpcError(res, null, -32600, 'batched requests are not supported');
  }
  const { id = null, method } = msg;

  // A notification or a response carries no id and wants no answer.
  if (id === null || id === undefined) {
    return res.status(202).send('');
  }

  try {
    switch (method) {
      case 'initialize': {
        const asked = msg.params?.protocolVersion;
        return rpcOk(res, id, {
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions:
            'This is the signed-in member\'s own AI Founder University library. '
            + 'Start with search_library or list_categories, then get_item to read something in full. '
            + 'Everything is read-only.'
        });
      }

      case 'ping':
        return rpcOk(res, id, {});

      case 'tools/list':
        return rpcOk(res, id, { tools: TOOL_SCHEMAS });

      case 'tools/call': {
        const tool = toolByName(msg.params?.name);
        if (!tool) return rpcError(res, id, -32602, `no such tool: ${msg.params?.name}`);

        // Resolved per call, not per token: a membership that lapsed between
        // connecting and asking takes its content away on the very next
        // request, without needing the token to be revoked.
        const entitled = await entitlementsFor(email);
        if (!entitled.has(MEMBERSHIP_ONLY)) {
          return rpcOk(res, id, toolResult({
            error: 'This needs an active AI Founder University membership. '
              + `Resubscribe at ${siteUrl()}/members/join.html and the connector starts working again straight away.`
          }, true));
        }

        const out = await tool.run(msg.params?.arguments || {}, entitled);
        return rpcOk(res, id, toolResult(out, !!out?.error));
      }

      default:
        return rpcError(res, id, -32601, `method not supported: ${method}`);
    }
  } catch (err) {
    console.error('[mcp]', method, err);
    return rpcError(res, id, -32603, 'server error');
  }
}

/* ---------------- plumbing ---------------- */

function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function sameResource(a, b) {
  const trim = (s) => String(s || '').replace(/\/+$/, '').toLowerCase();
  return trim(a) === trim(b);
}

/**
 * 401 with the pointer that starts the whole OAuth flow: without
 * `resource_metadata` a client has no way to find out where to send the member
 * to sign in.
 */
function unauthorized(res, description) {
  res.setHeader('WWW-Authenticate',
    `Bearer resource_metadata="${siteUrl()}/.well-known/oauth-protected-resource", `
    + `scope="${SCOPE}", error="invalid_token", error_description="${description.replace(/"/g, '')}"`);
  return res.status(401).json({ error: 'invalid_token', error_description: description });
}

function rpcOk(res, id, result) {
  return res.status(200).json({ jsonrpc: '2.0', id, result });
}

function rpcError(res, id, code, message) {
  return res.status(200).json({ jsonrpc: '2.0', id, error: { code, message } });
}

/** A tool answer: JSON for a client that wants it, text for the model. */
function toolResult(data, isError) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: !!isError
  };
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
