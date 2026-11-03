/* explore.js - the house as the menu. Every service has a part on the drawing; pointing at it (desktop) lights it, a press
 * opens ONE card: when a project is needed, what you get, and the way to the service page.
 * Desktop: name pins on the drawing; the card sits in the drawing's sky and the camera (the SVG viewBox) moves the part
 * beside it. Tablet and phone: no pins on the drawing (it stays clean); a grid of name buttons under it opens the same card
 * between the drawing and the grid, and the camera glides to the part. The tiles under the hero are the plain path to the
 * same service pages (keyboard, screen reader, no script). PN.cam is the camera; intro.js pans it on phones and reveals
 * the pins. Without GSAP or with reduced motion the camera jumps instead of gliding. */
(function () {
  'use strict';
  var root = document.documentElement;
  var svg = document.getElementById('dom'), stage = document.getElementById('stage');
  var dataEl = document.getElementById('parts-data');
  if (!svg || !stage || !(dataEl || window.PN_PARTS)) return;
  var PN = (window.PN = window.PN || {});
  var hero = document.getElementById('start'), card = document.getElementById('card');
  var data = window.PN_PARTS || JSON.parse(dataEl.textContent), byId = {};   /* PN_PARTS: the canvas board passes the data directly */
  data.forEach(function (p, i) { p.i = i; byId[p.id] = p; });
  var pins = [].slice.call(document.querySelectorAll('#pins .pin'));
  var picks = [].slice.call(document.querySelectorAll('#pick .pick__b'));
  var openers = pins.concat(picks);
  var pinOf = {}; pins.forEach(function (b) { pinOf[b.getAttribute('data-part')] = b; });
  var pickOf = {}; picks.forEach(function (b) { pickOf[b.getAttribute('data-part')] = b; });
  var reduce = root.classList.contains('rm');
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addListener: function () {} }; };
  var mqWide = mm('(min-width: 1180px)'), mqPhone = mm('(max-width: 699px)'), mqFine = mm('(hover: hover) and (pointer: fine)');
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  /* ---- camera: the drawing's window in drawing units [x, y, w, h], always with the stage's aspect ratio ---- */
  var SCENE = [-40, 30, 1660, 820];          /* street, plot, house and the construction board */
  var HOUSE = [676, 40, 888, 790];           /* phone: the house centred (walls and eaves 770-1470, centre x 1120), the outdoor unit and the board inside */
  var STREET = [-40, 40, 888, 790];          /* phone: where the intro's pan starts (same width, so the pan does not zoom) */
  var view = SCENE.slice(), W = 1, H = 1, tween = null, open = null, opener = null;

  function measure() { var r = stage.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); }
  function boxView(b) {                      /* the whole box visible, bottom-aligned: extra room goes to the sky */
    var s = Math.min(W / b[2], H / b[3]), vw = W / s, vh = H / s;
    return [b[0] + (b[2] - vw) / 2, b[1] + b[3] - vh, vw, vh];
  }
  function homeView() { return boxView(mqPhone.matches ? HOUSE : SCENE); }
  function partView(p) {                     /* the part centred in the free side of the stage, zoomed in at most 2.2x */
    var b = p.box, pad = 46, bx = b[0] - pad, by = b[1] - pad, bw = b[2] - b[0] + 2 * pad, bh = b[3] - b[1] + 2 * pad;
    var f = [14, 14, W - 14, H - 14];
    if (mqWide.matches && !card.hidden) {
      var cr = card.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      f = [cr.right - sr.left + 40, 24, W - 32, H - 24];
    }
    var h0 = homeView(), s0 = W / h0[2];
    var s = Math.min((f[2] - f[0]) / bw, (f[3] - f[1]) / bh, s0 * 2.2);
    var cx = bx + bw / 2, cy = by + bh / 2;
    return [cx - (f[0] + f[2]) / 2 / s, cy - (f[1] + f[3]) / 2 / s, W / s, H / s];
  }
  function apply(v) {
    view = v;
    svg.setAttribute('viewBox', v.map(function (n) { return n.toFixed(1); }).join(' '));
    placePins();
  }
  function glide(v, dur) {                   /* plain requestAnimationFrame, so it also runs where GSAP is not loaded (the canvas) */
    if (tween) { cancelAnimationFrame(tween); tween = null; }
    if (reduce || !dur || !window.requestAnimationFrame) { apply(v); return; }
    var from = view.slice(), t0 = 0, ms = dur * 1000;
    var io = function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };   /* = power2.inOut */
    var step = function (now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / ms), e = io(p);
      apply(from.map(function (a, i) { return a + (v[i] - a) * e; }));
      tween = p < 1 ? requestAnimationFrame(step) : null;
    };
    tween = requestAnimationFrame(step);
  }
  PN.cam = { home: homeView, box: boxView, street: STREET, apply: apply, glide: glide, measure: measure, get view() { return view.slice(); } };

  /* ---- pins (desktop): HTML buttons beside their part; the anchor is the pill's end on the part's side ---- */
  function placePins() {
    if (!mqWide.matches) return;
    var kx = W / view[2], ky = H / view[3];
    pins.forEach(function (b) {
      var p = byId[b.getAttribute('data-part')], a = p.at;
      var x = (a.x - view[0]) * kx, y = (a.y - view[1]) * ky, w = b.offsetWidth || 120;
      var ox = a.dir === 'l' ? w - 16 : 16;
      b.classList.toggle('is-out', x < 4 || x > W - 4 || y < 4 || y > H - 4);                    /* its part is out of the frame */
      var px = Math.max(6, Math.min(W - w - 10, x - ox)), py = Math.max(6, Math.min(H - 50, y - 22));   /* a long name never runs past the edge */
      b.style.setProperty('--px', px.toFixed(1) + 'px');
      b.style.setProperty('--py', py.toFixed(1) + 'px');
    });
  }

  /* ---- focus: one service lit (hover preview, or the open card) ---- */
  function lit(id) {
    if (id) svg.setAttribute('data-focus', id); else svg.removeAttribute('data-focus');
    pins.forEach(function (b) { b.classList.toggle('is-hot', b.getAttribute('data-part') === id); });
  }
  function preview(id) { if (!open) lit(id); }

  /* ---- the card: title, two short answers, the way on; a labelled close button (no call button: the number is in the
   * header and in the footer, once each) ---- */
  function cardHTML(p) {
    var prev = data[(p.i + data.length - 1) % data.length], next = data[(p.i + 1) % data.length];
    var h = '<div class="card__head"><h2 id="card-t">' + esc(p.title) + '</h2>' +
      '<button type="button" class="card__x" data-go="x">Zamknij<span aria-hidden="true"> ×</span></button></div>';
    if (p.when) h += '<h3>Kiedy potrzebny projekt</h3><p>' + esc(p.when) + '</p>';
    if (p.get) h += '<h3>Co dostajesz</h3><p>' + esc(p.get) + '</p>';
    if (p.body) h += '<p class="card__body">' + esc(p.body) + '</p>';
    if (p.href) h += '<a class="btn btn--go" href="' + p.href + '"' + (p.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(p.more) +
      '<span aria-hidden="true">' + (p.ext ? ' ↗' : ' →') + '</span></a>';
    h += '<div class="card__nav"><button type="button" data-go="-1"><span aria-hidden="true">‹&nbsp;</span>' + esc(prev.chip) + '</button>' +
      '<button type="button" data-go="1">' + esc(next.chip) + '<span aria-hidden="true">&nbsp;›</span></button></div>';
    return h;
  }
  function mark(id) {
    openers.forEach(function (b) {
      var me = b.getAttribute('data-part') === id;
      b.setAttribute('aria-expanded', String(me));
      b.classList.toggle('is-on', me);
    });
    pins.forEach(function (b) { b.classList.toggle('is-off', !!id && mqWide.matches && b.getAttribute('data-part') !== id); });
  }
  function show(id, how) {
    var p = byId[id];
    if (!p) return;
    if (PN.intro && PN.intro.progress() < 1) PN.intro.progress(1);     /* a press during the intro: the finished drawing first */
    open = id;
    card.innerHTML = cardHTML(p);
    card.hidden = false;
    hero.classList.add('is-open');
    lit(id);
    mark(id);
    glide(partView(p), 0.75);
    if (!mqWide.matches) {                   /* phone and tablet: the drawing and the card in view together */
      var top = stage.getBoundingClientRect().top + window.pageYOffset - 8;
      if (Math.abs(window.pageYOffset - top) > 4) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (how === 'key') card.focus({ preventScroll: true });         /* keyboard: reading continues in the card */
  }
  function hide(refocus) {
    if (!open) return;
    var was = open;
    open = null;
    card.hidden = true;
    card.innerHTML = '';
    hero.classList.remove('is-open');
    lit(null);
    mark(null);
    glide(homeView(), 0.7);
    var back = (opener && opener.getAttribute('data-part') === was) ? opener : (mqWide.matches ? pinOf[was] : pickOf[was]);
    if (refocus && back) back.focus({ preventScroll: mqWide.matches });      /* phone: the name button comes into view */
  }
  card.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b || !open) return;
    var g = b.getAttribute('data-go');
    if (g === 'x') { hide(true); return; }
    var i = (byId[open].i + Number(g) + data.length) % data.length;
    opener = null;
    show(data[i].id, 'key');
  });

  /* ---- input: pins, name buttons, the drawing itself, Esc ---- */
  openers.forEach(function (b) {
    var id = b.getAttribute('data-part');
    b.addEventListener('click', function (e) {
      opener = b;
      if (open === id) { hide(false); return; }
      show(id, e.detail === 0 ? 'key' : 'pointer');
    });
    if (mqFine.matches) {
      b.addEventListener('mouseenter', function () { preview(id); });
      b.addEventListener('mouseleave', function () { preview(null); });
    }
    b.addEventListener('focus', function () { if (b.matches(':focus-visible')) preview(id); });
    b.addEventListener('blur', function () { preview(null); });
  });
  [].slice.call(svg.querySelectorAll('[data-hit]')).forEach(function (g) {
    var id = g.getAttribute('data-hit');
    if (!byId[id]) return;
    if (mqFine.matches) {
      g.addEventListener('mouseenter', function () { preview(id); });
      g.addEventListener('mouseleave', function () { preview(null); });
    }
    g.addEventListener('click', function (e) { e.stopPropagation(); opener = null; if (open !== id) show(id, 'pointer'); });
  });
  svg.addEventListener('click', function () { if (open) hide(false); });          /* a press on the empty drawing closes the card */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (PN.intro && PN.intro.progress() < 1) return;                          /* intro.js handles Esc while it plays */
    if (open) hide(true);
  });

  /* ---- layout changes ---- */
  function relayout() {
    measure();
    apply(open ? partView(byId[open]) : homeView());
    if (open) mark(open);
  }
  var rq = 0;
  window.addEventListener('resize', function () { cancelAnimationFrame(rq); rq = requestAnimationFrame(relayout); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placePins(); });
  measure();
  apply(homeView());
  PN.explore = { show: show, hide: hide, get open() { return open; } };
})();
