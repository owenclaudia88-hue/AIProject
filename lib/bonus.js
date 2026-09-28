import crypto from 'node:crypto';

/**
 * The 24-hour bonus offered in the first abandoned-checkout reminder: the
 * Claude Automation Engine and Claude Carousel Studio included free with the
 * $1 Specialists.
 *
 * The offer travels in the email's checkout link as a signed token carrying
 * the address it was sent to and the moment it runs out. The checkout hands it
 * to /api/create-payment-intent, which checks the signature and the clock
 * before putting the add-ons on the order — so the deadline in the email is
 * the one the server enforces, and the link cannot be edited into a longer
 * or different offer.
 */

export const BONUS_ADDONS = ['engine', 'carousel'];
export const BONUS_HOURS = () => Math.max(1, Number.parseInt(process.env.BONUS_HOURS ?? '24', 10) || 24);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const sign = (payload) => crypto.createHmac('sha256', secret()).update('bonus:' + payload).digest('base64url');

/** A token for this address, valid until expiresAt (ms). */
export function bonusToken(email, expiresAt) {
  const payload = b64(`${String(email).trim().toLowerCase()}|${Math.round(expiresAt)}`);
  return `${payload}.${sign(payload)}`;
}

/** { email, expiresAt } for a genuine, unexpired token — otherwise null. */
export function readBonusToken(token, now = Date.now()) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  let expected;
  try { expected = sign(payload); } catch { return null; }
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let email, exp;
  try { [email, exp] = unb64(payload).split('|'); } catch { return null; }
  const expiresAt = Number(exp);
  if (!email || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { email, expiresAt };
}

/**
 * Is the bonus recorded on an order still inside its window?
 *
 * The token is checked once, when the PaymentIntent is created. After that the
 * deadline lives on the intent as `bonus_expires`, and this is what re-checks
 * it — so an order left open past the deadline goes back to the normal prices
 * instead of staying free indefinitely.
 */
export function bonusActive(expiresAt, now = Date.now()) {
  const t = Date.parse(String(expiresAt || ''));
  return Number.isFinite(t) && t > now;
}

/** "Sep 29, 13:45 UTC" — the reader's timezone is not knowable, so say which one. */
export function deadlineLabel(expiresAt) {
  const d = new Date(expiresAt);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${date}, ${time} UTC`;
}
