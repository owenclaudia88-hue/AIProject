import { readSession } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { sendPageView } from '../../lib/meta-capi.js';

/**
 * GET /api/admin/meta-status[?send=1]
 *
 * Whether this deployment can actually talk to Meta.
 *
 * Exists because a missing META_CAPI_TOKEN is completely silent: the browser
 * gets {ok:true} either way, the traffic dashboard fills up normally, and the
 * only sign that nothing is reaching Meta is an ad account reporting no
 * conversions — by which point the money is spent. Environment variables set
 * locally and never set in Vercel is the easiest mistake to make here and the
 * hardest to see.
 *
 * Never returns the token, only whether one is present and how long it is,
 * which is enough to tell "unset" from "pasted wrong" without putting a
 * credential in a browser tab.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  const pixelId = process.env.META_PIXEL_ID || '';
  const token = process.env.META_CAPI_TOKEN || '';

  const out = {
    environment: process.env.VERCEL_ENV || 'unknown',
    pixelId: pixelId || null,
    pixelIdSet: !!pixelId,
    tokenSet: !!token,
    tokenLength: token.length || 0,
    testEventCode: process.env.META_TEST_EVENT_CODE || null,
    configured: !!(pixelId && token)
  };

  // ?send=1 posts a real event and hands back exactly what Meta said. A 200
  // with events_received:1 is the only thing that actually proves the pipe,
  // short of watching Events Manager.
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('send') === '1') {
    const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
    out.testSend = await sendPageView({
      sourceUrl: `${site}/`,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
      ua: req.headers['user-agent'] || null
    });
  }

  return res.status(200).json(out);
}
