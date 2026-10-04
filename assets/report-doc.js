/**
 * Renders the weekly report: the shelf, and one report open.
 *
 * One renderer, two callers - the member area and the admin preview - for the
 * same reason the roadmap has one: a second implementation for the preview
 * would drift from the real thing within a week, and the whole point of a
 * preview is that it does not.
 *
 * Nothing here trusts its input. A report is model-written text about other
 * people's announcements, so every string is escaped on the way into the
 * markup and every outbound link is checked for an http scheme before it is
 * rendered as one.
 */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function has(v) { return !!(v && String(v).trim()); }

  /* A report links out to the whole internet, which is the one place in this
     product where that is true. Anything that is not plainly http(s) is
     rendered as text rather than as something to click. */
  function safe(url) {
    var s = String(url || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

  var TOPIC = {
    'what-changed': 'What changed',
    tutorial: 'Tutorial',
    tools: 'Tools',
    'deep-dive': 'Deep dive'
  };

  function when(at) {
    if (!at) return '';
    var d = new Date(at);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* "29 Sep – 5 Oct": the seven days the report covers. A weekly brief that
     does not say which week it is cannot be filed, forwarded or come back to. */
  function weekOf(at) {
    var end = new Date(at);
    if (isNaN(end)) return '';
    var start = new Date(end.getTime() - 6 * 864e5);
    var sameMonth = start.getMonth() === end.getMonth();
    var o = { day: 'numeric', month: 'short' };
    return start.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : o) +
      ' – ' + end.toLocaleDateString(undefined, o);
  }

  /* ---------- where a recommendation goes ---------- */

  function hrefFor(r, base) {
    var b = base == null ? '' : base;
    if (r.type === 'course') return b + '#course-' + encodeURIComponent(r.id);
    if (r.type === 'lesson') return b + '#lesson-' + encodeURIComponent(r.course || '') + '/' + encodeURIComponent(r.id);
    if (r.type === 'item') return b + '#item-' + encodeURIComponent(r.id);
    return b + '#downloads';
  }
  function typeLabel(r) {
    if (r.type === 'course') return 'Course';
    if (r.type === 'lesson') return 'Lesson';
    if (r.type === 'download') return 'Download';
    return r.kindLabel || 'Library';
  }

  /* ---------- the shelf ---------- */

  function cards(reports, opts) {
    var o = opts || {};
    if (!reports.length) {
      return '<p class="empty">The first report lands on Monday morning.</p>';
    }
    return '<div class="wr-grid">' + reports.map(function (r, i) {
      var cover = safe(r.coverUrl);
      return '<button class="wr-card" type="button" data-report="' + esc(r.number) + '">' +
        '<span class="wr-cover">' +
          (cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy">' : '') +
          '<span class="n">Report ' + esc(r.number) + '</span>' +
          (i === 0 && o.markNewest !== false ? '<span class="new">New</span>' : '') +
        '</span>' +
        '<span class="b">' +
          '<h3>' + esc(r.title) + '</h3>' +
          '<p>' + esc(r.dek || '') + '</p>' +
          '<span class="f"><span class="tag">' + esc(TOPIC[r.topic] || 'Report') + '</span>' +
            (r.items ? '<span>' + esc(r.items) + ' items</span>' : '') +
            '<span class="go">Read →</span></span>' +
        '</span></button>';
    }).join('') + '</div>';
  }

  /* ---------- one item: their card, then our writing ---------- */

  /**
   * The source card is theirs and is marked as theirs.
   *
   * Their picture, their headline, their name, their date, and a button back
   * to them. The picture is hotlinked from their own server and is never
   * copied here, so it is also referrerpolicy'd honestly and left to fail
   * quietly: an item whose publisher offers no picture, or whose picture has
   * since been taken down, is a card with no picture rather than a card with
   * something of ours standing in for one.
   */
  function sourceCard(it) {
    var url = safe(it.url);
    var img = it.image && safe(it.image.url);
    var name = esc(it.sourceName || 'Source');

    /* Captioned with whoever is serving it, which is not always whoever wrote
       the piece: when a story is covered in four places we take the picture
       from the company's own announcement, and the caption has to say so
       rather than credit the outlet we happened to link. */
    var credit = (it.image && it.image.sourceName) || it.sourceName || '';
    var creditUrl = safe((it.image && it.image.pageUrl) || it.url);

    return '<div class="wr-src">' +
      (img
        ? '<figure class="wr-shot"><img src="' + esc(img) + '" alt="' + esc((it.image && it.image.alt) || '') +
          '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" ' +
          'onerror="this.closest(\'.wr-shot\').remove()">' +
          (credit
            ? '<figcaption>Image via ' + (creditUrl
                ? '<a href="' + esc(creditUrl) + '" target="_blank" rel="noopener noreferrer nofollow">' +
                  esc(credit) + '</a>'
                : esc(credit)) + '</figcaption>'
            : '') +
          '</figure>'
        : '') +
      '<div class="wr-srcb">' +
        '<div class="wr-srcm"><span class="nm">' + name + '</span>' +
          (it.publishedAt ? '<span class="dt">' + esc(when(it.publishedAt)) + '</span>' : '') + '</div>' +
        '<h3>' + esc(it.headline) + '</h3>' +
        (url
          ? '<a class="wr-read" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' +
            'Read more at ' + name + ' ↗</a>'
          : '') +
      '</div></div>';
  }

  /* What this item is, said out loud. A spotlight on a two-month-old tool and
     a follow-up on an older story both belong in a thin week; what neither may
     do is sit unlabelled beside a Tuesday announcement and read as one. */
  var KIND = {
    news: { t: 'This week’s news', c: 'k-news' },
    spotlight: { t: 'Tool spotlight', c: 'k-spot' },
    deeper: { t: 'Deeper look', c: 'k-deep' }
  };

  function item(it, base) {
    var k = KIND[it.kind] || KIND.news;
    var html = '<div class="wr-item">' + sourceCard(it) +
      '<span class="wr-kind ' + k.c + '">' + esc(k.t) + '</span>' +
      '<div class="wr-ours">';

    if (has(it.what)) html += '<h4>What happened</h4><p>' + esc(it.what) + '</p>';
    if (has(it.why)) html += '<h4>Why it matters for entrepreneurs</h4><p>' + esc(it.why) + '</p>';

    if (list(it.steps).length) {
      html += '<h4>How to use it</h4><ol class="wr-how">' +
        list(it.steps).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    }

    if (list(it.resources).length) {
      html += '<div class="wr-links wr-inline">' + list(it.resources).map(function (r) {
        return '<a href="' + esc(hrefFor(r, base)) + '">' +
          '<span class="k">' + esc(typeLabel(r)) + '</span>' +
          '<span class="n">' + esc(r.title || r.id) + '</span></a>';
      }).join('') + '</div>';
    }

    return html + '</div></div>';
  }

  /* ---------- one report ---------- */

  function render(R, opts) {
    var o = opts || {};
    var base = o.base || '';
    var html = '<div class="wr">';

    if (o.interactive !== false) {
      html += '<button class="wr-back" type="button" data-wr-back>← All reports</button>';
    }

    /* The mark, same relative path the roadmap uses: both pages that render
       this live in /members/, so one path serves them and the PDF carries it. */
    html += '<img class="wr-logo" src="' + esc(o.logo || '../assets/logo.webp') +
      '" alt="AI Founder University" width="720" height="139">';

    var cover = safe(R.coverUrl);
    if (cover) html += '<div class="wr-hero"><img src="' + esc(cover) + '" alt=""></div>';

    html += '<div class="wr-meta"><span class="wr-no">Report ' + esc(R.number) + '</span>' +
      (R.publishedAt ? '<span class="wr-when">' + esc(when(R.publishedAt)) + '</span>' : '') +
      (R.publishedAt ? '<span class="wr-when">· week of ' + esc(weekOf(R.publishedAt)) + '</span>' : '') +
      '<span class="wr-when">· ' + esc(TOPIC[R.topic] || 'Report') + '</span>' +
      (o.interactive === false ? ''
        : '<button class="wr-pdf" type="button" data-wr-pdf ' +
          'title="Opens your browser\'s print dialog — choose Save as PDF">↓ Download PDF</button>') +
      '</div>';

    html += '<h1 class="t">' + esc(R.title) + '</h1>';
    if (has(R.dek)) html += '<p class="dek">' + esc(R.dek) + '</p>';

    if (list(R.sixty).length) {
      html += '<div class="wr-sixty"><h2>In 60 seconds</h2><ul>' +
        list(R.sixty).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
    }

    if (list(R.stats).length) {
      html += '<div class="wr-stats">' + list(R.stats).map(function (s) {
        return '<div class="wr-stat"><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>';
      }).join('') + '</div>';
    }

    if (list(R.items).length) {
      html += '<h2 class="s">What changed</h2>';
      list(R.items).forEach(function (it) { html += item(it, base); });
    }

    /* The rest of the week, one line each. These earn a mention and not a
       section: an announcement with no price, no availability and nothing to
       do about it does not need three headings over it. */
    if (list(R.alsoAnnounced).length) {
      html += '<div class="wr-also"><h2>Also announced</h2><ul>' +
        list(R.alsoAnnounced).map(function (a) {
          var url = safe(a.url);
          return '<li>' + esc(a.line) +
            (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' +
              esc(a.sourceName || 'Source') + ' ↗</a>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }

    var t = R.tutorial || {};
    if (list(t.steps).length) {
      html += '<div class="wr-tut"><h2>' + esc(t.title || 'Try this') + '</h2>' +
        (has(t.intro) ? '<p class="intro">' + esc(t.intro) + '</p>' : '') +
        '<ol class="wr-steps">' + list(t.steps).map(function (s) {
          return '<li><b>' + esc(s.title) + '</b><span>' + esc(s.detail) + '</span></li>';
        }).join('') + '</ol>' +
        (has(t.watchOut) ? '<div class="wr-watch"><b>Watch out</b><span>' + esc(t.watchOut) + '</span></div>' : '') +
        '</div>';
    }

    var move = R.yourMove || {};
    if (has(move.intro) || list(move.resources).length) {
      html += '<div class="wr-move"><h2>Your move this week</h2>' +
        (has(move.intro) ? '<p>' + esc(move.intro) + '</p>' : '') +
        (list(move.resources).length
          ? '<div class="wr-links">' + list(move.resources).map(function (r) {
              return '<a href="' + esc(hrefFor(r, base)) + '">' +
                '<span class="k">' + esc(typeLabel(r)) + '</span>' +
                '<span class="n">' + esc(r.title || r.id) + '</span></a>';
            }).join('') + '</div>'
          : '') +
        '</div>';
    }

    /* "Sources". It used to say "Every claim above links to its source",
       which is a promise made in the voice of somebody expecting to be
       doubted - and one the page cannot keep anyway once an item is taken
       down. The list is the evidence; it does not need announcing. */
    if (list(R.sources).length) {
      html += '<div class="wr-sources"><h3>Sources</h3><ol>' +
        list(R.sources).map(function (s) {
          var url = safe(s.url);
          return '<li>' + (url
            ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' +
              esc(s.name || url) + ' — ' + esc(url) + '</a>'
            : esc(s.name || '')) + '</li>';
        }).join('') + '</ol></div>';
    }

    if (o.foot) html += '<p class="wr-foot">' + esc(o.foot) + '</p>';
    return html + '</div>';
  }

  function wire(el, opts) {
    var o = opts || {};
    var pdf = el.querySelector('[data-wr-pdf]');
    if (pdf) pdf.addEventListener('click', function () { window.print(); });
    var back = el.querySelector('[data-wr-back]');
    if (back && o.onBack) back.addEventListener('click', o.onBack);
    if (o.onOpen) {
      [].forEach.call(el.querySelectorAll('[data-report]'), function (c) {
        c.addEventListener('click', function () { o.onOpen(Number(c.getAttribute('data-report'))); });
      });
    }
  }

  root.reportDoc = { render: render, cards: cards, wire: wire, hrefFor: hrefFor };
})(window);
