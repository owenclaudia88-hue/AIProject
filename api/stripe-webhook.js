import Stripe from 'stripe';
import {
  grantAccess, revokeAccess, createLoginToken,
  grantEntitlement, revokeEntitlement
} from '../lib/db.js';
import { sendPurchaseConfirmation, sendEngineWelcome, sendReceipt } from '../lib/email.js';
import { sendPurchase } from '../lib/meta-capi.js';

/**
 * Which product a payment was for, from the metadata the checkout set.
 *
 * Only the Engine grants the `routines` entitlement. Buying the 70 AI
 * Specialists deliberately does NOT unlock it: the Engine is sold separately
 * and promoted on its own, so it has to stay invisible to existing members
 * until they pay for it.
 */
const ENGINE_SOURCE = 'claude-automation-engine';
const ENGINE_ENTITLEMENT = 'routines';
const isEngine = (pi) => pi?.metadata?.source === ENGINE_SOURCE;

const LIVE_SUB = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/**
 * Is this buyer already paying for the membership?
 *
 * Every checkout creates a brand new Stripe Customer — the email is not known
 * until the form is confirmed — so an existing member buying the Engine arrives
 * as a stranger, and enrolling them again would bill them $39 a month twice.
 * The only thing tying the two together is the email address, so the lookup has
 * to go across customers rather than within one.
 *
 * Fails open on purpose. If Stripe errors here the caller carries on and
 * creates the subscription, because the previous behaviour was always to create
 * one and a broken lookup must not quietly stop the membership from starting.
 */
async function liveSubscriptions(stripe, email, exceptCustomerId) {
  const out = [];
  const customers = await stripe.customers.list({ email, limit: 100 });
  for (const c of customers.data) {
    if (c.id === exceptCustomerId) continue;
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 100 });
    for (const s of subs.data) {
      if (!LIVE_SUB.has(s.status)) continue;
      out.push({ id: s.id, status: s.status, customer: c.id, source: s.metadata?.source || null });
    }
  }
  return out;
}

