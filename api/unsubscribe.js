import { optOut } from '../lib/db.js';
import { readUnsubscribeToken } from '../lib/outreach.js';

/**
 * GET /api/unsubscribe?t=… — one click, no sign-in, no confirmation step.
 *
 * Anything that makes unsubscribing harder than subscribing was is a dark
 * pattern, so this honours the link immediately and then says so.
 */
const page = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — AI Founder University</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0b;color:#f4f4f5;
    font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:460px;background:#111113;border:1px solid #26262b;border-radius:16px;padding:32px;text-align:center}
  .brand{font-weight:800;color:#ffb020;font-size:14px;margin-bottom:18px}
  h1{font-size:20px;font-weight:600;margin:0 0 12px}
  p{color:#a1a1aa;font-size:15px;line-height:1.6;margin:0}
  a{color:#ffb020}
</style></head>
<body><div class="card">
  <div class="brand">AI Founder University</div>
  <h1>${title}</h1><p>${message}</p>
</div></body></html>`;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const token = new URL(req.url, 'http://localhost').searchParams.get('t');
    const email = readUnsubscribeToken(token);

    if (!email) {
      return res.status(400).end(page('That link didn\'t work',
        'It may have been broken by your email client. Reply to any of our emails and we\'ll take you off the list by hand.'));
    }

    await optOut(email);
    return res.status(200).end(page('You\'re unsubscribed',
      `We won't email <strong>${email.replace(/</g, '&lt;')}</strong> about finishing an order again.`));
  } catch (err) {
    console.error('[unsubscribe]', err);
    return res.status(500).end(page('Something went wrong',
      'Please reply to any of our emails and we\'ll take you off the list by hand.'));
  }
}
