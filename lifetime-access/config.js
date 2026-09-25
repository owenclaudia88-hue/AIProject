/* ============================================================
   Display settings for the lifetime-access landing page, its
   checkout and its thank-you page.

   Deliberately holds nothing that matters. The Stripe publishable key
   now comes back from /api/create-payment-intent with the client secret,
   so there is no key to keep in sync here, and the Meta pixel that used
   to live in this file is gone — this site reports conversions from the
   server through /api/track and the Stripe webhook, never from the
   browser, so an ad blocker cannot lose a sale.
   ============================================================ */
window.LP = {
  // Where buyers go for the product after paying.
  accessUrl: "https://aifounderuniversity.com/members/",

  // Display only. The real amount is set server-side in
  // api/create-payment-intent.js and cannot be changed from the browser.
  priceLabel: "$1",
  productName: "70 AI Specialists for Claude",
  supportEmail: "support@aifounderuniversity.com"
};
