/**
 * Who chose a recurring plan for themselves.
 *
 * The payment reminders go to these people and to nobody else. It is a
 * narrower question than "has a subscription that is failing", because a
 * subscription can arrive without anybody deciding anything: every Specialists
 * buyer is enrolled on a three-day trial by the webhook whether they wanted
 * one or not.
 *
 * Four ways somebody ends up here, and three of them are written on the
 * subscription itself, which is what the failing invoice hands us:
 *
 *   home-join            bought the membership from the homepage
 *   members-join         came back through the lock screens and subscribed again
 *   post-purchase-upsell took the twelve months on the offer after checkout
 *
 * The fourth cannot be read from the subscription at all. Keeping the $39
 * trial produces a subscription whose metadata says `70-ai-specialists-for-
 * claude`, and so does declining it, because the same webhook created both
 * before the member chose anything. Only the customer row knows which happened,
 * in upsell_choice: 'trial' kept it, 'declined' did not.
 *
 * Anything else — a legacy subscriber, a membership granted by hand, a plan
 * that arrived some other way — is deliberately out. Nothing is sent to them.
 */
export const CHOSEN_SUB_SOURCES = new Set([
  'home-join',
  'members-join',
  'post-purchase-upsell'
]);

/** Upsell-page answers that mean the member kept a plan rather than refused it. */
export const KEPT_A_PLAN = new Set(['trial', 'year']);

/**
 * @param {object} subscription  the Stripe subscription the invoice belongs to
 * @param {object} customer      our own customers row
 */
export function chosePlanThemselves(subscription, customer) {
  const source = subscription?.metadata?.source || '';

  /* A deliberate subscription, named on the subscription itself. This is
     checked before anything about the upsell, and that order is the whole of
     how 'declined' is handled.

     Declining the upsell never qualifies anybody — it is not in KEPT_A_PLAN,
     so on its own it is silence. But somebody who declined in March and then
     came back through the lock screens in October has made a second, plainly
     deliberate decision, and the subscription they started says so. Letting
     the old 'declined' veto that would cut off exactly the members we were
     asked to include. A refusal is an answer about the offer they were shown,
     not a standing instruction about everything afterwards. */
  if (CHOSEN_SUB_SOURCES.has(source)) return true;

  /* The auto-enrolled trial. The subscription looks identical whether they
     kept it or killed it — same price, same metadata, created by the same
     webhook before the member chose anything — so the answer lives on the
     customer. 'declined' is absent from KEPT_A_PLAN on purpose: without that,
     every Specialists buyer who turned the trial down would be written to the
     first time a card of theirs failed. */
  if (KEPT_A_PLAN.has(customer?.upsell_choice)) return true;

  /* Belt and braces for a homepage buyer whose subscription lost its metadata
     — the customers row carries the same fact. Nobody reaches the upsell this
     way, so there is no refusal to weigh against it. */
  return customer?.source === 'home-join';
}
