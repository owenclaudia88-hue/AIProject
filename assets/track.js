/*
 * Meta tracking, the browser's half.
 *
 * Nothing is loaded from Meta here — no pixel script, no third-party request.
 * The page only remembers the ad click that brought the visitor and tells our
 * own server about it; the server sends the event to Meta. That is why an ad
 * blocker cannot drop these events, and why the click id has to be stashed:
 * it arrives on the landing URL but is needed much later, at checkout.
 */
(function () {
  var KEY = 'aifu_fbclid';
  var KEY_AT = 'aifu_fbclid_at';
  var KEY_FBP = 'aifu_fbp';
  var WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

  function urlParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; } catch (e) { return ''; }
  }

  /*
   * The ad click, remembered.
   *
   * This lives in localStorage, not sessionStorage. sessionStorage dies with
   * the tab, and hardly anybody buys in the tab they first arrived in — they
   * read, close it, think about it, and come back later. Every one of those
   * people used to reach the checkout with no click id at all, which is why
   * Meta could not attribute them and reported nothing for the ads that
   * brought them.
   *
   * The time of the click is kept with it, because that is what belongs in the
   * fbc value Meta wants — not the time we happen to send the event.
   */
  function stash() {
    var fromUrl = urlParam('fbclid');
    var now = Date.now();
    try {
      if (fromUrl) {
        window.localStorage.setItem(KEY, fromUrl);
        window.localStorage.setItem(KEY_AT, String(now));
        return { id: fromUrl, at: now };
      }
      var id = window.localStorage.getItem(KEY) || '';
      var at = Number(window.localStorage.getItem(KEY_AT) || 0);
      // Past Meta's attribution window it is noise, and claiming an old click
      // for a fresh visit would misattribute the sale.
      if (id && at && now - at > WINDOW_MS) {
        window.localStorage.removeItem(KEY);
        window.localStorage.removeItem(KEY_AT);
        return { id: '', at: 0 };
      }
      return { id: id, at: at || now };
    } catch (e) {
      // Private mode can refuse storage; this page still gets attributed.
      return { id: fromUrl, at: now };
    }
  }

  function cookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[2]) : '';
    } catch (e) { return ''; }
  }

  /*
   * A browser id for Meta to match on.
   *
   * Normally Meta's pixel script sets a _fbp cookie and the Conversions API
   * matches against it. We deliberately load no pixel, so that cookie never
   * existed and every event went to Meta without one — it asks for this
   * explicitly in Events Manager. So we mint it ourselves, in the same format
   * the pixel uses, and keep it: it is a first-party random id, nothing is
   * read from it, and it gives Meta a stable thread between a visit and the
   * purchase that follows days later.
   */
  function browserId() {
    var existing = cookie('_fbp');
    try {
      if (!existing) existing = window.localStorage.getItem(KEY_FBP) || '';
      if (!existing) {
        existing = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10);
        window.localStorage.setItem(KEY_FBP, existing);
      }
    } catch (e) {
      if (!existing) existing = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10);
    }
    try {
      // Mirrored into the cookie the pixel would have written, so that adding
      // a real pixel later finds the same value rather than a second identity.
      document.cookie = '_fbp=' + existing + ';path=/;max-age=7776000;SameSite=Lax';
    } catch (e) { /* cookie refused — the value still travels in the payload */ }
    return existing;
  }

  var click = stash();
  var fbclid = click.id;
  var fbp = browserId();

  /*
   * Who is visiting, without knowing who is visiting.
   *
   * `visitor` is a random id kept in localStorage so a returning reader counts
   * once rather than every time, and `session` is kept in sessionStorage so a
   * single sitting can be told apart from the next one. Neither is derived
   * from anything about the person — no IP, no fingerprint — so the pair says
   * "same browser as before" and nothing else.
   *
   * Storage can be refused outright in private mode, so both fall back to a
   * per-page id. That inflates the visitor count slightly rather than losing
   * the view entirely, which is the right way round.
   */
  function rid() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function durable(store, key) {
    try {
      var v = window[store].getItem(key);
      if (!v) { v = rid(); window[store].setItem(key, v); }
      return v;
    } catch (e) { return rid(); }
  }

  var visitor = durable('localStorage', 'aifu_vid');
  var session = durable('sessionStorage', 'aifu_sid');

  // Anything the page already knows about the visitor improves the match.
  window.aifuTrack = function (event, extra) {
    var payload = extra || {};
    payload.event = event;
    payload.fbclid = fbclid || undefined;
    payload.fbclidAt = fbclid ? click.at : undefined;
    payload.fbp = fbp || undefined;
    payload.sourceUrl = window.location.href;
    payload.visitor = visitor;
    payload.session = session;
    payload.referrer = document.referrer || undefined;
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // so the event still goes if this fires as the page is unloading
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* tracking must never break the page */ }
  };

  // The click id, for the checkout to attach to the payment. The purchase is
  // reported hours or days later by the Stripe webhook, long after this page
  // is gone, so these have to ride along with the PaymentIntent.
  window.aifuFbclid = function () { return fbclid; };
  window.aifuFbclidAt = function () { return fbclid ? click.at : 0; };
  window.aifuFbp = function () { return fbp; };

  window.aifuTrack('PageView');
})();
