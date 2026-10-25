import { isActive, createLoginToken, normalizeEmail, resolveAccountEmail } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { sendMagicLink } from '../../lib/email.js';
import { destinationFor } from '../../lib/destinations.js';

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

    /* The account this address reaches, which is usually itself.
       Where a company mail server refuses everything we send, support adds a
       second address to the account; entering it here has to work, or the way
       out of a blocked inbox is itself behind that inbox. */
    const account = await resolveAccountEmail(email);

    // Active customers get a link, and so do staff — who run the place and
    // should not have to buy the product to sign in and answer a support
    // question. Either way the reply below is the same, so this still cannot
    // be used to find out who holds an account.
    if (isAdmin(account) || await isActive(account)) {
      // Minted for the account, delivered to whichever of its addresses was
      // typed. The session is always the account's own, so entitlements, the
      // roadmap and everything else keyed on it are untouched.
      const token = await createLoginToken(account);
      const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
      // Someone resetting a password should land on the page that resets it,
      // not in the library wondering where to go. Only a known key travels.
      const next = destinationFor(body.next) ? `&next=${encodeURIComponent(String(body.next))}` : '';
      const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}${next}`;
      await sendMagicLink(email, loginUrl);
    }

    return res.status(200).json({
      ok: true,
      message: 'If that email has access, a sign-in link is on its way. Open the newest email we send: older links stop working.'
    });
  } catch (err) {
    console.error('[request-link]', err);
    return res.status(500).json({ error: 'Could not send the link. Please try again.' });
  }
}
