/**
 * GET /api/version — what is actually running here.
 *
 * Twice now a report has gone out built by the previous deployment, and both
 * times the only way to find out was to read the output and infer it: an old
 * subject line, a cover with no words on it. Once the push itself had reached
 * GitHub and Vercel had simply never built it, which no amount of looking at
 * the report would have revealed.
 *
 * So the deployment says which commit it is. The sha is already public on the
 * repository it came from and names nothing about the code; what it buys is
 * the difference between "the change did not work" and "the change is not
 * there", which are not close to the same problem.
 */
export default function handler(req, res) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    commit: sha ? sha.slice(0, 7) : 'unknown',
    message: (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').split('\n')[0].slice(0, 120) || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    env: process.env.VERCEL_ENV || 'local',
    now: new Date().toISOString()
  });
}
