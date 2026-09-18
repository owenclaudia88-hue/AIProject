/**
 * Local dev server.
 *
 * Serves the static pages and runs the functions in /api the way Vercel does,
 * so the Stripe flow can be exercised without deploying.
 *
 *   node --env-file=.env.local scripts/dev-server.mjs
 *   → http://localhost:3000/checkout.html
 *
 * Not used in production — Vercel runs /api itself.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

/** Adds the Express-ish helpers Vercel's runtime gives handlers. */
function decorate(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => { res.end(body); return res; };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function handleApi(req, res, route) {
  const modPath = join(ROOT, 'api', `${route}.js`);
  try {
    await stat(modPath);
  } catch {
    return res.status(404).json({ error: `No such function: /api/${route}` });
  }

  const mod = await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
  const handler = mod.default;
  const bodyParser = mod.config?.api?.bodyParser !== false;

  if (bodyParser) {
    // Vercel parses JSON bodies before the handler sees them.
    const raw = await readBody(req);
    const type = req.headers['content-type'] ?? '';
    if (type.includes('application/json') && raw.length) {
      try { req.body = JSON.parse(raw.toString('utf8')); }
      catch { req.body = {}; }
    } else {
      req.body = raw.toString('utf8');
    }
  }
  // When bodyParser is false the handler reads the stream itself, so leave it alone.

  return handler(req, decorate(res));
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  // keep requests inside the project directory
  const full = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(ROOT)) return res.status(403).send('Forbidden');

  try {
    const data = await readFile(full);
    res.setHeader('Content-Type', MIME[extname(full)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(data);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>404</h1>');
  }
}

createServer(async (req, res) => {
  decorate(res);
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname.slice('/api/'.length));
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[dev-server]', err);
    if (!res.headersSent) res.status(500).json({ error: String(err && err.message) });
  }
}).listen(PORT, () => {
  const keys = process.env.STRIPE_SECRET_KEY ? 'loaded' : 'MISSING (use --env-file=.env.local)';
  console.log(`dev-server  http://localhost:${PORT}   stripe keys: ${keys}`);
});
