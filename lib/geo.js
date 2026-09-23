import crypto from 'node:crypto';
import { getGeoCache, putGeoCache } from './db.js';

/**
 * Where a visitor is, from their IP.
 *
 * Vercel already resolves the country at the edge and puts it in a header, for
 * free and with no latency. IPinfo is asked as well because it also returns the
 * region and city, which the header does not — but only once per IP per month:
 * the answer is cached, because an address does not move, and calling an API on
 * every page view to be told the same thing would add a round trip to every
 * request for nothing.
 *
 * The IP itself is never stored. The cache is keyed by a salted hash of it, so
 * this can recognise an address it has seen before without keeping a record of
 * who visited from where.
 */

const TIMEOUT_MS = 1200;
const TTL_DAYS = 30;

// No point asking about an address that cannot be geolocated.
function isPrivate(ip) {
  return !ip
    || ip === '::1' || ip === '127.0.0.1'
    || /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || /^169\.254\./.test(ip)
    || /^f[cd]/i.test(ip);
}

function hash(ip) {
  // Salted so the hashes are useless outside this database. Any long secret
  // this deployment already has will do.
  const salt = process.env.SESSION_SECRET || process.env.CRON_SECRET || 'aifu';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 40);
}

async function askIpinfo(ip) {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;

  // Time-boxed and fails open. A slow lookup must never hold up the beacon —
  // the country is the least important thing on the request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.ipinfo.io/lookup/${encodeURIComponent(ip)}?token=${token}`,
      { signal: controller.signal, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d) return null;

    // Two response shapes, depending on the plan behind the token.
    //
    //   Core     { ip, geo: { city, region, country: "United States",
    //                         country_code: "US", … }, as: {…} }
    //   Standard { ip, city, region, country: "US", … }
    //
    // Core puts everything under `geo` and spells `country` out in full, so
    // reading a flat `country` off it yields undefined — which is exactly how
    // this failed silently, returning null for every lookup while the token
    // and the endpoint were both perfectly fine.
    const g = d.geo && typeof d.geo === 'object' ? d.geo : d;
    const code = g.country_code
      || (typeof g.country === 'string' && g.country.length === 2 ? g.country : '');
    if (!code) return null;

    return {
      country: String(code).slice(0, 8),
      region: g.region ? String(g.region).slice(0, 80) : null,
      city: g.city ? String(g.city).slice(0, 80) : null
    };
  } catch {
    return null;   // timeout, network, bad JSON — the header still stands
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param ip              the visitor's address
 * @param headerCountry   x-vercel-ip-country, used when IPinfo is unavailable
 */
export async function resolveGeo(ip, headerCountry) {
  const fallback = {
    country: headerCountry ? String(headerCountry).slice(0, 8) : null,
    region: null, city: null
  };
  if (isPrivate(ip)) return fallback;

  const key = hash(ip);
  try {
    const cached = await getGeoCache(key, TTL_DAYS);
    if (cached) return cached;
  } catch { /* a cache miss is not a failure */ }

  const fresh = await askIpinfo(ip);
  if (!fresh) return fallback;

  try { await putGeoCache(key, fresh); } catch { /* best effort */ }
  return fresh;
}
