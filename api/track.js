import { CLIENT_EVENTS } from '../lib/meta-capi.js';

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

    await sender({
      sourceUrl,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || null,
      ua: req.headers['user-agent'] || null,
      fbclid: str(body.fbclid, 300),
      fbp: str(body.fbp, 100),
      // Sent once the checkout form has them — they make the match far better,
      // and they are hashed before they leave the server.
      email: str(body.email, 320),
      firstName: str(body.firstName, 100),
      lastName: str(body.lastName, 100),
      city: str(body.city, 100),
      zip: str(body.zip, 32),
      country: str(body.country, 8)
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // A tracking failure must never surface to the visitor.
    console.error('[track]', err);
    return res.status(200).json({ ok: false });
  }
}
