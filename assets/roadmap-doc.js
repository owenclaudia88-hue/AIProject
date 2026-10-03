/**
 * Renders a personalised roadmap as a document.
 *
 * One renderer, two callers: the member area shows it to the person it was
 * written for, and the admin screen previews exactly the same markup before
 * publishing. A second implementation for the preview would drift from the
 * first one within a week, and the whole point of the preview is that it does
 * not.
 *
 * Everything below the headline is optional. Roadmaps written before a block
 * existed simply do not have it, and the document closes up around the gap
 * rather than printing an empty heading - which is why each section is guarded
 * rather than templated.
 *
 * Nothing here trusts its input. The roadmap is model-written text that an
 * admin may have edited by hand in a JSON box, so every string is escaped on
 * the way into the markup.
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

  /* ---------- where a recommendation actually goes ----------

     A link that drops somebody in the right section and leaves them to find
     the thing is not a link to the thing. Courses open at the course, lessons
     open in the player at that lesson, library items open the reader.

     The href is absolute so that it survives being printed: in a PDF a bare
     "#item-42" points nowhere, and the same string with the site in front of
     it opens the right page from somebody's downloads folder. */

  function hrefFor(r, base) {
    var b = base == null ? '' : base;
    if (r.type === 'course') return b + '#course-' + encodeURIComponent(r.id);
    // Slug and lesson id both contain hyphens, so they are separated by a
    // slash rather than by a character that appears inside either of them.
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

  function chips(resources, base) {
    var rs = list(resources);
    if (!rs.length) return '';
    return '<div class="rmd-res">' + rs.map(function (r) {
      return '<a href="' + esc(hrefFor(r, base)) + '">' +
        '<span class="k">' + esc(typeLabel(r)) + '</span>' +
        '<span class="n">' + esc(r.title || r.id) + '</span></a>';
    }).join('') + '</div>';
  }

  /* The phase's resources collected into one table, because "what do I use
     this week" is a question people ask of the week, not of one step. The note
     is the model's own line about why this one, here. */
  function useTable(phase, base) {
    var seen = {}, rows = [];
    list(phase.steps).forEach(function (st) {
      list(st.resources).forEach(function (r) {
        var k = r.type + ':' + r.id;
        if (seen[k]) return;
        seen[k] = 1;
        rows.push(r);
      });
    });
    if (!rows.length) return '';

    var anyNote = rows.some(function (r) { return has(r.note); });
    return '<div class="rmd-use"><h4>From your library in this phase</h4>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>Use</th><th>Type</th>' +
      (anyNote ? '<th>What it does for you here</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><a href="' + esc(hrefFor(r, base)) + '">' + esc(r.title || r.id) + '</a></td>' +
          '<td class="ty">' + esc(typeLabel(r)) + '</td>' +
          (anyNote ? '<td>' + esc(r.note || '') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* ---------- the plan on one screen ---------- */

  function gates(phases) {
    if (phases.length < 2) return '';
    var anyExit = phases.some(function (p) { return has(p.exit); });
    return '<div class="rmd-gates">' + phases.map(function (p) {
      var bullets = list(p.steps).slice(0, 4).map(function (st) {
        return '<li>' + esc(st.title) + '</li>';
      }).join('');
      return '<div class="rmd-gate"><p class="w">' + esc(p.window) + '</p>' +
        (has(p.goal) ? '<h3>' + esc(p.goal) + '</h3>' : '') +
        (bullets ? '<ul>' + bullets + '</ul>' : '') +
        (has(p.exit) ? '<p class="exit"><b>Move on when:</b> ' + esc(p.exit) + '</p>' : '') +
        '</div>';
    }).join('') + '</div>' +
      (anyExit
        ? '<p class="rmd-cap">Each phase ends at a gate: move on only once its condition is true. ' +
          'If it is not, repeat that phase rather than starting the next one.</p>'
        : '<p class="rmd-cap">The whole plan at a glance. Everything below is the detail of these.</p>');
  }

  function scheduleTable(rows) {
    if (!rows.length) return '';
    var anyMove = rows.some(function (r) { return has(r.moveOn); });
    return '<section><h2>Your week by week<span class="sub">Work through this in order. ' +
      'The detail of each line is in the phase sections below.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>When</th><th>Do these, in this order</th>' +
      (anyMove ? '<th>Move on when</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        var dos = list(r.do);
        return '<tr><td class="wk">' + esc(r.label) + '</td>' +
          '<td>' + (dos.length > 1
            ? '<ol>' + dos.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ol>'
            : esc(dos[0] || '')) + '</td>' +
          (anyMove ? '<td class="mv">' + esc(r.moveOn || '') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function metricsTable(rows) {
    if (!rows.length) return '';
    var anyBench = rows.some(function (m) { return has(m.benchmark); });
    var anyLow = rows.some(function (m) { return has(m.ifLow); });
    return '<section><h2>How you will know it is working<span class="sub">Check these weekly. ' +
      'The first one below its mark is your next job.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>Measure</th><th>Target</th>' +
      (anyBench ? '<th>Healthy looks like</th>' : '') +
      (anyLow ? '<th>If it is below</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (m) {
        return '<tr><td>' + esc(m.name) + '</td><td class="wk">' + esc(m.target || '') + '</td>' +
          (anyBench ? '<td>' + esc(m.benchmark || '') + '</td>' : '') +
          (anyLow ? '<td>' + esc(m.ifLow || '') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function rhythmTable(rows) {
    if (!rows.length) return '';
    return '<section><h2>Your working week<span class="sub">Where the hours go, so the plan fits ' +
      'the time you actually have.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>Block</th><th>Hours a week</th></tr></thead>' +
      '<tbody>' + rows.map(function (r) {
        return '<tr><td>' + esc(r.block) + '</td><td class="wk">' + esc(r.hours || '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* ---------- the whole thing ---------- */

  function render(R, opts) {
    var o = opts || {};
    var base = o.base || '';
    var phases = list(R && R.phases).filter(function (p) { return p && has(p.window); });
    var html = '<div class="rmd">';

    html += '<div class="rmd-top"><h1>' + esc((R && R.headline) || 'Your AI Roadmap') + '</h1>' +
      (o.interactive === false ? ''
        : '<button class="rmd-pdf" type="button" data-rmd-pdf ' +
          'title="Opens your browser\'s print dialog — choose Save as PDF">' +
          '↓ Download PDF</button>') +
      '</div>';

    var meta = [];
    if (o.name) meta.push(o.name);
    if (o.publishedAt) {
      var d = new Date(o.publishedAt);
      if (!isNaN(d)) meta.push(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    }
    meta.push('AI Founder University');
    html += '<p class="rmd-meta">' + meta.map(function (m) {
      return '<span>' + esc(m) + '</span>';
    }).join('') + '</p>';

    if (has(R.readback)) html += '<p class="rmd-lede">' + esc(R.readback) + '</p>';

    html += gates(phases);

    if (has(R.theBet)) {
      html += '<div class="rmd-bet"><b>The one thing to get right</b><p>' + esc(R.theBet) + '</p></div>';
    }

    var sit = R.situation;
    if (sit && list(sit.paragraphs).length) {
      html += '<section><h2>' + esc(sit.heading || 'Where you are and what to fix first') + '</h2>' +
        list(sit.paragraphs).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</section>';
    }

    var sh = R.startHere;
    if (sh && list(sh.steps).length) {
      html += '<section><h2>' + esc(sh.heading || 'Start here') +
        (has(sh.blurb) ? '<span class="sub">' + esc(sh.blurb) + '</span>' : '') + '</h2><ol class="rmd-list">' +
        list(sh.steps).map(function (s) {
          return '<li><b>' + esc(s.title) + '</b>' +
            (has(s.detail) ? '<span>' + esc(s.detail) + '</span>' : '') +
            chips(s.resources, base) + '</li>';
        }).join('') + '</ol></section>';
    }

    html += scheduleTable(list(R.schedule).filter(function (r) { return r && has(r.label); }));

    phases.forEach(function (p, pi) {
      html += '<section class="rmd-phase" data-p="' + pi + '"><div class="rmd-ph">' +
        '<span class="w">' + esc(p.window) + '</span>' +
        '<h2>' + esc(p.goal || p.window) + '</h2></div>';

      list(p.steps).forEach(function (st, si) {
        html += '<div class="rmd-step" data-step="' + pi + '.' + si + '">' +
          (o.interactive === false ? ''
            : '<button class="rmd-chk" type="button" aria-pressed="false" ' +
              'aria-label="Mark done: ' + esc(st.title) + '">✓</button>') +
          '<div class="rmd-sb"><h3>' + esc(st.title) +
            (has(st.time) ? '<span class="t">' + esc(st.time) + '</span>' : '') + '</h3>' +
          (has(st.why) ? '<p class="why">' + esc(st.why) + '</p>' : '') +
          (list(st.how).length
            ? '<ol class="how">' + list(st.how).map(function (h) {
                return '<li>' + esc(h) + '</li>';
              }).join('') + '</ol>'
            : '') +
          chips(st.resources, base) +
          '</div></div>';
      });

      html += useTable(p, base);
      if (has(p.exit)) {
        html += '<p class="rmd-exit"><b>Move on when:</b> ' + esc(p.exit) + '</p>';
      }
      html += '</section>';
    });

    if (list(R.order).length) {
      html += '<section><h2>Why this order</h2>' +
        list(R.order).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</section>';
    }

    html += metricsTable(list(R.metrics).filter(function (m) { return m && has(m.name); }));
    html += rhythmTable(list(R.rhythm).filter(function (r) { return r && has(r.block); }));

    if (list(R.watchOuts).length) {
      html += '<section><h2>What not to do</h2><ul class="rmd-ul">' +
        list(R.watchOuts).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></section>';
    }

    html += '<p class="rmd-foot">' + esc(o.foot || 'Built for you by AI Founder University.') + '</p>';
    return html + '</div>';
  }

  /* ---------- ticking things off ----------

     Kept in the browser rather than the database on purpose: it is a private
     reading aid, it has to survive a published roadmap being rewritten, and
     nothing else needs to know. Storage can throw in a private window, so
     every touch of it is guarded and a failure just means the ticks do not
     persist. */

  function readDone(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeDone(key, map) {
    try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {}
  }

  function wire(el, opts) {
    var o = opts || {};
    var key = 'afu_rm_done_' + (o.storeKey || 'current');
    var done = readDone(key);

    [].forEach.call(el.querySelectorAll('.rmd-step'), function (step) {
      var id = step.getAttribute('data-step');
      var btn = step.querySelector('.rmd-chk');
      if (!btn) return;
      var set = function (on) {
        step.classList.toggle('done', on);
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      };
      set(!!done[id]);
      btn.addEventListener('click', function () {
        var on = !done[id];
        if (on) done[id] = 1; else delete done[id];
        writeDone(key, done);
        set(on);
      });
    });

    var pdf = el.querySelector('[data-rmd-pdf]');
    if (pdf) pdf.addEventListener('click', function () { window.print(); });
  }

  root.roadmapDoc = { render: render, wire: wire, hrefFor: hrefFor };
})(window);
