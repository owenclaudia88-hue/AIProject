import { readSession } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/admin/geo-status[?ip=1.2.3.4]
 *
 * Whether IPinfo is reachable from this deployment, and what it actually says.
 *
 * lib/geo.js swallows every failure on purpose — a slow or broken location
 * lookup must never hold up a page view — which means a wrong token, a plan
 * that does not include the endpoint, or a typo all look identical from
 * outside: cities simply never appear. This is the only way to see which.
 *
 * Returns the raw status and a short slice of the body. Never the token.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  const token = process.env.IPINFO_TOKEN || '';
  const out = {
    environment: process.env.VERCEL_ENV || 'unknown',
    tokenSet: !!token,
    tokenLength: token.length || 0,
    vercelEdgeCountry: req.headers['x-vercel-ip-country'] || null
  };

  if (!token) {
    out.verdict = 'IPINFO_TOKEN is not set in this deployment. Countries still work '
      + '(Vercel resolves them at the edge); cities need the token.';
    return res.status(200).json(out);
  }

  const url = new URL(req.url, 'http://localhost');
  const ip = url.searchParams.get('ip')
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || '8.8.8.8';
  out.testedIp = ip;

  // Both shapes, because which one works depends on the plan: /lookup is the
  // Core endpoint, the bare path is the one every tier has. Knowing which
  // answers is the whole point of running this.
  const endpoints = {
    core: `https://api.ipinfo.io/lookup/${encodeURIComponent(ip)}`,
    standard: `https://ipinfo.io/${encodeURIComponent(ip)}/json`
  };

  out.results = {};
  for (const [name, base] of Object.entries(endpoints)) {
    try {
      const r = await fetch(`${base}?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const body = await r.text().catch(() => '');
      out.results[name] = {
        status: r.status,
        ok: r.ok,
        // Enough to see the country/city or the error, not enough to dump a
        // whole payload into a browser tab.
        body: body.slice(0, 400)
      };
    } catch (err) {
      out.results[name] = { error: String(err && err.message || err) };
    }
  }

  return res.status(200).json(out);
}
