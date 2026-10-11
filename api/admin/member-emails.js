import { sessionEmail } from '../../lib/session.js';
import {
  getCustomer, normalizeEmail, emailsForCustomer,
  addCustomerEmail, removeCustomerEmail, createLoginToken
} from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { sendPurchaseConfirmation } from '../../lib/email.js';

/**
 * The other addresses that reach a member, and the welcome resent to one.
 *
 *   GET  /api/admin/member-emails?email=…        what is on the account
 *   POST /api/admin/member-emails  { email, action, alternate }
 *        add     — another way in
 *        remove  — take one away
 *        welcome — send the welcome, with a working sign-in link, to one
 *                  of the addresses on the account
 *
 * This exists because some company mail servers refuse everything we send. A
 * buyer pays, never sees the welcome, and cannot ask for a sign-in link either
 * - because that link goes to the same blocked inbox. Support adds an address
 * they can actually read and sends the welcome there.
 *
 * It is a second door, not a second account. The token is minted for the
 * customers row every time, so the session, the entitlements and everything
 * keyed on the member stay exactly as they were. Adding an address that
 * already holds an account of its own is refused rather than silently merging
 * two people together.
 */
export default async function handler(req, res) {
  const actor = await sessionEmail(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
    const email = normalizeEmail(
      req.method === 'GET' ? url.searchParams.get('email') || '' : body.email || ''
    );
    if (!email) return res.status(400).json({ error: 'missing email' });

    const customer = await getCustomer(email);
    if (!customer) return res.status(404).json({ error: 'no such member' });

    if (req.method === 'GET') return res.status(200).json(await describe(customer));

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method not allowed' });
    }

    const action = String(body.action || '');
    const alternate = normalizeEmail(body.alternate || '');

    if (action === 'add') {
      const out = await addCustomerEmail(email, alternate, actor);
      if (out.error) return res.status(400).json({ error: out.error });
      console.log(`[admin] ${actor} added ${alternate} as a way into ${email}`);

      /* Sent here only if asked for. Adding an address and telling the member
         about it are two different decisions: an address noted from a support
         thread may not want an email at all, while one added because nothing
         reaches them usually does.

         Best effort, and reported either way. The address is added whatever
         happens to the send - which matters most when the send fails, because
         a bouncing address is exactly what this is for. */
      let welcomed = null;
      if (body.welcome === true) {
        try {
          const token = await createLoginToken(email);
          const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
          await sendPurchaseConfirmation(alternate,
            `${site}/api/auth/verify?token=${encodeURIComponent(token)}`,
            { name: customer.name || undefined });
          welcomed = { sent: true, to: alternate };
          console.log(`[admin] ${actor} sent the welcome for ${email} to ${alternate} on adding it`);
        } catch (err) {
          console.error('[admin/member-emails] welcome on add to', alternate, 'failed:', err.message);
          welcomed = { sent: false, to: alternate, error: err.message };
        }
      }

      return res.status(200).json({
        ok: true, already: !!out.already, welcomed, ...(await describe(customer))
      });
    }

    if (action === 'remove') {
      await removeCustomerEmail(email, alternate);
      console.log(`[admin] ${actor} removed ${alternate} from ${email}`);
      return res.status(200).json({ ok: true, ...(await describe(customer)) });
    }

    if (action === 'welcome') {
      /* Only to an address already on the account. Sending to anything typed
         into the box would make this a way to mail a working sign-in link for
         somebody else's account to any address at all. */
      const allowed = new Set([
        email, ...(await emailsForCustomer(email)).map((r) => r.email)
      ]);
      const to = alternate || email;
      if (!allowed.has(to)) {
        return res.status(400).json({ error: 'Add that address to the account first, then send to it.' });
      }

      // Minted for the account, read in whichever inbox actually works.
      const token = await createLoginToken(email);
      const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
      try {
        await sendPurchaseConfirmation(to, `${site}/api/auth/verify?token=${encodeURIComponent(token)}`,
          { name: customer.name || undefined });
      } catch (err) {
        // The usual reason for being here is that mail to this member fails.
        // Say which address and why, rather than "it did not work".
        console.error('[admin/member-emails] welcome to', to, 'failed:', err.message);
        return res.status(502).json({ error: `Could not send to ${to}: ${err.message}` });
      }
      console.log(`[admin] ${actor} sent the welcome for ${email} to ${to}`);
      return res.status(200).json({ ok: true, sentTo: to, ...(await describe(customer)) });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.error('[admin/member-emails]', err);
    return res.status(500).json({ error: 'server' });
  }
}

async function describe(customer) {
  const others = await emailsForCustomer(customer.email);
  return {
    email: customer.email,
    name: customer.name || null,
    status: customer.status,
    alternates: others.map((r) => ({
      email: r.email, addedBy: r.added_by || null, addedAt: r.added_at
    }))
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
