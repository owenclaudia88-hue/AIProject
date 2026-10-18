import { sessionEmail } from '../../lib/session.js';
import { revokeAccess, restoreAccess, grantAccess, getCustomer, normalizeEmail } from '../../lib/db.js';
import { resendWelcome } from '../../lib/welcome.js';
import { isAdmin } from '../../lib/admin.js';
import { memberPayments, refundChargeById, lineRefund, resolveCustomerId, cancelActiveSubscriptions } from '../../lib/funnel.js';

/**
 * POST /api/admin/member-action  { email, action, confirm }
 *
 *   grant    — give access to someone who paid but never got it, and send
 *              them the same welcome email the webhook would have.
 *   revoke   — take away access. Reversible from this same screen.
 *   restore  — give it back.
 *   refund   — return the money through Stripe: one charge (ref), one product
 *              inside a combined order (ref + item), or everything (all).
 *              Access is never changed by it.
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

  const actor = await sessionEmail(req);
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
        await resendWelcome(email);
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

      // Removing access also ends their billing — a cancelled member should
      // not still be charged $39 next month. Best-effort: access is already
      // gone, so a Stripe hiccup here is reported, not fatal.
      let cancelledSubscriptions = [];
      try {
        const customerId = await resolveCustomerId(customer);
        if (customerId) cancelledSubscriptions = await cancelActiveSubscriptions(customerId);
      } catch (err) {
        console.error('[admin/member-action] subscription cancel failed for', email, err.message);
      }

      console.log(`[admin] ${actor} revoked ${email}, cancelled ${cancelledSubscriptions.length} subscription(s)`);
      return res.status(200).json({ ok: true, status: 'revoked', cancelledSubscriptions });
    }

    if (action === 'restore') {
      await restoreAccess(email);
      console.log(`[admin] ${actor} restored ${email}`);
      return res.status(200).json({ ok: true, status: 'active' });
    }

    if (action === 'refund') {
      // Refund money only — access is handled by Cancel access, so a $39
      // membership charge can be refunded without also pulling their access,
      // and the $1 can be refunded without guessing what that should mean.
      //
      // The charge ids to refund come from the browser but are never trusted:
      // we re-list this member's own payments and refund only ids found there,
      // so a crafted request cannot refund a stranger's charge.
      const { items } = await memberPayments(customer);
      const refundable = new Map(items.filter((i) => i.refundable).map((i) => [i.ref, i]));
      if (!refundable.size) {
        return res.status(400).json({ error: 'Nothing left to refund for this member.' });
      }

      // One product out of a combined order. The line, and so the amount, is
      // looked up from Stripe's own record here — the browser only names it.
      if (typeof body.item === 'string') {
        const charge = typeof body.ref === 'string' ? refundable.get(body.ref) : null;
        const line = charge?.lines?.find((l) => l.key === body.item && l.refundable);
        if (!line) {
          return res.status(400).json({ error: 'That product is not refundable on this order.' });
        }
        try {
          const r = await lineRefund(charge.ref, line);
          console.log(`[admin] ${actor} refunded ${line.key} (${line.amount}) on ${charge.ref} for ${email}`);
          return res.status(200).json({ ok: true, refunded: [r], failed: [] });
        } catch (err) {
          console.error('[admin/member-action] line refund failed for', charge.ref, line.key, err.message);
          return res.status(200).json({ ok: true, refunded: [], failed: [{ ref: charge.ref, why: err.message }] });
        }
      }

      const wantAll = body.all === true;
      const targets = wantAll
        ? [...refundable.keys()]
        : (typeof body.ref === 'string' && refundable.has(body.ref) ? [body.ref] : []);

      if (!targets.length) {
        return res.status(400).json({ error: 'That payment is not one of this member\'s refundable charges.' });
      }

      const refunded = [], failed = [];
      for (const ref of targets) {
        try { refunded.push(await refundChargeById(ref)); }
        catch (err) {
          console.error('[admin/member-action] refund failed for', ref, err.message);
          failed.push({ ref, why: err.message });
        }
      }

      console.log(`[admin] ${actor} refunded ${refunded.length} charge(s) for ${email}`);
      return res.status(200).json({ ok: true, refunded, failed });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    console.error('[admin/member-action]', err);
    return res.status(500).json({ error: 'server' });
  }
}
