/**
 * The save offer, read from Stripe rather than written into a template.
 *
 * The email promises a discount in words. The only way those words cannot
 * drift from what a member actually gets is for both to come from the same
 * place, so the coupon is fetched, the way it will be applied is decided here,
 * and the sentence in the email is generated from the two together. Change the
 * coupon in the Stripe dashboard and the email changes with it. Misconfigure it
 * and no offer is made at all, which is the right failure: a promise we cannot
 * keep is worse than no promise.
 *
 * The two plans are not the same offer with different numbers. They differ in
 * where the discount is applied, because "a few months off" is only a saving to
 * somebody who is billed monthly:
 *
 *   monthly   the invoice that is failing, and the subscription
 *             → the unpaid month at half price, then the coupon's own months
 *   annual    the invoice that is failing, and nothing else
 *             → this year discounted, next year back to the normal price
 *
 * That is why the annual coupon never touches the subscription. A `once`
 * coupon applied to a yearly subscription would discount the *next* invoice —
 * a year away — and leave the one that is actually failing at full price,
 * which is the opposite of the offer.
 *
 *   STRIPE_OFFER_COUPON_MONTHLY   50% off, repeating, 2 months
 *                                 → "50% off this month and the next two"
 *   STRIPE_OFFER_COUPON_ANNUAL    30% off, once
 *                                 → "30% off this year's membership"
 *
 * An interval with no coupon configured gets no offer in its email at all.
 */
const WORD = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve'];

/* How each plan's discount is placed. `onSubscription` is what carries it past
   the failing invoice into future ones; without it the discount is a one-off
   on the bill in front of them. */
const PLAN_OFFER = {
  month: { env: 'STRIPE_OFFER_COUPON_MONTHLY', onSubscription: true },
  year: { env: 'STRIPE_OFFER_COUPON_ANNUAL', onSubscription: false }
};

const planFor = (interval) => PLAN_OFFER[interval === 'year' ? 'year' : 'month'];

export function couponIdFor(interval) {
  return (process.env[planFor(interval).env] || '').trim() || null;
}

/**
 * The whole offer in a sentence — not the coupon alone, but the coupon as it
 * will actually be applied.
 *
 * For a monthly plan that is the failing invoice plus the coupon's own months,
 * so a two-month coupon is three discounted months and the sentence says so. A
 * sentence built from `duration_in_months` by itself would undercount the offer
 * by exactly the month the member is being chased about.
 */
export function describeOffer(coupon, interval = 'month') {
  if (!coupon || coupon.valid === false) return null;

  const amount = coupon.percent_off
    ? `${Number(coupon.percent_off) % 1 === 0 ? coupon.percent_off : Number(coupon.percent_off).toFixed(1)}% off`
    : coupon.amount_off
      ? `${new Intl.NumberFormat('en-US', {
          style: 'currency', currency: String(coupon.currency || 'usd').toUpperCase()
        }).format(coupon.amount_off / 100)} off`
      : null;
  if (!amount) return null;

  // Annual: one invoice, the one being chased. Nothing carries forward.
  if (interval === 'year') {
    if (coupon.duration === 'forever') return `${amount}, for as long as you stay`;
    return `${amount} this year's membership`;
  }

  if (coupon.duration === 'forever') return `${amount}, for as long as you stay`;
  // A `once` coupon still reaches the failing invoice, because that is where
  // it is applied — it simply does not carry into next month.
  if (coupon.duration === 'once') return `${amount} the payment that is failing`;

  const extra = Number(coupon.duration_in_months) || 0;
  if (!extra) return null;
  return `${amount} this month and the next ${extra === 1 ? 'one' : WORD[extra] || extra}`;
}

/** Kept for the plain "what is this coupon" case; the offer sentence is above. */
export const describeCoupon = describeOffer;

/**
 * The offer for a subscription, or null when there is none to make.
 *
 * Returns the coupon, the words, and where to put it, so the caller applies the
 * very thing it just described rather than looking it up again and hoping.
 */
export async function offerForSubscription(stripe, subscription) {
  const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval || 'month';
  const id = couponIdFor(interval);
  if (!id) return null;

  let coupon;
  try {
    coupon = await stripe.coupons.retrieve(id);
  } catch (err) {
    console.error('[offer] coupon', id, 'could not be read:', err?.message || err);
    return null;
  }

  const label = describeOffer(coupon, interval);
  if (!label) {
    console.error('[offer] coupon', id, 'is not something we can describe — no offer made');
    return null;
  }
  return { coupon, label, interval, onSubscription: planFor(interval).onSubscription };
}
