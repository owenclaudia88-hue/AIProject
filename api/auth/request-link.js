import { isActive, createLoginToken, normalizeEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { sendMagicLink } from '../../lib/email.js';

/**
 * POST /api/auth/request-link  { email }
 *
 * A returning member enters their email; if they have active access we email a
 * one-time sign-in link. The response is deliberately identical whether or not
 * the email is a customer, so this can't be used to discover who has an account.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = normalizeEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    // Active customers get a link, and so do staff — who run the place and
    // should not have to buy the product to sign in and answer a support
    // question. Either way the reply below is the same, so this still cannot
    // be used to find out who holds an account.
    if (isAdmin(email) || await isActive(email)) {
      const token = await createLoginToken(email);
      const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
      const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;
      await sendMagicLink(email, loginUrl);
    }

    return res.status(200).json({
      ok: true,
      message: 'If that email has access, a sign-in link is on its way.'
    });
  } catch (err) {
    console.error('[request-link]', err);
    return res.status(500).json({ error: 'Could not send the link. Please try again.' });
  }
}
