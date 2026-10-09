/**
 * GET /api/stripe-key — the publishable key, for pages that need Stripe.js
 * before they have an order to confirm (the membership checkout builds its
 * payment form first and creates the subscription only when they pay).
 *
 * The publishable key is public by design; this only saves keeping a copy of
 * it in page source.
 */
export default function handler(req, res) {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return res.status(500).json({ error: 'Payments are not configured yet.' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ publishableKey });
}
