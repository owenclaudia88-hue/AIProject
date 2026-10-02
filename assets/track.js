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
   * The Microsoft Ads click, remembered the same way — Bing appends msclkid to
   * the landing URL, and the purchase is reported by the webhook much later.
   * Microsoft suggests keeping it for 90 days.
   */
  var msclkid = (function () {
    var fromUrl = urlParam('msclkid');
    var now = Date.now(), MS_WINDOW = 90 * 24 * 60 * 60 * 1000;
    try {
      if (fromUrl) {
        window.localStorage.setItem('aifu_msclkid', fromUrl);
        window.localStorage.setItem('aifu_msclkid_at', String(now));
        return fromUrl;
      }
      var id = window.localStorage.getItem('aifu_msclkid') || '';
      var at = Number(window.localStorage.getItem('aifu_msclkid_at') || 0);
      if (id && at && now - at > MS_WINDOW) {
        window.localStorage.removeItem('aifu_msclkid');
        window.localStorage.removeItem('aifu_msclkid_at');
        return '';
      }
      return id;
    } catch (e) { return fromUrl; }
  })();

  /*
   * Which reminder email this visit came from.
   *
   * Reminder links carry ?r=<kind>. Kept for the session rather than for
   * months, because a reminder click leads straight to the checkout: the value
   * only has to survive a reload or a trip back to the lander, and anything
   * longer would credit a sale weeks later to an email nobody remembers
   * opening.
   */
  var reminder = (function () {
    var fromUrl = urlParam('r');
    try {
      if (fromUrl) {
        window.sessionStorage.setItem('aifu_r', fromUrl);
        return fromUrl;
      }
      return window.sessionStorage.getItem('aifu_r') || '';
    } catch (e) { return fromUrl; }
  })();

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

  /*
   * The page they actually arrived on, kept for the whole visit.
   *
   * Every event already reports the URL of the page firing it, but by the time
   * somebody pays that is the checkout — which says nothing about where they
   * came in, and the checkout is shared between funnels. This is written once
   * per session and never overwritten, so the ad, the UTMs and the lander that
   * started the visit survive all the way to the purchase.
   */
  var landing = (function () {
    try {
      var v = window.sessionStorage.getItem('aifu_landing');
      if (!v) { v = window.location.href.slice(0, 500); window.sessionStorage.setItem('aifu_landing', v); }
      return v;
    } catch (e) { return window.location.href.slice(0, 500); }
  })();

  // Anything the page already knows about the visitor improves the match.
  /*
   * The visitor id Microsoft matches a person on across contexts. It has to be
   * the same value in two places: `anonymousId` on every server event, and
   * `VID` on the ID Sync pixel below. Microsoft reads the browser context when
   * the pixel fires, which is the part a server-to-server event cannot carry —
   * so without the pixel the id is just a string nobody recognises.
   *
   * Their preferred shape is a v1 UUID with the dashes removed.
   */
  var vid = (function () {
    var KEY = 'aifu_vid';
    try {
      var existing = window.localStorage.getItem(KEY);
      if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
    } catch (e) {}
    var made = '';
    try {
      made = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID().replace(/-/g, '')
        : '';
    } catch (e) {}
    if (!made) {
      // No randomUUID (older Safari, insecure context): still 128 bits.
      for (var i = 0; i < 32; i++) made += Math.floor(Math.random() * 16).toString(16);
    }
    try { window.localStorage.setItem(KEY, made); } catch (e) {}
    return made;
  })();

  /*
   * ID Sync. Microsoft requires this client-side so it can tie our visitor id
   * to its own, which is what makes remarketing audiences and view-through
   * attribution possible. Red3 is the Microsoft customer id (not the UET tag
   * id); the page sets window.AIFU_MS_CID, and with no id set this does
   * nothing rather than firing a request that cannot be matched.
   *
   * Once per session is enough, so a sessionStorage flag keeps a multi-page
   * visit to a single pixel.
   */
  (function idSync() {
    var cid = String(window.AIFU_MS_CID || '');
    if (!cid || !vid) return;
    try {
      if (window.sessionStorage.getItem('aifu_idsync')) return;
      window.sessionStorage.setItem('aifu_idsync', '1');
    } catch (e) {}
    try {
      var img = new Image(1, 1);
      img.referrerPolicy = 'no-referrer-when-downgrade';
      img.src = 'https://c.bing.com/c.gif?Red3=BACID_' + encodeURIComponent(cid) +
                '&VID=' + encodeURIComponent(vid);
    } catch (e) {}
  })();

  window.aifuTrack = function (event, extra) {
    var payload = extra || {};
    payload.event = event;
    payload.fbclid = fbclid || undefined;
    payload.fbclidAt = fbclid ? click.at : undefined;
    payload.fbp = fbp || undefined;
    payload.vid = vid || undefined;
    payload.msclkid = msclkid || undefined;
    payload.sourceUrl = window.location.href;
    payload.visitor = visitor;
    payload.session = session;
    payload.referrer = document.referrer || undefined;
    payload.landingUrl = landing;
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

  /*
   * Fire a conversion event at most once per visit.
   *
   * Stepping back to correct a typo and forward again is one person deciding
   * once, not two conversions. Meta de-duplicates on event_id, which these do
   * not share, so without this the same visitor counts repeatedly — inflating
   * the metric and teaching the optimiser the wrong thing.
   */
  window.aifuTrackOnce = function (event, extra) {
    var key = 'aifu_fired_' + event;
    try {
      if (window.sessionStorage.getItem(key)) return false;
      window.sessionStorage.setItem(key, '1');
    } catch (e) { /* storage refused — send it rather than lose it */ }
    window.aifuTrack(event, extra);
    return true;
  };

  // The click id, for the checkout to attach to the payment. The purchase is
  // reported hours or days later by the Stripe webhook, long after this page
  // is gone, so these have to ride along with the PaymentIntent.
  window.aifuFbclid = function () { return fbclid; };
  window.aifuFbclidAt = function () { return fbclid ? click.at : 0; };
  window.aifuFbp = function () { return fbp; };
  window.aifuMsclkid = function () { return msclkid; };
  window.aifuVid = function () { return vid; };
  window.aifuReminder = function () { return reminder; };
  // The page this visit started on — the checkout posts it with the payment
  // so a buyer can be traced back to the lander, not just to the pay page.
  window.aifuLandingUrl = function () { return landing; };

  window.aifuTrack('PageView');
})();
