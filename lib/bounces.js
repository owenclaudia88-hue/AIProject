import { knownBounceIds, recordBounce } from './db.js';

/**
 * Pull hard bounces back out of Resend and file them.
 *
 * Polled rather than webhooked on purpose. A webhook would need a public
 * endpoint, a signing secret and somewhere to put failures; this runs inside
 * the job that was going to send the next email anyway, so a bounce is always
 * known before the follow-up that would repeat it. The sequence's shortest gap
 * is hours and this runs every fifteen minutes, which is margin enough.
 *
 * Only permanent bounces suppress. A full mailbox or a server having a bad
 * afternoon is temporary and worth retrying; "mailbox not found" will still be
 * true next week.
 *
 * Never throws. A reminder failing to send because the bounce list could not
 * be refreshed would be a worse outcome than the bounce itself.
 */
export async function syncBounces({ limit = 100 } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: 'RESEND_API_KEY not set' };

  const headers = { Authorization: `Bearer ${key}` };
  const get = async (path) => {
    const res = await fetch(`https://api.resend.com${path}`, { headers });
    if (!res.ok) throw new Error(`Resend ${path} -> ${res.status}`);
    return res.json();
  };

  try {
    const list = await get(`/emails?limit=${Math.min(100, limit)}`);
    const bounced = (list?.data || []).filter((e) => e.last_event === 'bounced');
    if (!bounced.length) return { checked: (list?.data || []).length, bounced: 0, filed: 0 };

    // Only the ones we have not already looked at: the detail call is one
    // request each, and the same bounce would otherwise be fetched every run
    // for as long as it stays in the recent list.
    const known = await knownBounceIds();
    const fresh = bounced.filter((e) => !known.has(e.id));

    let filed = 0;
    for (const e of fresh) {
      try {
        const full = await get(`/emails/${e.id}`);
        const b = full?.bounce || {};
        const to = Array.isArray(full?.to) ? full.to[0] : full?.to;
        if (!to) continue;
        await recordBounce(to, {
          // Absent a type, assume the worst: an address we cannot classify is
          // safer suppressed than repeatedly mailed.
          kind: b.type || 'Permanent',
          subtype: b.subType || null,
          reason: (b.diagnosticCode && b.diagnosticCode[0]) || b.message || null,
          emailId: e.id
        });
        filed++;
      } catch (err) {
        console.error('[bounces] could not read', e.id, err.message);
      }
    }
    return { checked: (list?.data || []).length, bounced: bounced.length, filed };
  } catch (err) {
    console.error('[bounces] sync failed:', err.message);
    return { error: err.message };
  }
}
