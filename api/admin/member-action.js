import { readSession } from '../../lib/session.js';
import { revokeAccess, restoreAccess, grantAccess, getCustomer, createLoginToken, normalizeEmail } from '../../lib/db.js';
import { sendPurchaseConfirmation } from '../../lib/email.js';
import { isAdmin } from '../../lib/admin.js';
import { refundPayment } from '../../lib/funnel.js';

/**
 * POST /api/admin/member-action  { email, action, confirm }
 *
 *   grant    — give access to someone who paid but never got it, and send
 *              them the same welcome email the webhook would have.
 *   revoke   — take away access. Reversible from this same screen.
 *   restore  — give it back.
 *   refund   — return the money through Stripe, then revoke.
 *
 * A refund moves real money and Stripe will not undo it, so it is the one
 * action that will not run on a stray click: it needs `confirm` to be the
 * member's own address, which the dashboard makes staff type out.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const actor = readSession(req);
  if (!actor) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(actor)) return res.status(403).json({ error: 'not an admin' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = normalizeEmail(body.email || '');
    const action = String(body.action || '');
    if (!email) return res.status(400).json({ error: 'missing email' });

    // Granting is the one action that applies to someone with no row yet —
    // it exists precisely to fix a payment whose webhook never landed.
    if (action === 'grant') {
      await grantAccess(email, {
        paymentIntent: typeof body.paymentIntent === 'string' ? body.paymentIntent : undefined,
        name: typeof body.name === 'string' ? body.name : undefined
      });
      console.log(`[admin] ${actor} granted access to ${email}`);

      // Send the same welcome the webhook would have sent. Granting by hand
      // is repairing a purchase that never completed, so from the buyer's
      // side it should look exactly like it working the first time — an
      // account they cannot reach is no better than no account.
      let emailed = false, emailError = null;
      try {
        const token = await createLoginToken(email);
        const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
        await sendPurchaseConfirmation(email, `${site}/api/auth/verify?token=${encodeURIComponent(token)}`);
        emailed = true;
      } catch (mailErr) {
        // Access is already granted and that is the part that matters, so a
        // failed send is reported rather than rolled back.
        console.error('[admin/member-action] welcome email failed:', mailErr.message);
        emailError = mailErr.message;
      }

      return res.status(200).json({ ok: true, status: 'active', emailed, emailError });
    }

    const customer = await getCustomer(email);
    if (!customer) return res.status(404).json({ error: 'no such member' });

    if (action === 'revoke') {
      await revokeAccess(email);
      console.log(`[admin] ${actor} revoked ${email}`);
      return res.status(200).json({ ok: true, status: 'revoked' });
    }

    if (action === 'restore') {
      await restoreAccess(email);
      console.log(`[admin] ${actor} restored ${email}`);
      return res.status(200).json({ ok: true, status: 'active' });
    }

    if (action === 'refund') {
      // Typing the address is the deliberate step. Stripe cannot reverse a
      // refund, so this must never be one click away.
      if (normalizeEmail(body.confirm || '') !== email) {
        return res.status(400).json({ error: 'Type the member\'s email address to confirm the refund.' });
      }
      if (!customer.last_payment_intent) {
        return res.status(400).json({ error: 'No payment on file for this member — refund it in Stripe directly.' });
      }

      let refund;
      try {
        refund = await refundPayment(customer.last_payment_intent);
      } catch (err) {
        console.error('[admin/member-action] refund failed:', err.message);
        // Access is untouched when the money did not move — the two must not
        // drift apart.
        return res.status(502).json({ error: `Stripe refused the refund: ${err.message}` });
      }

      await revokeAccess(email);
      console.log(`[admin] ${actor} refunded ${email} (${refund.id}) and revoked access`);
      return res.status(200).json({ ok: true, status: 'revoked', refund });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.error('[admin/member-action]', err);
    return res.status(500).json({ error: 'server' });
  }
}