/**
 * Stripe webhook receiver.
 *
 * Fulfilment belongs HERE, not on the success page. A browser redirect can be
 * closed, blocked or replayed, so it is not proof of payment — this webhook is.
 *
 * Signature verification needs the raw request body, so Vercel's body parser is
 * turned off below and the stream is read manually. If you re-enable parsing,
 * verification will fail with "No signatures found matching the expected signature".
 */

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing.');
    return res.status(500).send('Webhook is not configured.');
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Unverified payloads are rejected outright — never act on them.
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        console.log('[stripe-webhook] Payment succeeded:', pi.id, pi.amount, pi.currency);

        // Checkout asks for a full name and sends it as billing_details.name.
        // Where it lands depends on how the PaymentIntent came back: older
        // shapes carry an expanded `charges` list, newer ones only
        // `latest_charge`, so take whichever is actually here.
        let charge = pi.charges?.data?.[0]
          || (pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null);
        // On every API version since 2022-08-01 a PaymentIntent has no
        // `charges` list, and `latest_charge` arrives as a bare id rather than
        // an object — webhook payloads are never expanded. Without fetching it
        // the billing details are simply absent, which is why buyers' names
        // had to be backfilled from Stripe afterwards, and why the Purchase
        // event reached Meta without a name, city, postcode or country.
        if (!charge && typeof pi.latest_charge === 'string') {
          try { charge = await stripe.charges.retrieve(pi.latest_charge); }
          catch (chErr) { console.error('[stripe-webhook] could not fetch charge:', chErr.message); }
        }
        const name = charge?.billing_details?.name || pi.shipping?.name || undefined;

        // A PaymentIntent tied to an invoice is the monthly membership being
        // billed, not somebody buying. Everything below this line is
        // fulfilment of a purchase — the receipt, the Meta conversion, and
        // above all enrolling them in a subscription — and running any of it
        // on a renewal would be wrong: the renewal's id is not the original
        // one, so the idempotency key would not hold and each month would
        // start ANOTHER $39 subscription. Renewal receipts are sent
        // separately, from the invoice events.
        if (pi.invoice || charge?.invoice) {
          console.log('[stripe-webhook] Membership renewal, not a purchase:', pi.id);
          break;
        }

        // Checkout puts the address on the intent's metadata as well, so a
        // failed charge fetch above cannot cost someone their access.
        // receipt_email is no longer set (that is what made Stripe send its
        // own receipt) but old intents still carry it, so it stays in the chain.
        const email = pi.metadata?.buyer_email || pi.receipt_email || charge?.billing_details?.email;
        if (!email) {
          console.warn('[stripe-webhook] No email on PaymentIntent', pi.id, '- cannot grant access');
          break;
        }

        // grantAccess is an idempotent upsert, so Stripe retries are safe. It
        // also says whether the row was new, so the welcome email only goes on
        // the first successful payment for this buyer.
        // The address comes with the charge, so keep it here rather than
        // fetching it back from Stripe every time a dashboard lists members.
        const addr = charge?.billing_details?.address || {};
        const created = await grantAccess(email, {
          paymentIntent: pi.id,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : undefined,
          name,
          city: addr.city || undefined,
          zip: addr.postal_code || undefined,
          country: addr.country || undefined,
          address: [addr.line1, addr.line2].filter(Boolean).join(', ') || undefined
        });
        console.log('[stripe-webhook] Access granted:', email);

        // The Engine is a separate product, so paying for it is the only thing
        // that unlocks the routines. Granted before the emails: the welcome
        // links straight into the section, and a mail failure must not be what
        // decides whether somebody got what they paid for.
        const engine = isEngine(pi);
        if (engine) {
          await grantEntitlement(email, ENGINE_ENTITLEMENT);
          console.log('[stripe-webhook] Engine entitlement granted:', email);
        }

        // Fulfilment IS the member area: email a one-time link that signs them in.
        try {
          const token = await createLoginToken(email);
          const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
          const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;
          // An Engine buyer gets the Engine welcome even when they already had
          // an account — `created` is false for an existing member buying the
          // add-on, and sending them nothing would leave them with a charge and
          // no idea where the thing they bought went.
          if (engine) await sendEngineWelcome(email, loginUrl, { name, existingMember: !created });
          else if (created) await sendPurchaseConfirmation(email, loginUrl, { name });
        } catch (mailErr) {
          // Don't fail the webhook over email — access is already granted and
          // they can request a fresh link from the login page.
          console.error('[stripe-webhook] Welcome email failed:', mailErr.message);
        }

        // The receipt, which Stripe used to send. Kept separate from the
        // welcome above so that a buyer who already had access — a second
        // purchase, or access granted by hand first — still gets proof of
        // payment for the money they just spent. Its own try/catch for the
        // same reason: a receipt that won't send must not cost anyone access.
        if (charge) {
          try {
            await sendReceipt(email, {
              name,
              amount: charge.amount,
              currency: charge.currency,
              chargeId: charge.id,
              paidAt: charge.created * 1000,
              card: charge.payment_method_details?.card || null,
              address: charge.billing_details?.address || null
            });
          } catch (rcErr) {
            console.error('[stripe-webhook] Receipt email failed:', rcErr.message);
          }
        } else {
          console.warn('[stripe-webhook] No charge for', pi.id, '- receipt not sent');
        }

        // Tell Meta the sale happened. Server to server on purpose: this is
        // the only point that knows the money actually arrived, and it can't
        // be lost to an ad blocker or a closed tab. The event id is the
        // PaymentIntent, so a webhook retry is de-duplicated rather than
        // counted as a second sale. The buyer's IP and browser were kept on
        // the intent at checkout because here we would only see Stripe's.
        try {
          const bd = charge?.billing_details || {};
          const parts = String(name || '').trim().split(/\s+/);
          await sendPurchase({
            sourceUrl: `${(process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '')}/${engine ? 'checkout-engine.html' : 'checkout.html'}`,
            email,
            firstName: parts[0] || null,
            lastName: parts.length > 1 ? parts[parts.length - 1] : null,
            city: bd.address?.city || null,
            zip: bd.address?.postal_code || null,
            country: bd.address?.country || null,
            fbclid: pi.metadata?.fbclid || null,
            fbclidAt: Number(pi.metadata?.fbclid_at) || null,
            fbp: pi.metadata?.fbp || null,
            ip: pi.metadata?.client_ip || null,
            ua: pi.metadata?.client_ua || null
          }, { amount: pi.amount, currency: pi.currency, eventId: pi.id });
        } catch (capiErr) {
          // Never let tracking fail a sale that has already been fulfilled.
          console.error('[stripe-webhook] Meta Purchase event failed:', capiErr.message);
        }

        // The same $1 purchase also enrols the buyer in the monthly membership
        // with a free trial. The card was saved against pi.customer at
        // checkout (setup_future_usage), so the subscription can charge it once
        // the trial ends. Guarded so a site without the price configured keeps
        // its old one-off behaviour, and keyed on the PaymentIntent so a
        // webhook retry can never create a second subscription.
        const monthlyPrice = process.env.STRIPE_MONTHLY_PRICE_ID;
        const customerId = typeof pi.customer === 'string' ? pi.customer : null;
        const paymentMethod = typeof pi.payment_method === 'string' ? pi.payment_method : null;
        if (monthlyPrice && customerId && paymentMethod) {
          try {
            // Put the buyer's details on the customer and make the saved card
            // its default, so the trial-end invoice charges the right method.
            await stripe.customers.update(customerId, {
              email,
              ...(name ? { name } : {}),
              invoice_settings: { default_payment_method: paymentMethod }
            });

            // Somebody who already pays the membership must not be enrolled a
            // second time. This matters most for the Engine, which is promoted
            // by email to people who are already members, but a repeat buyer of
            // either product would hit it the same way.
            let existing = null;
            try {
              existing = (await liveSubscriptions(stripe, email, customerId))[0] || null;
            } catch (lookupErr) {
              console.error('[stripe-webhook] Subscription lookup failed for', email,
                '- enrolling anyway:', lookupErr.message);
            }

            if (existing) {
              console.log('[stripe-webhook] Already subscribed (', existing.status, existing.id,
                ') - not enrolling', email, 'again');
            } else {
              const trialDays = Math.max(0, Number.parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS ?? '7', 10) || 0);
              await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: monthlyPrice }],
                trial_period_days: trialDays,
                default_payment_method: paymentMethod,
                // If the card is declined when the trial ends, cancel rather than
                // leave the subscription dangling past due.
                trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
                metadata: {
                  source: engine ? ENGINE_SOURCE : '70-ai-specialists-for-claude',
                  payment_intent: pi.id
                }
              }, { idempotencyKey: `sub_${pi.id}` });

              console.log('[stripe-webhook] Membership subscription started for', email);
            }
          } catch (subErr) {
            // Access and fulfilment already succeeded, so don't fail the whole
            // webhook — but make the miss loud, since a buyer who was meant to
            // be enrolled was not.
            console.error('[stripe-webhook] Subscription enrol failed for', email, subErr.message);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.warn('[stripe-webhook] Payment failed:', pi.id, pi.last_payment_error?.message);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        // A charge carrying an invoice came from the monthly membership;
        // one without is the original purchase. Refunding a month's
        // membership is a billing correction and must not take away access —
        // the dashboard's refund button says exactly that, and only the
        // purchase refund is the 14-day guarantee in terms.html#refunds.
        const isMembershipCharge = !!charge.invoice;

        // Which product was refunded decides what to take back, and that only
        // lives on the PaymentIntent's metadata.
        let refundedPi = null;
        if (!isMembershipCharge && typeof charge.payment_intent === 'string') {
          try { refundedPi = await stripe.paymentIntents.retrieve(charge.payment_intent); }
          catch (piErr) { console.error('[stripe-webhook] could not fetch intent for refund:', piErr.message); }
        }
        const email = charge.billing_details?.email
          || charge.receipt_email
          || refundedPi?.metadata?.buyer_email;

        console.log('[stripe-webhook] Refunded:', charge.id, email || '(no email)',
          isMembershipCharge ? '(membership charge — access kept)'
            : isEngine(refundedPi) ? '(Engine — removing routines)' : '(purchase — revoking)');

        if (email && !isMembershipCharge) {
          if (isEngine(refundedPi)) {
            await revokeEntitlement(email, ENGINE_ENTITLEMENT);
            console.log('[stripe-webhook] Engine entitlement revoked:', email);

            // Refunding the $4.99 does not stop the membership the purchase
            // opened — the trial keeps running and charges $39 in a few days.
            // Somebody who has just been refunded and is then billed will file
            // a chargeback, and they would be right to. So the subscription
            // this product started is cancelled with the refund.
            let subs = [];
            let lookupFailed = false;
            try {
              subs = await liveSubscriptions(stripe, email, null);
            } catch (lookupErr) {
              lookupFailed = true;
              console.error('[stripe-webhook] Refund lookup failed for', email,
                '- keeping account access:', lookupErr.message);
            }

            for (const s of subs.filter((x) => x.source === ENGINE_SOURCE)) {
              try {
                await stripe.subscriptions.cancel(s.id);
                console.log('[stripe-webhook] Cancelled Engine subscription', s.id, 'for', email);
              } catch (cancelErr) {
                console.error('[stripe-webhook] Could not cancel', s.id, 'for', email, '-', cancelErr.message);
              }
            }

            // The Engine is sold to people who never bought the Specialists, so
            // a refund normally means their only purchase is gone and the whole
            // account should close — leaving it open would hand back the entire
            // library for free. The exception is somebody who also came through
            // the Specialists funnel, and the marker for that is a live
            // subscription that did not start from this product. On any doubt,
            // including a failed lookup, the account is kept: wrongly cutting
            // off a paying member is far worse than a refunded one lingering.
            const other = subs.find((s) => s.source !== ENGINE_SOURCE);
            if (lookupFailed || other) {
              console.log('[stripe-webhook] Keeping access for', email,
                lookupFailed ? '- lookup failed' : `- has a non-Engine subscription (${other.source} ${other.id})`);
            } else {
              await revokeAccess(email);
              console.log('[stripe-webhook] Access revoked:', email, '(Engine was their only purchase)');
            }
          } else {
            await revokeAccess(email);
            console.log('[stripe-webhook] Access revoked:', email);
          }
        }
        break;
      }

      default:
        // Unhandled types are fine — acknowledge so Stripe stops retrying.
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry, which is what we want if fulfilment broke.
    console.error('[stripe-webhook] Handler error:', err);
    return res.status(500).send('Webhook handler failed.');
  }
}
