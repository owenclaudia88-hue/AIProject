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
  var KEY = 'fbclid';

  function stash() {
    try {
      var fromUrl = new URLSearchParams(window.location.search).get('fbclid') || '';
      if (fromUrl) window.sessionStorage.setItem(KEY, fromUrl);
      return fromUrl || window.sessionStorage.getItem(KEY) || '';
    } catch (e) {
      // Private mode can refuse sessionStorage; fall back to this page only.
      try { return new URLSearchParams(window.location.search).get('fbclid') || ''; } catch (e2) { return ''; }
    }
  }

  function cookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[2]) : '';
    } catch (e) { return ''; }
  }

  var fbclid = stash();

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
    payload.fbp = cookie('_fbp') || undefined;
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

  // The click id, for the checkout to attach to the payment.
  window.aifuFbclid = function () { return fbclid; };
  window.aifuFbp = function () { return cookie('_fbp'); };

  window.aifuTrack('PageView');
})();
