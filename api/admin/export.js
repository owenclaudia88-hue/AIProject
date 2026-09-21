import { readSession } from '../../lib/session.js';
import { listCustomers, displayNameFor } from '../../lib/db.js';
import { isAdmin } from '../../lib/admin.js';
import { checkoutFunnel } from '../../lib/funnel.js';

/**
 * GET /api/admin/export?set=members|leads|all — the names and addresses, as a
 * CSV the browser saves.
 *
 *   members — everyone with an account
 *   leads   — everyone who entered an address at checkout and did not buy
 *   all     — both, with a column saying which is which
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
    const lines = [row(['Name', 'Email', 'Type', 'Status', 'Date'])];

    if (set === 'members' || set === 'all') {
      for (const c of await listCustomers()) {
        lines.push(row([
          displayNameFor(c.email, c.name), c.email, 'member',
          c.status, c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : ''
        ]));
      }
    }

    if (set === 'leads' || set === 'all') {
      const { people } = await checkoutFunnel({ limit: 500 });
      for (const p of people.filter((p) => !p.paid && p.email)) {
        lines.push(row([
          p.name || '', p.email, 'lead', p.status,
          p.createdAt ? p.createdAt.slice(0, 10) : ''
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
