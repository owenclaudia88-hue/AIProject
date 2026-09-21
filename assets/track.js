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

  // Anything the page already knows about the visitor improves the match.
  window.aifuTrack = function (event, extra) {
    var payload = extra || {};
    payload.event = event;
    payload.fbclid = fbclid || undefined;
    payload.fbp = cookie('_fbp') || undefined;
    payload.sourceUrl = window.location.href;
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
