/**
 * The message editor, and the one sanitiser everything renders through.
 *
 * Members type into a contenteditable box, so Bold makes the text bold where
 * they can see it rather than putting asterisks in front of them. That means
 * messages are HTML, and HTML from a member is never safe — so nothing is ever
 * rendered without passing through rtSanitize first, on the way in and again on
 * the way out.
 *
 * The sanitiser rebuilds the tree rather than filtering a string. A regex over
 * markup will always lose to someone who knows markup; walking the parsed nodes
 * and keeping only what is on the list cannot be talked around, because
 * anything not recognised is dropped rather than escaped-and-hoped-for.
 */
(function (root) {
  'use strict';

  // What a message is allowed to contain. Nothing here can carry script, load a
  // resource, or position itself over the rest of the page.
  var ALLOWED = {
    B: [], STRONG: [], I: [], EM: [], S: [], DEL: [], U: [],
    CODE: [], PRE: [], BR: [], P: [], DIV: [],
    UL: [], OL: [], LI: [], BLOCKQUOTE: [],
    A: ['href']
  };

  var SAFE_LINK = /^https?:\/\//i;

  function rtSanitize(html) {
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = String(html == null ? '' : html);

    var walk = function (node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;

        if (child.nodeType === 3) {                 // text, always fine
          child = next; continue;
        }
        if (child.nodeType !== 1) {                 // comments, CDATA and the rest
          node.removeChild(child); child = next; continue;
        }

        var tag = child.tagName;
        if (!Object.prototype.hasOwnProperty.call(ALLOWED, tag)) {
          // Unwrap rather than delete: a <span style=…> around a sentence is not
          // an attack, and throwing the sentence away with it would be.
          // <script> and <style> carry their payload as text, so those go whole.
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' ||
              tag === 'OBJECT' || tag === 'EMBED' || tag === 'LINK' || tag === 'META') {
            node.removeChild(child);
          } else {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
          }
          child = next; continue;
        }

        // Keep only the attributes this tag is allowed, which drops every
        // on* handler and every style in one move rather than by name.
        var keep = ALLOWED[tag];
        for (var i = child.attributes.length - 1; i >= 0; i--) {
          var attr = child.attributes[i].name;
          if (keep.indexOf(attr.toLowerCase()) < 0) child.removeAttribute(attr);
        }

        if (tag === 'A') {
          var href = child.getAttribute('href') || '';
          // A scheme nobody can see is how a link becomes a script.
          if (!SAFE_LINK.test(href)) {
            child.removeAttribute('href');
          } else {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer nofollow');
          }
        }

        walk(child);
        child = next;
      }
    };

    walk(doc.body);
    return doc.body.innerHTML;
  }

  /** Is there anything in this message besides empty markup? */
  function rtIsEmpty(html) {
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = String(html || '');
    return !doc.body.textContent.trim() && !doc.body.querySelector('li, img');
  }

  /* ---------------- the editor ---------------- */

  var BUTTONS = [
    ['bold', 'B', 'Bold', 'font-weight:800'],
    ['italic', 'I', 'Italic', 'font-style:italic'],
    ['strikeThrough', 'S', 'Strikethrough', 'text-decoration:line-through'],
    ['sep'],
    ['insertOrderedList', '1.', 'Numbered list', ''],
    ['insertUnorderedList', '•', 'Bullet list', 'font-size:1.1rem'],
    ['sep'],
    ['createLink', '\u{1F517}', 'Link', ''],
    ['code', '&lt;/&gt;', 'Code', 'font-family:var(--mono);font-size:.74rem'],
    ['sep'],
    ['emoji', '\u{1F60A}', 'Emoji', 'font-size:1.05rem']
  ];

  /**
   * Turn a container into a toolbar plus an editable box.
   * Returns { html(), text(), clear(), focus(), el }.
   */
  function rtMount(host, opts) {
    opts = opts || {};

    var bar = document.createElement('div');
    bar.className = 'rt-bar';

    var tray = document.createElement('div');
    tray.className = 'rt-emoji';
    tray.hidden = true;

    var box = document.createElement('div');
    box.className = 'rt-box';
    box.contentEditable = 'true';
    box.setAttribute('role', 'textbox');
    box.setAttribute('aria-multiline', 'true');
    box.setAttribute('data-placeholder', opts.placeholder || 'Type a message…');

    BUTTONS.forEach(function (b) {
      if (b[0] === 'sep') {
        var sp = document.createElement('span');
        sp.className = 'rt-sep';
        bar.appendChild(sp);
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = b[2];
      btn.setAttribute('aria-label', b[2]);
      btn.innerHTML = b[1];
      if (b[3]) btn.setAttribute('style', b[3]);
      btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });  // keep the selection
      btn.addEventListener('click', function () { run(b[0], btn); });
      bar.appendChild(btn);
    });

    host.appendChild(bar);
    host.appendChild(tray);
    host.appendChild(box);

    function exec(cmd, value) {
      box.focus();
      try { document.execCommand(cmd, false, value == null ? null : value); } catch (e) { /* nothing to do */ }
      syncState();
    }

    function wrapCode() {
      box.focus();
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      // Already inside code: step out by unwrapping, so the button toggles.
      var node = range.startContainer;
      while (node && node !== box) {
        if (node.nodeType === 1 && node.tagName === 'CODE') {
          var parent = node.parentNode;
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          syncState();
          return;
        }
        node = node.parentNode;
      }
      if (range.collapsed) return;
      var code = document.createElement('code');
      try { range.surroundContents(code); } catch (e) { /* selection spans elements */ }
      syncState();
    }

    function run(cmd, btn) {
      if (cmd === 'createLink') {
        var url = window.prompt('Link address', 'https://');
        if (!url || !SAFE_LINK.test(url)) return;
        exec('createLink', url);
        return;
      }
      if (cmd === 'code') return wrapCode();
      if (cmd === 'emoji') { toggleTray(btn); return; }
      exec(cmd);
    }

    /* The toolbar shows what the cursor is already inside, so Bold looks
       pressed when you are typing bold text. */
    function syncState() {
      [].forEach.call(bar.querySelectorAll('button'), function (btn, i) { void i; });
      BUTTONS.forEach(function (b, i) {
        if (b[0] === 'sep' || b[0] === 'emoji' || b[0] === 'createLink' || b[0] === 'code') return;
        var btn = bar.querySelectorAll('button')[buttonIndex(i)];
        if (!btn) return;
        var on = false;
        try { on = document.queryCommandState(b[0]); } catch (e) { on = false; }
        btn.classList.toggle('on', !!on);
      });
    }
    function buttonIndex(i) {
      var n = 0;
      for (var k = 0; k < i; k++) if (BUTTONS[k][0] !== 'sep') n++;
      return n;
    }

    box.addEventListener('keyup', syncState);
    box.addEventListener('mouseup', syncState);

    // Paste as plain text. A copy out of a web page brings its styles, its
    // classes and sometimes its scripts with it; none of that belongs in a
    // comment, and the sanitiser should not be the first line of defence.
    box.addEventListener('paste', function (ev) {
      ev.preventDefault();
      var text = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    /* ---------------- emoji ---------------- */
    var built = false;
    function toggleTray() {
      if (!built) { buildTray(); built = true; }
      tray.hidden = !tray.hidden;
      if (!tray.hidden) {
        var search = tray.querySelector('input');
        if (search) search.focus();
      }
    }

    function buildTray() {
      var groups = root.EMOJI_GROUPS || [];
      var head = document.createElement('div');
      head.className = 'rt-emoji-head';

      var search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Search emoji…';
      head.appendChild(search);

      var tabs = document.createElement('div');
      tabs.className = 'rt-emoji-tabs';
      groups.forEach(function (g, i) {
        var t = document.createElement('button');
        t.type = 'button';
        t.textContent = g[1][0][0];                 // the group's first emoji as its icon
        t.title = g[0];
        t.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        t.addEventListener('click', function () {
          search.value = '';
          draw('');
          var section = grid.querySelector('[data-group="' + i + '"]');
          if (section) section.scrollIntoView({ block: 'start' });
        });
        tabs.appendChild(t);
      });

      var grid = document.createElement('div');
      grid.className = 'rt-emoji-grid';

      function draw(q) {
        q = String(q || '').trim().toLowerCase();
        var html = '';
        groups.forEach(function (g, i) {
          var items = q
            ? g[1].filter(function (e) { return e[1].indexOf(q) > -1; })
            : g[1];
          if (!items.length) return;
          html += '<div class="rt-emoji-group" data-group="' + i + '">' +
            '<h5>' + g[0] + '</h5><div class="rt-emoji-row">' +
            items.map(function (e) {
              return '<button type="button" title="' + e[1].split(' ')[0] + '">' + e[0] + '</button>';
            }).join('') + '</div></div>';
        });
        grid.innerHTML = html || '<p class="rt-emoji-none">Nothing matches that.</p>';
      }

      grid.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      grid.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('button') : null;
        if (!b) return;
        box.focus();
        document.execCommand('insertText', false, b.textContent);
      });

      var t = null;
      search.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { draw(search.value); }, 90);
      });

      tray.appendChild(head);
      tray.appendChild(tabs);
      tray.appendChild(grid);
      draw('');
    }

    return {
      el: box,
      html: function () { return rtSanitize(box.innerHTML); },
      text: function () { return box.textContent || ''; },
      isEmpty: function () { return rtIsEmpty(box.innerHTML); },
      clear: function () { box.innerHTML = ''; tray.hidden = true; syncState(); },
      focus: function () { box.focus(); }
    };
  }

  root.rtSanitize = rtSanitize;
  root.rtIsEmpty = rtIsEmpty;
  root.rtMount = rtMount;
})(window);
