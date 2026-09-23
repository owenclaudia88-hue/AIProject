import { readSession } from '../../lib/session.js';
import { listCustomers, listLeads, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';

/**
 * GET /api/admin/export?set=members|leads|all — the names and addresses, as a
 * CSV the browser saves.
 *
 *   members — everyone with an account
 *   leads   — everyone who gave a name and email at checkout and did not buy
 *   all     — both, with a column saying which is which
 *
 * Leads come from our own table now. They used to be read back from Stripe,
 * which could never have worked: the PaymentIntent is created when the page
 * loads, before anything is typed, so Stripe only learns an email if a card is
 * actually submitted. The people this export exists for — details in, no
 * payment — were the exact ones it left out.
 */

/** RFC-4180: quote everything, double the quotes inside. */
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const row = (cells) => cells.map(cell).join(',');

export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  if (!isAdmin(email)) return res.status(403).json({ error: 'not an admin' });

  try {
    const set = (new URL(req.url, 'http://localhost').searchParams.get('set') || 'all').toLowerCase();
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const lines = [row(['Name', 'Email', 'Type', 'Status', 'Address', 'City', 'Postcode', 'Country', 'Date'])];

    if (set === 'members' || set === 'all') {
      for (const c of await listCustomers()) {
        lines.push(row([
          displayNameFor(c.email, c.name), c.email, 'member', c.status,
          c.address || '', c.city || '', c.zip || '', c.country || '', day(c.created_at)
        ]));
      }
    }

    if (set === 'leads' || set === 'all') {
      // Only the ones who never bought — a buyer already has a row above, and
      // listing them twice makes the file useless for a mailshot.
      for (const l of (await listLeads(5000)).filter((l) => !l.purchased)) {
        lines.push(row([
          l.name || '', l.email, 'lead', 'no purchase',
          '', l.city || '', l.zip || '', l.country || '', day(l.first_seen)
        ]));
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="aifu-${set}-${stamp}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    // A leading BOM so Excel opens accented names correctly instead of as mojibake.
    return res.status(200).end('﻿' + lines.join('\r\n') + '\r\n');
  } catch (err) {
    console.error('[admin/export]', err);
    return res.status(500).json({ error: 'server' });
  }
}
