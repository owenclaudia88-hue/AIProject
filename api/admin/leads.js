import { readSession } from '../../lib/session.js';
import { isAdmin } from '../../lib/admin.js';
import { listLeads, listCustomers, displayNameFor, checkoutCounts } from '../../lib/db.js';

/**
 * GET /api/admin/leads — who gave their details, who paid, and how many got
 * part of the way.
 *
 * All of it comes from our own tables. The previous version of this read the
 * funnel back from Stripe, which structurally could not see the people who
 * matter most: the PaymentIntent is created when the checkout page loads,
 * before a single field is typed, so Stripe never learns an email unless a
 * card is actually submitted. Somebody who filled in their name and left
 * existed nowhere.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    const [leads, customers, counts] = await Promise.all([
      listLeads(1000), listCustomers(), checkoutCounts()
    ]);

    const buyers = customers.map((c) => ({
      email: c.email,
      name: displayNameFor(c.email, c.name),
      status: c.status,
      city: c.city || null,
      zip: c.zip || null,
      country: c.country || null,
      address: c.address || null,
      joinedAt: c.created_at
    }));

    const rows = leads.map((l) => ({
      email: l.email,
      name: l.name || '',
      city: l.city || null,
      zip: l.zip || null,
      country: l.country || null,
      source: l.source || null,
      purchased: l.purchased === true,
      memberStatus: l.member_status || null,
      firstSeen: l.first_seen,
      lastSeen: l.last_seen
    }));

    const gaveDetails = rows.length;
    const gaveDetailsBought = rows.filter((r) => r.purchased).length;

    return res.status(200).json({
      counts: {
        // Everyone who opened the checkout page at all.
        reachedCheckout: counts.reachedCheckout,
        // ...of whom this many got as far as handing over a name and email.
        gaveDetails,
        // ...and this many went through with it.
        purchased: buyers.filter((b) => b.status === 'active').length,
        // The gap worth acting on: known people, no money.
        gaveDetailsNoPurchase: gaveDetails - gaveDetailsBought,
        // Opened the checkout and never even typed a name.
        leftBeforeDetails: Math.max(0, counts.reachedCheckout - gaveDetails),
        detailsRate: counts.reachedCheckout
          ? Math.round((gaveDetails / counts.reachedCheckout) * 1000) / 10 : 0,
        // Of the people we know by name, how many bought.
        detailsToPurchase: gaveDetails
          ? Math.round((gaveDetailsBought / gaveDetails) * 1000) / 10 : 0
      },
      leads: rows,
      buyers,
      // Traffic has only been recorded since this shipped, so the checkout
      // figure covers a shorter period than the leads do. Saying so beats a
      // ratio that quietly compares two different windows.
      trackingSince: counts.trackingSince
    });
  } catch (err) {
    console.error('[admin/leads]', err);
    return res.status(500).json({ error: 'server' });
  }
}
