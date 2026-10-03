/**
 * The connectors a member has approved, and taking one back.
 *
 *   GET   /api/account/connections              -> the live ones
 *   POST  /api/account/connections  { id }      -> disconnect that one
 *
 * Scoped to the signed-in member throughout. The id comes from the browser, so
 * the revoke is matched on email as well - an id belonging to somebody else
 * simply finds no row rather than disconnecting their connector.
 */
import { sessionEmail } from '../../lib/session.js';
import { listGrants, revokeGrant } from '../../lib/db.js';

export default async function handler(req, res) {
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });

  try {
    if (req.method === 'GET') {
      const rows = await listGrants(email);
      return res.status(200).json({
        connections: rows.map((r) => ({
          id: Number(r.id),
          // A connector that registered without a name is still a connector;
          // calling it "Claude" would be a guess.
          name: r.client_name || 'An application',
          connectedAt: r.created_at,
          lastUsedAt: r.last_used_at
        }))
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
      const id = Number(body.id);
      if (!id) return res.status(400).json({ error: 'missing id' });

      const done = await revokeGrant(email, id);
      // Already gone is the outcome they wanted, so it is not an error.
      return res.status(200).json({ ok: true, revoked: done });
    }

    return res.status(405).json({ error: 'GET or POST' });
  } catch (err) {
    console.error('[account/connections]', err);
    return res.status(500).json({ error: 'server' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
