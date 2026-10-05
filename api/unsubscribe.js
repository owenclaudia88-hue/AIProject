import { optOut, optIn } from '../lib/db.js';
import { readUnsubscribeToken } from '../lib/outreach.js';

/**
 * /api/unsubscribe?t=…
 *
 * GET asks. POST does it.
 *
 * It used to unsubscribe on the GET, reasoning that anything slower than one
 * click is a dark pattern. The reasoning was sound and the mechanism was not:
 * a link in an email is fetched by things that are not the reader. Scanners,
 * previewers and security filters follow every URL in a message, and a GET
 * that changes something gets changed by all of them. Somebody who never
 * clicked can stop receiving email and never know.
 *
 * So the link shows a page with a button on it, which is still one click once
 * they are looking at it. The one-click header in the message is unaffected,
 * because that is a POST by specification - a mail client offering
 * "unsubscribe" in its own chrome still works in one press, and that press is
 * a person.
 *
 * The page also offers the way back, since the commonest reason somebody lands
 * here is that they did not mean to.
 */
const page = ({ title, message, action = '' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — AI Founder University</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0b;color:#f4f4f5;
    font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:480px;background:#111113;border:1px solid #26262b;border-radius:16px;padding:32px;text-align:center}
  .brand{font-weight:800;color:#ffb020;font-size:14px;margin-bottom:18px}
  h1{font-size:20px;font-weight:600;margin:0 0 12px}
  p{color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 20px}
  p:last-child{margin-bottom:0}
  button{font:inherit;font-weight:700;font-size:15px;border-radius:999px;padding:13px 26px;cursor:pointer;
    border:1px solid #33333a;background:#161619;color:#f4f4f5}
  button:hover{border-color:#ff7a1a;color:#ffb020}
  button.go{background:linear-gradient(180deg,#ffb020,#ff7a1a);color:#1a0d00;border:0}
  .small{color:#71717a;font-size:13px}
  a{color:#ffb020}
</style></head>
<body><div class="card">
  <div class="brand">AI Founder University</div>
  <h1>${title}</h1>
  <p>${message}</p>
  ${action}
</div></body></html>`;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Mail clients send this when the reader presses unsubscribe in their chrome. */
function isOneClick(req) {
  const body = typeof req.body === 'string' ? req.body : '';
  return /List-Unsubscribe=One-Click/i.test(body)
    || (req.body && req.body['List-Unsubscribe'] === 'One-Click');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('t');
    const email = readUnsubscribeToken(token);

    if (!email) {
      return res.status(400).end(page({
        title: 'That link didn\'t work',
        message: 'It may have been broken by your email client. Reply to any of our emails and '
          + 'we\'ll sort it out by hand.'
      }));
    }

    const safe = esc(email);
    const t = esc(token);

    if (req.method === 'POST') {
      // A mail client's one-click press carries no form, so it gets no page.
      if (url.searchParams.get('resubscribe') === '1') {
        await optIn(email);
        return res.status(200).end(page({
          title: 'You\'re back on the list',
          message: `We'll keep emailing <strong>${safe}</strong>.`,
          action: '<p class="small">Nothing else to do.</p>'
        }));
      }

      await optOut(email);
      if (isOneClick(req)) return res.status(200).end('');

      return res.status(200).end(page({
        title: 'You\'re unsubscribed',
        message: `We won't email <strong>${safe}</strong> again.`,
        action: `<form method="post" action="/api/unsubscribe?t=${t}&resubscribe=1">
                   <button type="submit">Actually, put me back on</button>
                 </form>
                 <p class="small" style="margin-top:16px">Changed your mind by accident? That button undoes it.</p>`
      }));
    }

    // GET: ask, and change nothing. Link scanners stop here.
    return res.status(200).end(page({
      title: 'Unsubscribe from our emails?',
      message: `This takes <strong>${safe}</strong> off the list. You'll stop getting the weekly AI `
        + 'report and anything else we send.',
      action: `<form method="post" action="/api/unsubscribe?t=${t}">
                 <button class="go" type="submit">Unsubscribe me</button>
               </form>
               <p class="small" style="margin-top:16px">Nothing has changed yet.</p>`
    }));
  } catch (err) {
    console.error('[unsubscribe]', err);
    return res.status(500).end(page({
      title: 'Something went wrong',
      message: 'Please reply to any of our emails and we\'ll sort it out by hand.'
    }));
  }
}
