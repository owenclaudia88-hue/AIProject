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

  /**
   * Links the words themselves.
   *
   * A step that says "install the Email Specialist plugin" should let somebody
   * click those words. The mentions are worked out when the roadmap is
   * written, against the real catalogue, so this only has to find the title in
   * the sentence and wrap it.
   *
   * The text is escaped first and the anchor is spliced into the escaped
   * string, so nothing in the roadmap can inject markup. Each mention is
   * linked once per step - the first time it appears - because a tool named in
   * four lines does not need four links.
   */
  /* Where a title appears as itself rather than inside a longer word, or -1.
     The same rule the roadmap was written with, applied again here because
     this text has been escaped since. */
  function wholePhraseAt(hay, needle) {
    var word = /[a-z0-9]/;
    var at = hay.indexOf(needle);
    while (at !== -1) {
      var before = at === 0 ? '' : hay.charAt(at - 1);
      var after = hay.charAt(at + needle.length);
      if (!word.test(before) && !word.test(after)) return at;
      at = hay.indexOf(needle, at + 1);
    }
    return -1;
  }

  function linker(mentions, base) {
    var left = list(mentions).slice().sort(function (a, b) {
      return String(b.title).length - String(a.title).length;
    });
    return function (text) {
      var out = esc(text);
      if (!left.length || !out) return out;
      var marks = [];
      for (var i = 0; i < left.length; i++) {
        var m = left[i];
        var needle = esc(m.title);
        var at = wholePhraseAt(out.toLowerCase(), needle.toLowerCase());
        if (at < 0) continue;
        // A placeholder rather than the anchor itself, so a later, shorter
        // title cannot match inside an href that is already there.
        marks.push('<a class="rmd-ml" href="' + esc(hrefFor(m, base)) + '">' +
          out.slice(at, at + needle.length) + '</a>');
        out = out.slice(0, at) + '\u0000' + (marks.length - 1) + '\u0000' + out.slice(at + needle.length);
        left.splice(i, 1);
        i--;
      }
      return out.replace(/\u0000(\d+)\u0000/g, function (_, n) { return marks[Number(n)]; });
    };
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

  /* ---------- the plan on one screen ----------

     Three phases, their targets, and what has to be true to move on. Drawn
     from the phases themselves rather than asked for separately, so the
     picture cannot disagree with the document underneath it. */

  function gates(phases) {
    if (phases.length < 2) return '';
    return '<div class="rmd-gates">' + phases.map(function (p) {
      var cp = p.checkpoint || {};
      return '<div class="rmd-gate"><p class="w">' + esc(p.window) + '</p>' +
        (has(p.name) ? '<h3>' + esc(p.name) + '</h3>' : '') +
        (has(p.target) ? '<p class="tgt">' + esc(p.target) + '</p>' : '') +
        (list(cp.numbers).length
          ? '<ul>' + list(cp.numbers).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
          : '') +
        (has(cp.label) ? '<p class="exit"><b>' + esc(cp.label) + '</b> checkpoint</p>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---------- how the goal is reached ---------- */

  function revenueTable(R) {
    var rev = R.revenue || {};
    var rows = list(rev.rows);
    if (!rows.length) return '';
    var ads = rev.adSpend;
    return '<section><h2>How you reach ' + esc(R.goal || 'your goal') +
      (has(rev.intro) ? '<span class="sub">' + esc(rev.intro) + '</span>' : '') + '</h2>' +
      '<div class="rmd-tw"><table class="rmd-t rmd-rev"><thead><tr><th>Revenue source</th>' +
      '<th>Month 1</th><th>Month 2</th><th>Month 3</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r.source) + '</td><td>' + esc(r.m1) + '</td>' +
          '<td>' + esc(r.m2) + '</td><td>' + esc(r.m3) + '</td></tr>';
      }).join('') +
      (rev.total && (has(rev.total.m1) || has(rev.total.m3))
        ? '<tr class="tot"><td>Total</td><td>' + esc(rev.total.m1) + '</td><td>' +
          esc(rev.total.m2) + '</td><td>' + esc(rev.total.m3) + '</td></tr>'
        : '') +
      (ads ? '<tr class="ads"><td>Ad spend</td><td>' + esc(ads.m1) + '</td><td>' +
        esc(ads.m2) + '</td><td>' + esc(ads.m3) + '</td></tr>' : '') +
      '</tbody></table></div>' +
      (has(rev.budgetRule) ? '<p class="rmd-rule">' + esc(rev.budgetRule) + '</p>' : '') +
      (has(rev.assumptions) ? '<p class="rmd-assume">' + esc(rev.assumptions) + '</p>' : '') +
      '</section>';
  }

  /* ---------- the tables at the end ---------- */

  function scorecardTable(rows, base) {
    if (!rows.length) return '';
    var anyLow = rows.some(function (m) { return has(m.ifBelow); });
    var anyTool = rows.some(function (m) { return m.routine; });
    return '<section><h2>Your weekly scorecard<span class="sub">Check these every week. The first ' +
      'one below target is your next job.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>Number</th><th>Target</th>' +
      (anyLow ? '<th>If it is below target</th>' : '') +
      (anyTool ? '<th>Prepared by</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (m) {
        return '<tr><td>' + esc(m.number) + '</td><td class="wk">' + esc(m.target) + '</td>' +
          (anyLow ? '<td>' + esc(m.ifBelow || '') + '</td>' : '') +
          (anyTool
            ? '<td>' + (m.routine
                ? '<a href="' + esc(hrefFor(m.routine, base)) + '">' + esc(m.routine.title || m.routine.id) + '</a>'
                : '') + '</td>'
            : '') +
          '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function workingWeekTable(rows) {
    if (!rows.length) return '';
    return '<section><h2>Your working week<span class="sub">Where the hours go, inside the time you ' +
      'said you have.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>Block</th><th>Hours a week</th></tr></thead>' +
      '<tbody>' + rows.map(function (r) {
        return '<tr><td>' + esc(r.block) + '</td><td class="wk">' + esc(r.hours) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function toolkitTable(rows, base) {
    if (!rows.length) return '';
    return '<section><h2>Your AI Founder University toolkit<span class="sub">Everything this plan ' +
      'uses, in the order you need it.</span></h2>' +
      '<div class="rmd-tw"><table class="rmd-t"><thead><tr><th>When</th><th>Use</th><th>Type</th></tr></thead>' +
      '<tbody>' + rows.map(function (r) {
        return '<tr><td class="wk">' + esc(r.when) + '</td>' +
          '<td><a href="' + esc(hrefFor(r, base)) + '">' + esc(r.title || r.id) + '</a></td>' +
          '<td class="ty">' + esc(typeLabel(r)) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* ---------- the whole thing ---------- */

  function render(R, opts) {
    var o = opts || {};
    var base = o.base || '';
    var phases = list(R && R.phases).filter(function (p) { return p && has(p.window); });
    var html = '<div class="rmd">';

    // Both pages that render this live in /members/, so one relative path
    // serves them and the PDF carries the mark with it.
    html += '<img class="rmd-logo" src="' + esc(o.logo || '../assets/logo.webp') +
      '" alt="AI Founder University" width="720" height="139">';

    var title = o.title || ('Personalised AI Roadmap' + (o.name ? ' — ' + o.name : ''));
    html += '<div class="rmd-top"><h1>' + esc(title) + '</h1>' +
      (o.interactive === false ? ''
        : '<button class="rmd-pdf" type="button" data-rmd-pdf ' +
          'title="Opens your browser\'s print dialog — choose Save as PDF">' +
          '↓ Download PDF</button>') +
      '</div>';

    var meta = [];
    if (o.name && title.indexOf(o.name) === -1) meta.push(o.name);
    if (o.publishedAt) {
      var d = new Date(o.publishedAt);
      if (!isNaN(d)) meta.push(d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    }
    meta.push('AI Founder University');
    html += '<p class="rmd-meta">' + meta.map(function (m) {
      return '<span>' + esc(m) + '</span>';
    }).join('') + '</p>';

    // 2. The opening, with the goal called out of it.
    if (has(R.goal)) html += '<p class="rmd-goal"><span>90-day goal</span>' + esc(R.goal) + '</p>';
    if (has(R.opening)) html += '<p class="rmd-lede">' + esc(R.opening) + '</p>';

    // 3. How the goal is reached.
    html += revenueTable(R);

    // 4. Day one.
    var sh = R.startHere;
    if (sh && list(sh.steps).length) {
      html += '<section><h2>Start here: Day 1' +
        (has(sh.minutes) ? ' <small>· ' + esc(sh.minutes) + '</small>' : '') +
        '</h2><ol class="rmd-list">' +
        list(sh.steps).map(function (s) {
          var link = linker(s.mentions, base);
          return '<li><b>' + esc(s.title) +
            (has(s.minutes) ? '<i class="min">' + esc(s.minutes) + '</i>' : '') + '</b>' +
            (has(s.detail) ? '<span>' + link(s.detail) + '</span>' : '') +
            chips(s.resources, base) + '</li>';
        }).join('') + '</ol></section>';
    }

    // The three phases at a glance, then 5-7: the phases themselves.
    html += gates(phases);

    phases.forEach(function (p, pi) {
      html += '<section class="rmd-phase" data-p="' + pi + '"><div class="rmd-ph">' +
        '<span class="w">' + esc(p.window) + '</span>' +
        '<h2>' + esc(p.name || p.window) + '</h2>' +
        (has(p.target) ? '<p class="tgt">Target: ' + esc(p.target) + '</p>' : '') +
        '</div>';

      list(p.weeks).forEach(function (w, wi) {
        html += '<div class="rmd-week"><h3>' + esc(w.label) + '</h3>';
        list(w.steps).forEach(function (st, si) {
          var link = linker(st.mentions, base);
          html += '<div class="rmd-step" data-step="' + pi + '.' + wi + '.' + si + '">' +
            (o.interactive === false ? ''
              : '<button class="rmd-chk" type="button" aria-pressed="false" ' +
                'aria-label="Mark done: ' + esc(st.title) + '">✓</button>') +
            '<div class="rmd-sb"><h4>' + esc(st.title) + '</h4>' +
            (has(st.detail) ? '<p class="why">' + link(st.detail) + '</p>' : '') +
            chips(st.resources, base) +
            '</div></div>';
        });
        html += '</div>';
      });

      var cp = p.checkpoint || {};
      if (has(cp.label) || has(cp.hit) || has(cp.missed)) {
        html += '<div class="rmd-cp"><h4>' + esc(cp.label || 'Checkpoint') + '</h4>' +
          (list(cp.numbers).length
            ? '<ul>' + list(cp.numbers).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
            : '') +
          (has(cp.hit) ? '<p><b>If you hit it</b> ' + esc(cp.hit) + '</p>' : '') +
          (has(cp.missed) ? '<p><b>If you miss it</b> ' + esc(cp.missed) + '</p>' : '') +
          '</div>';
      }
      html += '</section>';
    });

    // 8. If you fall behind.
    if (list(R.fallBehind).length) {
      html += '<section><h2>If you fall behind<span class="sub">In this order: quickest and cheapest ' +
        'first.</span></h2><ol class="rmd-ol">' +
        list(R.fallBehind).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol></section>';
    }

    // 9, 10, 11.
    html += scorecardTable(list(R.scorecard), base);
    html += workingWeekTable(list(R.workingWeek));
    html += toolkitTable(list(R.toolkit), base);

    // 12.
    if (list(R.notDoing).length) {
      html += '<section><h2>What not to do</h2><ul class="rmd-ul">' +
        list(R.notDoing).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></section>';
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
