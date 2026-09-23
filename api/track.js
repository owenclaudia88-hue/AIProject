import { CLIENT_EVENTS } from '../lib/meta-capi.js';
import { recordPageEvent } from '../lib/db.js';
import { resolveGeo } from '../lib/geo.js';

// Crawlers, previewers and uptime checks. Not exhaustive and never will be,
// but it keeps the obvious ones out of the numbers — without it the busiest
// "visitor" on a new site is usually Googlebot.
const BOT = /bot|crawler|spider|crawl|slurp|facebookexternalhit|headless|lighthouse|preview|monitor|curl|wget|python-requests|axios|postman/i;

/**
 * POST /api/track  { event, fbclid?, fbp?, sourceUrl?, email?, firstName?, ... }
 *
 * The browser's only part in tracking: it hands over the click id and the page
 * it is on, and the server sends the event to Meta. Nothing is loaded from
 * Meta in the page, so an ad blocker cannot drop it.
 *
 * Public by necessity, so it is kept narrow: only the two event names below
 * can be fired, the value and currency come from server config rather than
 * the request, and the source URL has to be one of our own pages — otherwise
 * this becomes a way for anyone to write junk into the pixel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

    const eventName = String(body.event || '');
    const sender = CLIENT_EVENTS[eventName];
    if (!sender) return res.status(400).json({ error: 'unknown event' });

    // Only our own pages may be named as the source.
    const site = (process.env.SITE_URL || `https://${req.headers.host || ''}`).replace(/\/+$/, '');
    let sourceUrl = site + '/';
    try {
      const asked = new URL(String(body.sourceUrl || ''), site);
      if (asked.host === new URL(site).host) sourceUrl = asked.toString();
    } catch { /* keep the default */ }

    const str = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

    const ua = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip'] || '';

    // A crawler is not a visitor. It is counted nowhere and reported nowhere —
    // sending it on to Meta would teach the ad optimiser to chase robots.
    if (BOT.test(ua)) return res.status(200).json({ ok: true, ignored: 'bot' });

    // Only the referring host, never the full URL — a search or a link from a
    // private page can carry all sorts in its query string, and none of it is
    // any use for counting where traffic came from.
    let referrer = null;
    try {
      const r = new URL(String(body.referrer || ''));
      const self = new URL(site).host;
      if (r.host && r.host !== self) referrer = r.host.replace(/^www\./, '');
    } catch { /* no referrer, or not a URL — counts as direct */ }

    let path = '/';
    try { path = new URL(sourceUrl).pathname || '/'; } catch { /* keep the default */ }

    // IPinfo when a token is set, so we get the city too, cached per address so
    // it is one lookup a month rather than one per view. Falls back to the
    // country Vercel already resolved at the edge.
    const geo = await resolveGeo(ip, req.headers['x-vercel-ip-country']);

    // Our own copy of the event, written before Meta is called so a Meta outage
    // or a missing token cannot cost us the number. Meta only ever reports what
    // its attribution can see; this is the figure we control.
    await recordPageEvent({
      event: eventName,
      path,
      visitor: str(body.visitor, 64),
      session: str(body.session, 64),
      referrer,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      device: /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop',
      // Whether Meta will be able to tie this back to the ad that paid for it.
      hasFbc: !!(str(body.fbclid, 300) || str(body.fbp, 100))
    });

    await sender({
      sourceUrl,
      ip: ip || null,
      ua: ua || null,
      fbclid: str(body.fbclid, 300),
      fbclidAt: Number(body.fbclidAt) || undefined,
      fbp: str(body.fbp, 100),
      // Sent once the checkout form has them — they make the match far better,
      // and they are hashed before they leave the server.
      email: str(body.email, 320),
      firstName: str(body.firstName, 100),
      lastName: str(body.lastName, 100),
      city: str(body.city, 100),
      zip: str(body.zip, 32),
      // InitiateCheckout fires when the name and email are in, which is before
      // the address fields exist on the form — so the browser has no country to
      // give and Meta was seeing it on a quarter of events. We already resolved
      // one from the IP, and the IP goes to Meta anyway, so this tells it
      // nothing it could not work out and lifts the match rate for free.
      country: str(body.country, 8) || geo.country || undefined
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // A tracking failure must never surface to the visitor.
    console.error('[track]', err);
    return res.status(200).json({ ok: false });
  }
}
