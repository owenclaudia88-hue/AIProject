import Stripe from 'stripe';
import {
  grantAccess, revokeAccess, createLoginToken,
  grantEntitlement, revokeEntitlement, recordDownsellChoice, queueWelcome
} from '../lib/db.js';
import { sendPurchaseConfirmation, sendEngineWelcome, sendCarouselWelcome, sendReceipt } from '../lib/email.js';
import { sendPurchase, sendMembershipPurchase } from '../lib/meta-capi.js';
import { sendMsPurchase } from '../lib/ms-capi.js';
import { ENGINE_SOURCE, DEFAULT_SOURCE, ADDONS, parseAddons, ALL_ACCESS, COURSES, MEMBER_SOURCE }
  from '../lib/products.js';

/**
 * Which product a payment was for, from the metadata the checkout set.
 *
 * Only the Engine grants the `routines` entitlement. Buying the 70 AI
 * Specialists deliberately does NOT unlock it: the Engine is sold separately
 * and promoted on its own, so it has to stay invisible to existing members
 * until they pay for it.
 */
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

        // A course taken from the offer shown after the membership page. It is a
        // purchase, but not THAT purchase: they already have their specialists,
        // their welcome email and their trial from the $1 that came before it.
        // Everything below would send a second welcome and try to enrol them
        // again, so this grants the one thing the course needs and stops.
        //
        // Granted here rather than in the endpoint that takes the money, so the
        // one-click charge and the hosted checkout somebody is sent to when
        // their bank wants a word both end in the same place.
        if (pi.metadata?.course) {
          const course = COURSES[pi.metadata.course];
          const buyer = pi.customer
            ? (await stripe.customers.retrieve(pi.customer).catch(() => null))?.email
            : null;
          if (!course) console.error('[stripe-webhook] unknown course on', pi.id, pi.metadata.course);
          else if (!buyer) console.error('[stripe-webhook] course purchase with no email:', pi.id);
          else {
            await grantEntitlement(buyer, course.entitlement);
            console.log('[stripe-webhook] Course granted:', course.short, 'to', buyer);
            // Noted for the admin list, here rather than from the page, because
            // this is where the payment is known to have gone through.
            await recordDownsellChoice(buyer, 'bought')
              .catch((err) => console.error('[stripe-webhook] could not note the course:', err.message));
          }
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
          address: [addr.line1, addr.line2].filter(Boolean).join(', ') || undefined,
          // Which funnel won this sale, and the page the visit started on.
          // Set by the checkout endpoint from the URL, so an old intent that
          // predates it simply has none rather than a wrong one.
          source: pi.metadata?.source || DEFAULT_SOURCE,
          landingUrl: pi.metadata?.landing_url || undefined,
          // Which reminder email brought them, when one did. Set by the
          // checkout from the ?r= on the link, so this is the email they
          // actually came through rather than one that merely went out first.
          reminder: pi.metadata?.reminder || undefined
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

        // Add-ons ticked on the lifetime-access checkout, paid in this same
        // charge. The keys were written by /api/update-payment-intent, which
        // also set the amount, so what is listed here is what was paid for.
        const addons = engine ? [] : parseAddons(pi.metadata?.addons);
        for (const key of addons) {
          await grantEntitlement(email, ADDONS[key].entitlement);
          console.log('[stripe-webhook] Add-on granted:', key, email);
        }

        // Fulfilment IS the member area, and the welcome carrying the sign-in
        // link is how they get there — but not yet.
        //
        // At this moment the buyer has not seen the membership offer or the
        // course after it, so an email sent now could not say what they chose,
        // and sending one per product is what produced three near-identical
        // welcomes in the same second. It is queued instead: the confirmation
        // page sends it the moment they arrive, however long they take, and the
        // cron sweeps it if they close the tab and never get there.
        //
        // The Engine has its own funnel and its own page; a buyer who came
        // through that one is not in this flow and still gets the Engine
        // welcome directly.
        try {
          if (engine) {
            const token = await createLoginToken(email);
            const site = (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
            const loginUrl = `${site}/api/auth/verify?token=${encodeURIComponent(token)}`;
            await sendEngineWelcome(email, loginUrl, { name, existingMember: !created });
          } else {
            await queueWelcome(email);
            console.log('[stripe-webhook] Welcome queued for', email);
          }
        } catch (mailErr) {
          // Don't fail the webhook over email — access is already granted and
          // they can request a fresh link from the login page.
          console.error('[stripe-webhook] Welcome queue/send failed:', mailErr.message);
        }

        // The receipt, which Stripe used to send. Kept separate from the
        // welcome above so that a buyer who already had access — a second
        // purchase, or access granted by hand first — still gets proof of
        // payment for the money they just spent. Its own try/catch for the
        // same reason: a receipt that won't send must not cost anyone access.
        if (charge) {
          try {
            // One line per thing bought. The add-on prices are the ones the
            // intent was priced with; the Specialists line is what is left, so
            // the lines always add up to what was actually charged.
            // A bonus order (24-hour offer) includes the add-ons at no charge.
            const free = pi.metadata?.bonus === '1';
            const addonLines = addons.map((k) => ({
              label: ADDONS[k].short + (free ? ' — free bonus' : ''),
              cents: free ? 0 : ADDONS[k].priceAmount()
            }));
            const addonTotal = addonLines.reduce((s, l) => s + l.cents, 0);
            const lines = addonLines.length
              ? [{ label: '70 AI Specialists for Claude', cents: charge.amount - addonTotal }, ...addonLines]
              : undefined;
            await sendReceipt(email, {
              name,
              lines,
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

        // And Microsoft Ads, the same way: the real amount, keyed on the
        // PaymentIntent so a webhook retry is not a second sale.
        try {
          await sendMsPurchase({
            sourceUrl: `${(process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '')}/${engine ? 'checkout-engine.html' : 'checkout.html'}`,
            email,
            msclkid: pi.metadata?.msclkid || null,
            vid: pi.metadata?.vid || null,
            ip: pi.metadata?.client_ip || null,
            ua: pi.metadata?.client_ua || null
          }, { amount: pi.amount, currency: pi.currency, eventId: pi.id });
        } catch (msErr) {
          console.error('[stripe-webhook] Microsoft purchase event failed:', msErr.message);
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
              const trialDays = Math.max(0, Number.parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS ?? '3', 10) || 0);
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

            // Refunding the Engine does not stop the membership the purchase
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
            const addons = parseAddons(refundedPi?.metadata?.addons);
            const partial = charge.amount_refunded < charge.amount;

            if (addons.length && partial) {
              // Only part of a combined order was refunded — the usual reason is
              // somebody keeping the Specialists but not wanting an add-on. Work
              // out which add-ons the refunded amount covers and take back only
              // those. If it matches no combination, change nothing and say so:
              // guessing wrong would cut off something they still paid for.
              const refunded = charge.amount_refunded;
              const combos = [[]];
              for (const k of addons) for (const c of [...combos]) combos.push([...c, k]);
              const match = combos.find((c) => c.length
                && c.reduce((s, k) => s + ADDONS[k].priceAmount(), 0) === refunded);
              if (match) {
                for (const k of match) {
                  await revokeEntitlement(email, ADDONS[k].entitlement);
                  console.log('[stripe-webhook] Add-on refunded and revoked:', k, email);
                }
              } else {
                console.warn('[stripe-webhook] Partial refund of', refunded, 'on', charge.id,
                  "matches no add-on price - access left unchanged, adjust by hand if needed");
              }
            } else {
              for (const k of addons) await revokeEntitlement(email, ADDONS[k].entitlement);
              await revokeAccess(email);
              console.log('[stripe-webhook] Access revoked:', email, addons.length ? `(with add-ons: ${addons.join(', ')})` : '');
            }
          }
        }
        break;
      }

      // The membership opens every course the moment it is really paid for, and
      // closes them again when it ends. Both are keyed on the Stripe customer's
      // email, which is the only thing entitlements are stored against.
      case 'invoice.paid': {
        const invoice = event.data.object;

        // A free trial starting is not a payment, and access that costs nothing
        // to obtain is exactly what the trial was meant to withhold. An invoice
        // settled out of account credit also charges the card nothing, so the
        // test is whether value changed hands at all: money taken, or credit
        // drawn down. Both balances are negative when credit is owed, so the
        // drawdown is ending minus starting.
        const creditUsed = (invoice.ending_balance ?? 0) - (invoice.starting_balance ?? 0);
        if (!(invoice.amount_paid > 0 || creditUsed > 0)) break;

        // Stripe moved this field in a later API version, and the version a
        // webhook event arrives on is set on the endpoint rather than by the
        // constructor here. Both shapes are read, so an endpoint upgrade cannot
        // quietly stop opening courses.
        const subId = invoice.subscription
          || invoice.parent?.subscription_details?.subscription
          || null;
        if (!subId) break;

        const payerEmail = invoice.customer_email
          || (await stripe.customers.retrieve(invoice.customer).catch(() => null))?.email
          || null;
        if (!payerEmail) {
          console.error('[stripe-webhook] invoice.paid with no email:', invoice.id);
          break;
        }

        await grantEntitlement(payerEmail, ALL_ACCESS);
        console.log('[stripe-webhook] All-access granted to', payerEmail,
          '(invoice', invoice.id, invoice.billing_reason + ')');

        /* Report the sale, but only ever the first one, and only for a
           membership bought from the homepage.

           Those two gates matter more than they look. The payment_intent
           branch above deliberately refuses every invoice-backed payment so a
           renewal is never mistaken for a purchase - which is right, and which
           also means a homepage membership reached Meta as nothing at all: a
           stranger could pay $199 and the campaign that sold it would show no
           conversion. This is the only place that payment can be reported.

           `subscription_create` is what makes it the first one. A $1 buyer's
           membership can never arrive here: their subscription starts on a
           trial, so its subscription_create invoice is zero and was already
           dropped above, and the $39 that follows comes in as
           subscription_cycle. The source check is belt and braces on top of
           that - nothing in the $1 funnel carries it. */
        try {
          if (invoice.billing_reason === 'subscription_create') {
            const sub = await stripe.subscriptions.retrieve(subId).catch(() => null);
            if (sub?.metadata?.source === MEMBER_SOURCE) {
              const m = sub.metadata;
              const addr = invoice.customer_address || {};
              const parts = String(invoice.customer_name || m.name || '').trim().split(/\s+/);
              const who = {
                sourceUrl: m.landing_url
                  || `${(process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '')}/join.html`,
                email: payerEmail,
                firstName: parts[0] || null,
                lastName: parts.length > 1 ? parts[parts.length - 1] : null,
                city: addr.city || null,
                zip: addr.postal_code || null,
                country: addr.country || null,
                // Kept on the subscription when they joined, because by now the
                // browser that knew them is long gone.
                fbclid: m.fbclid || null,
                fbclidAt: Number(m.fbclid_at) || null,
                fbp: m.fbp || null,
                ip: m.client_ip || null,
                ua: m.client_ua || null
              };
              // Keyed on the invoice: a webhook retry is de-duplicated, and
              // next year's renewal has an id of its own.
              const money = { amount: invoice.amount_paid, currency: invoice.currency, eventId: invoice.id };
              await sendMembershipPurchase(who, money)
                .catch((e) => console.error('[stripe-webhook] Meta membership Purchase failed:', e.message));
              await sendMsPurchase(who, money)
                .catch((e) => console.error('[stripe-webhook] Microsoft membership Purchase failed:', e.message));
              console.log('[stripe-webhook] membership sale reported:', payerEmail, m.plan || '', invoice.id);
            }
          }
        } catch (repErr) {
          // A sale that is fulfilled must never fail because it could not be
          // counted.
          console.error('[stripe-webhook] could not report the membership sale:', repErr.message);
        }
        break;
      }

      /* A subscription that starts on a trial never produces a paid invoice,
         so nothing opened the member area for it: two people subscribed and
         could see none of the courses they had just signed up for.

         The old rule was that a trial is not a payment and should not buy
         access. That is defensible for a trial somebody might abandon, but it
         is not what this membership offers - the trial exists so they can use
         the thing - and ALL_ACCESS has always been documented as "held by
         anyone on an active or trialing membership". The code disagreed with
         its own definition.

         So the subscription's status decides, which is the fact that actually
         answers the question. Granted when it is live, taken back when it is
         not, and the payment events below still grant too, because a
         subscription that converts should not depend on this one firing. */
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const live = sub.status === 'trialing' || sub.status === 'active';
        const over = ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status);
        if (!live && !over) break;

        const who = sub.customer
          ? (await stripe.customers.retrieve(sub.customer).catch(() => null))?.email
          : null;
        if (!who) {
          console.error('[stripe-webhook] subscription', sub.status, 'with no email:', sub.id);
          break;
        }

        if (live) {
          await grantEntitlement(who, ALL_ACCESS);
          console.log('[stripe-webhook] All-access granted to', who, `(subscription ${sub.status})`);

          // Joined straight from the homepage checkout (/join.html), with no $1
          // order before it. Nothing else has made them a customer, so the
          // customers row - which is what lets them sign in - is created here,
          // and the one welcome is queued. Only on the first live event: a
          // returning buyer already has a row and already had their welcome.
          if (sub.metadata?.source === 'home-join') {
            const cust = await stripe.customers.retrieve(sub.customer).catch(() => null);
            const isNew = await grantAccess(who, {
              stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
              name: cust?.name || sub.metadata?.name || null,
              source: 'home-join',
              landingUrl: sub.metadata?.landing_url || null
            });
            if (isNew) {
              await queueWelcome(who, 5);
              console.log('[stripe-webhook] new member from the homepage:', who, sub.metadata?.plan || '');
            }
          }

          // The yearly plan replaces the monthly trial rather than joining it.
          //
          // /api/membership/upgrade-annual does this itself when it charges the
          // saved card, but it cannot when the card needs the bank and the buyer
          // finishes on Stripe's own page instead: that subscription is created
          // by Stripe, our code never runs, and without this the member would
          // pay for the year and then be charged $39 again when the trial ended.
          // Keyed on the metadata the upsell sets, so no other subscription can
          // cancel anything by arriving.
          if (sub.metadata?.source === 'post-purchase-upsell') {
            const others = await stripe.subscriptions
              .list({ customer: sub.customer, status: 'all', limit: 20 })
              .then((r) => r.data.filter((s) => s.id !== sub.id
                && (s.status === 'trialing' || s.status === 'active')))
              .catch(() => []);
            for (const o of others) {
              await stripe.subscriptions.cancel(o.id)
                .then(() => console.log('[stripe-webhook] cancelled', o.status, o.id, 'replaced by the yearly plan'))
                .catch((err) => console.error('[stripe-webhook] could not cancel', o.id, '-', err.message));
            }
          }
          break;
        }

        // Ending is handled where cancellation already is, so that the "is this
        // their last subscription" question is asked in exactly one place.
        const others = await stripe.subscriptions
          .list({ customer: sub.customer, status: 'all', limit: 20 })
          .then((r) => r.data.filter((s) => s.id !== sub.id
            && ['active', 'trialing', 'past_due'].includes(s.status)))
          .catch(() => []);
        if (!others.length) {
          await revokeEntitlement(who, ALL_ACCESS);
          console.log('[stripe-webhook] All-access revoked from', who, `(subscription ${sub.status})`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const subEmail = (await stripe.customers.retrieve(sub.customer).catch(() => null))?.email || null;
        if (!subEmail) {
          console.error('[stripe-webhook] subscription deleted with no email:', sub.id);
          break;
        }

        // Only the last live subscription closes the courses. Somebody who
        // cancels one of two is still paying, and taking their courses away
        // would be wrong.
        let others = [];
        try {
          others = await liveSubscriptions(stripe, subEmail, null);
        } catch (lookupErr) {
          // Leaving access on is the safe failure: a member wrongly kept in is
          // a support ticket, a member wrongly locked out is a refund.
          console.error('[stripe-webhook] Sub lookup failed for', subEmail,
            '- leaving all-access in place:', lookupErr.message);
          break;
        }
        if (others.some((o) => o.id !== sub.id)) {
          console.log('[stripe-webhook]', subEmail, 'still has a live subscription - keeping all-access');
          break;
        }

        await revokeEntitlement(subEmail, ALL_ACCESS);
        console.log('[stripe-webhook] All-access revoked from', subEmail, '(subscription', sub.id + ')');
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
