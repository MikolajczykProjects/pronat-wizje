/* intro.js - the drawing draws itself (trigger grammar: it starts at once and never gates the content, which is readable from frame one).
 *
 * MOTION STORYBOARD (desktop, seconds from the moment the script runs; every number below is read back from PN.times / PN.fillT)
 *   reads in order: 1 "a drawing of a street, a plot and a house" -> 2 "these are pipes" -> 3 "blue = cold, red = hot, graphite =
 *   sewage, dashes = gas" -> 4 "and it is measured"
 *   0.15  ground line and soil hatching, left to right (pen 2400 u/s, hatching 3800 u/s, tick by tick)
 *   0.45  manhole and the three street mains in section (rings, pen 700 u/s)
 *   0.80  house in a drafter's order: street-side wall, the other wall 0.24 s later, floors bottom-up, roof, partitions, windows;
 *         hatching fades in 0.7 s (pen 1500 u/s)
 *   1.25  connections inked (water, gas as a faint ghost, sewer) - the ink always runs ahead of the water
 *   1.70  in-house pipes, outline + white inner together at pen 1000 u/s, each next one at 70 % of the previous; fixtures at 900 u/s
 *   1.90  COLD fills from the street main at 640 u/s (first 85 % linear, last 15 % decelerates); legend entry appears with the colour
 *   2.45  GAS dashes march from the main to the boiler (900 u/s, revealed through a mask)
 *   3.46  the boiler "lights" when gas and the cold feed have both arrived: HOT water and heating fill from it (red)
 *   3.56  SEWAGE runs from the fixtures down the stack and out to the street main (1200 u/s)
 *   4.06  dimensions: lines extend (1500 u/s), then arrows and letters
 *   5.22  end. Reduced motion, no script, a blocked CDN or any error here: the finished sheet, shown at once.
 * Vision 4 additions: the power cable is inked with the connections, the gas cabinet, power box, board and construction board
 * with the fixtures; each service's pin appears when its part is drawn (water connection with the cold fill, gas with the gas...).
 * Phone (< 700 px): the camera (PN.cam from explore.js, the SVG viewBox) starts at the street and glides to the house with the
 * water front; the house is drawn while it arrives (house 2.0 s, cold 2.0 s, end ~6.3 s). Tablets see the whole sheet, no glide.
 * A visible "Pomiń animację" button and Esc end it at once (WCAG 2.2 SC 2.2.2: moving content that starts by itself, over 5 s).
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var svg = document.getElementById('dom');
  var PN = (window.PN = window.PN || {});
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show() { root.classList.add('ready'); }
  if (!svg || !window.gsap || !window.DrawSVGPlugin || reduce) { show(); return; }
  if (window.performance && performance.now() > 2600) { show(); return; }   /* a very slow network: the CSS fail-safe has already shown the finished drawing, do not pull it apart again */
  function failSafe(err) {                              /* whatever goes wrong: the finished drawing, never a half-drawn one */
    try {
      if (typeof tl !== 'undefined' && tl) tl.kill();
      gsap.set(svg.querySelectorAll('path, circle, rect, g'), { clearProps: 'strokeDasharray,strokeDashoffset,opacity,fillOpacity,transform' });
    } catch (e) { /* nothing left to undo */ }
    root.classList.remove('playing');
    show();
    PN.introError = err && (err.stack || err.message);  /* read back by the page checks */
    if (window.console && console.warn) console.warn('pronat: intro skipped,', err && err.message);
  }
  try {
    gsap.registerPlugin(DrawSVGPlugin);

    /* ---- tokens (same numbers as the CSS custom properties) ---- */
    var EASE_OUT = 'power2.out';                         /* = cubic-bezier(.33,1,.68,1) */
    var PEN = { ground: 2400, hatch: 3800, struct: 1500, main: 700, conn: 1000, pipe: 1000, fix: 900, dim: 1500, duct: 900 };
    var WATER = { cold: 640, hot: 640, sew: 1200, gas: 900 };
    var narrow = window.matchMedia('(max-width: 699px)').matches && !!PN.cam;
    var T = narrow
      ? { house: 2.0, conn: 1.05, cold: 2.0, pan0: 1.75, pan1: 3.55 }
      : { house: 0.8, conn: 1.25, cold: 1.9 };

    var $ = function (sel, ctx) { return Array.prototype.slice.call((ctx || svg).querySelectorAll(sel)); };
    var layer = function (n) { return svg.querySelector('[data-l="' + n + '"]'); };
    var inLayer = function (n, sel) { var g = layer(n); return g ? $(sel || 'path', g) : []; };
    var len = function (el) { return el.getTotalLength(); };

    /* ---- collect pipes: id -> { po, pw, pc, gInk, gFill, sys, after, at, delay } ---- */
    var P = {};
    function pipe(id) { return (P[id] = P[id] || { id: id, kids: [] }); }
    $('.po[data-p]').forEach(function (el) { var p = pipe(el.dataset.p); p.po = el; p.sys = el.dataset.sys; p.after = el.dataset.after || null; p.at = +el.dataset.at || 0; });
    $('.pw[data-p]').forEach(function (el) { pipe(el.dataset.p).pw = el; });
    $('.pc[data-p]').forEach(function (el) { pipe(el.dataset.p).pc = el; });
    $('.gmask[data-p]').forEach(function (el) { var p = pipe(el.dataset.p); p.sys = 'gas'; p.after = el.dataset.after || null; p.at = +el.dataset.at || 0; p[el.dataset.m === 'ink' ? 'gInk' : 'gFill'] = el; });
    var ids = Object.keys(P);
    ids.forEach(function (id) {
      var p = P[id];
      p.L = len(p.po || p.gInk);
      if (p.after && P[p.after]) P[p.after].kids.push(p);
    });
    var overlap = { hret: 0.62 };                        /* the return starts when the supply has covered 62 % of its run (water already circulates) */

    /* ---- start poses ---- */
    var lines = [];
    ['ground', 'hatch', 'struct', 'struct2', 'struct3', 'win', 'mains', 'dims', 'duct', 'elec'].forEach(function (n) {
      inLayer(n, 'path').forEach(function (el) { if (!el.classList.contains('dd')) lines.push(el); });
    });
    var fixPaths = inLayer('fix', 'path.fx');
    var fillFix = fixPaths.filter(function (el) { return el.classList.contains('wf'); });
    var pipeInk = [], pipeCore = [], gasMasks = [];
    ids.forEach(function (id) { var p = P[id]; if (p.po) { pipeInk.push(p.po, p.pw); if (p.pc) pipeCore.push(p.pc); } if (p.gInk) gasMasks.push(p.gInk, p.gFill); });
    var hf = $('.hf'), fits = $('.ft'), texts = $('.tx, .ah'), mfills = $('.mfill'), dd = $('.dd'), mains = $('.mn');
    var winW = $('[data-l="win-w"] .wwf'), ductW = $('[data-l="duct-w"] .wwf');   /* white knock-outs: they grow with their window / duct */
    var KO = { b: '50% 100%', t: '50% 0%', l: '0% 50%', r: '100% 50%' };
    var pinEls = $('#pins .pin', document);
    var pinOf = function (id) { return pinEls.filter(function (b) { return b.getAttribute('data-part') === id; }); };
    var camFrom = narrow ? PN.cam.box(PN.cam.street) : null, camTo = narrow ? PN.cam.home() : null;

    gsap.set(lines.concat(fixPaths, pipeInk, pipeCore, gasMasks), { drawSVG: '0%' });
    gsap.set(fillFix, { fillOpacity: 0 });
    gsap.set(hf.concat(winW, fits, texts, dd), { opacity: 0 });
    ductW.forEach(function (r) { var o = r.getAttribute('data-o'); gsap.set(r, (o === 'l' || o === 'r') ? { scaleX: 0, transformOrigin: KO[o] } : { scaleY: 0, transformOrigin: KO[o] }); });
    gsap.set(mfills, { scale: 0, transformOrigin: '50% 50%' });
    gsap.set(pinEls, { autoAlpha: 0 });
    if (narrow) PN.cam.apply(camFrom);
    show();                                              /* start poses are set: now the sheet may be seen */

    /* ---- timeline helpers ---- */
    var tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onComplete: cleanup });
    var inkT = {};                                       /* pipe id -> { start, speed, end } for fittings and the water front */

    function pen(els, speed, at, gap, seq) {             /* constant pen speed: duration = length / speed */
      var t = at, end = at;
      els.forEach(function (el, i) {
        var d = Math.max(0.12, len(el) / speed), s = seq ? t : at + i * (gap || 0);
        tl.to(el, { drawSVG: '100%', duration: d }, s);
        t = s + d; if (s + d > end) end = s + d;
      });
      return end;
    }
    function ink(id, at, speed) {                        /* outline + white inner of one pipe, drawn together */
      var p = P[id], d = Math.max(0.12, p.L / speed);
      tl.to(p.gInk ? [p.gInk] : [p.po, p.pw], { drawSVG: '100%', duration: d }, at);
      inkT[id] = { start: at, speed: speed, end: at + d };
      return at + d;
    }
    function fixtureGroups(sel) { return $(sel || '.fxg', layer('fix')); }
    var isBody = function (el) { return el.classList.contains('wf'); };
    function drawFixtures(groups, at, gap) {   /* the whole outline first, then its details (no posts hanging under half a board) */
      var end = at;
      groups.forEach(function (g, i) {
        var s = at + i * gap, ps = $('path.fx', g), body = ps.filter(isBody), rest = ps.filter(function (el) { return !isBody(el); });
        var e1 = body.length ? pen(body, PEN.fix, s, 0.05) : s;
        var e = rest.length ? Math.max(e1, pen(rest, PEN.fix * 1.4, body.length ? e1 - 0.06 : s, 0.04)) : e1;
        body.forEach(function (el) { tl.to(el, { fillOpacity: 1, duration: 0.18 }, e1 - 0.1); });
        if (e > end) end = e;
      });
      return end;
    }
    function fade(els, at, dur, to) { tl.to(els, { opacity: to == null ? 1 : to, duration: dur || 0.25, ease: 'none' }, at); }

    /* ---- 1. ground, soil, street mains ---- */
    var gl = inLayer('ground', 'path').filter(function (el) { return !el.classList.contains('dd'); });
    pen(gl, PEN.ground, 0.15, 0.06);
    pen(inLayer('hatch', 'path'), PEN.hatch, 0.3, 0.14);
    fade(dd, 0.9, 0.4);
    var mainLines = inLayer('mains', 'path');
    var mEnd = pen(mainLines, PEN.main, 0.45, 0.1);

    /* ---- 2. house: walls, floors, roof, partitions, windows ---- */
    var H = T.house;
    var wallsEnd = pen(inLayer('struct', 'path'), PEN.struct, H, 0.24);      /* street-side wall first, the other a beat later (no twins) */
    var slabsEnd = pen(inLayer('struct2', 'path'), PEN.struct, H + 0.18, 0.1);   /* bottom floor first (document order) */
    var roofEnd = pen(inLayer('struct3', 'path'), 1300, H + 0.5, 0.08);
    var winEnd = pen(inLayer('win', 'path'), PEN.struct, H + 0.8, 0.09);
    winW.forEach(function (r, k) { fade(r, H + 0.8 + 2 * k * 0.09, 0.12); });   /* window k = paths 2k (lintel + sill) and 2k+1 (glazing): its cut opens as its lintel is drawn */
    fade(hf, H + 0.9, 0.7);

    /* ---- 3. connections (ink runs ahead of the water) ---- */
    var cAt = T.conn;
    var c0End = ink('c0', cAt, PEN.conn);
    var gEnd = ink('g0', cAt + 0.1, PEN.conn);
    var g1End = ink('g1', gEnd, PEN.conn);
    var sEnd = ink('scol', cAt + 0.15, 1400);
    var elEnd = pen(inLayer('elec', 'path'), PEN.conn * 1.3, cAt + 0.25, 0.08);   /* the power cable, a thin line, a little faster */

    /* ---- 4. in-house pipes, construction order, each next one at 70 % of the previous ---- */
    var order = ['c1', 'cb', 'hsup', 'hret', 'h1', 'cr', 'hsg', 'hrg', 'hs', 'cs1', 'cs2', 'cs3', 'sff', 'sbath', 'sst', 'sgf', 'sgs', 'svent'];
    var t = H + 0.9, last = t;
    order.forEach(function (id) {
      if (!P[id]) return;
      var e = ink(id, t, PEN.pipe);
      last = Math.max(last, e);
      t = t + Math.max(0.05, (e - t) * 0.3 + 0.03);
    });
    var pipesEnd = last;

    /* ---- 5. fixtures, equipment, ducts ---- */
    var fg = fixtureGroups();
    var byKind = function (re) { return fg.filter(function (g) { return re.test(g.getAttribute('data-sys') || ''); }); };
    var boiler = fg.filter(function (g) { return g.getAttribute('data-sys') === 'hot gas'; });
    var rads = fg.filter(function (g) { return g.getAttribute('data-sys') === 'hot'; });
    var wet = fg.filter(function (g) { return /cold/.test(g.getAttribute('data-sys') || ''); });
    var ventG = fg.filter(function (g) { return g.getAttribute('data-sys') === 'vent'; });
    var boxes = fg.filter(function (g) { return /^(gas|elec)$/.test(g.getAttribute('data-sys') || ''); });   /* cabinets, power box, board */
    var siteG = fg.filter(function (g) { return g.getAttribute('data-sys') === 'site'; });
    var fx0 = drawFixtures(boxes, H + 0.95, 0.12);
    var fx1 = drawFixtures(boiler, H + 1.1, 0.1);
    var fx2 = drawFixtures(rads, H + 1.3, 0.25);
    var fx3 = drawFixtures(wet, H + 1.5, 0.18);
    var fxSite = drawFixtures(siteG, H + 1.7, 0.1);
    var fxEnd = Math.max(fx0, fx1, fx2, fx3, fxSite);
    /* ventilation: the recuperator, then each duct grows out of it (both walls and the white knock-out together, so the
     * roof is cut only where the duct already is), a cap when its duct reaches the roof, the ceiling duct and its diffusers,
     * last the air conditioner: indoor unit, refrigerant lines through the wall, outdoor unit */
    var ductAt = H + 1.9;
    var dl = layer('duct');
    var recu = ventG.slice(0, 1), acIn = ventG.slice(1, 2), acOut = ventG.slice(2, 3);
    var rEnd = drawFixtures(recu, ductAt, 0);
    function duct(k, at) {
      var ws = $('.dg[data-d="' + k + '"] path', dl), ko = ductW.filter(function (r) { return r.getAttribute('data-d') === String(k); });
      if (!ws.length) return at;
      var d = Math.max(0.12, len(ws[0]) / PEN.duct);
      tl.to(ws, { drawSVG: '100%', duration: d }, at);
      if (ko.length) tl.to(ko, { scaleX: 1, scaleY: 1, duration: d }, at);
      var ar = $('path.air[data-d="' + k + '"]', dl).concat($('path[data-d="' + k + '"]:not(.air)', dl));
      if (ar.length) tl.to(ar, { drawSVG: '100%', duration: 0.25 }, at + d * 0.6);
      $('.cap[data-cap="' + k + '"] path', dl).forEach(function (c, i) { tl.to(c, { drawSVG: '100%', duration: 0.16 }, at + d + i * 0.06); });
      return at + d + 0.2;
    }
    var e1 = duct(1, rEnd - 0.08), e2 = duct(2, rEnd - 0.02), e3 = duct(3, rEnd - 0.08), e4 = duct(4, e3 - 0.15);
    var e5 = pen($('path[data-dif]', dl), PEN.fix, e4 - 0.35, 0.07);
    var e6 = drawFixtures(acIn, e4 - 0.2, 0);
    var e7 = pen($('path[data-ref]', dl), PEN.duct, e6 - 0.05, 0.06);
    var e8 = drawFixtures(acOut, e7 - 0.1, 0);
    var ductEnd = Math.max(e1, e2, e4, e5, e8);
    /* the sewer stack's roof cap: when the vent pipe under it has reached the roof */
    var capS = fg.filter(function (g) { return g.classList.contains('cap'); });
    drawFixtures(capS, inkT.svent ? inkT.svent.end : pipesEnd, 0);

    /* ---- 6. dimensions: lines extend, then arrows and letters ---- */
    var dAt = Math.max(pipesEnd + 0.2, ductAt + 0.6);
    var dEnd = pen(inLayer('dims', 'path'), PEN.dim, dAt, 0.12);
    fade($('.ah, .tx'), dAt + 0.5, 0.4);

    /* ---- 7. fittings (rings, valves, meter) appear as the pen passes them ---- */
    fits.forEach(function (g) {
      var p = P[g.dataset.p], i = p && inkT[p.id];
      var at = i ? i.start + (+g.dataset.at || 0) / i.speed + 0.03 : H + 2;
      tl.to(g, { opacity: 1, duration: 0.14, ease: 'none' }, at);
    });

    /* ---- 8. the media: water, heat, sewage and gas fill the pipes ---- */
    var fillT = {};                                       /* id -> { start, dur, end } */
    function waterEase(a) {                               /* a = share of the length covered linearly (85 %), then decelerating */
      var t1 = 1 / (1 + 3 * (1 - a) / a);                 /* the cubic ease-out starts at the speed the linear part ended with */
      return function (p) {
        if (p <= t1) return a * p / t1;
        var x = (p - t1) / (1 - t1);
        return a + (1 - a) * (1 - Math.pow(1 - x, 3));
      };
    }
    var EASE_W = waterEase(0.85), T1 = 1 / (1 + 3 * 0.15 / 0.85);
    function timeAt(f) {                                  /* share of the fill duration at which the front has covered share f */
      if (f <= 0.85) return T1 * f / 0.85;
      var y = Math.min(1, (f - 0.85) / 0.15);
      return T1 + (1 - T1) * (1 - Math.pow(1 - y, 1 / 3));
    }
    function fill(id, want) {                             /* schedules one pipe and then its branches; returns the end time */
      var p = P[id];
      var s = Math.max(want, inkT[id] ? inkT[id].end + 0.02 : 0);
      var dur = Math.max(0.2, p.L / WATER[p.sys]);
      tl.to(p.gFill ? p.gFill : p.pc, { drawSVG: '100%', duration: dur, ease: p.sys === 'gas' ? 'none' : EASE_W }, s);
      fillT[id] = { start: s, dur: dur, end: s + dur };
      var end = s + dur;
      if (p.kids) p.kids.forEach(function (k) {
        var f = Math.min(1, (k.at || 0) / p.L);
        var e = fill(k.id, overlap[k.id] != null ? s + dur * overlap[k.id] : s + dur * timeAt(f));
        if (e > end) end = e;
      });
      return end;
    }
    /* cold: ring of the water main fills, then the connection, meter, riser and branches */
    var mC = mains.filter(function (g) { return g.dataset.sys === 'cold'; })[0];
    var mS = mains.filter(function (g) { return g.dataset.sys === 'sew'; })[0];
    var mG = mains.filter(function (g) { return g.dataset.sys === 'gas'; })[0];
    var ringFill = function (g, at, d) { if (g) tl.to($('.mfill', g), { scale: 1, duration: d || 0.4, ease: EASE_OUT }, at); };
    ringFill(mC, T.cold - 0.35);
    var coldEnd = fill('c0', T.cold);
    /* gas: its line fills from the main to the boiler */
    var G0 = T.cold + 0.55;
    ringFill(mG, G0 - 0.25, 0.3);
    var gasEnd = fill('g0', G0);
    /* the boiler lights when gas and cold feed have both arrived; red leaves it */
    var gasAt = (fillT.g1 || fillT.g0).end;
    var hot0 = Math.max(gasAt, fillT.cb ? fillT.cb.end : 0) + 0.15;
    var hotEnd = Math.max(fill('h1', hot0), fill('hsup', hot0));
    /* sewage: after the water has reached the bath, waste runs down the stack and out to the street */
    var sew0 = Math.max(fillT.cr ? fillT.cr.end - 1.2 : 0, hot0 + 0.1);
    ringFill(mS, sew0 + 0.4, 0.5);
    var sewEnd = fill('sff', sew0);
    var mE = mains.filter(function (g) { return g.dataset.sys === 'elec'; })[0];
    ringFill(mE, cAt + 0.2, 0.3);
    var end = Math.max(coldEnd, gasEnd, hotEnd, sewEnd, dEnd);

    /* ---- 9. pins: each service's pin appears when its part is drawn or filled ---- */
    var pinAt = function (id, at) { var b = pinOf(id); if (b.length) tl.to(b, { autoAlpha: 1, duration: 0.4, ease: EASE_OUT }, at); };
    pinAt('conn', T.cold + 0.3); pinAt('elec', elEnd); pinAt('gas', G0 + 0.3); pinAt('water', fillT.cr ? fillT.cr.start + 0.4 : hot0);
    pinAt('heat', hot0 + 0.2); pinAt('vent', Math.max(e1, e2)); pinAt('site', fxSite);

    /* ---- 10. phone camera: from the street to the house, following the water front ---- */
    if (narrow) {
      var cam = { x: camFrom[0], y: camFrom[1], w: camFrom[2], h: camFrom[3] };
      tl.to(cam, { x: camTo[0], y: camTo[1], w: camTo[2], h: camTo[3], duration: T.pan1 - T.pan0, ease: 'power2.inOut',
        onUpdate: function () { PN.cam.apply([cam.x, cam.y, cam.w, cam.h]); } }, T.pan0);
    }

    /* the drawing is the finished sheet when the timeline ends: leave the DOM clean for focus, resize and printing */
    function cleanup() {
      gsap.set(fits, { clearProps: 'opacity' });                     /* fittings carry data-part: the focus dimming must not fight an inline opacity */
      gsap.set(ductW.concat(winW), { clearProps: 'transform,opacity' });
      gsap.set(fillFix, { clearProps: 'fillOpacity' });
      gsap.set(mfills, { clearProps: 'transform' });
      gsap.set(pinEls, { clearProps: 'opacity,visibility' });
      gsap.set(texts, { clearProps: 'opacity' });                    /* labels carry data-part too */
      if (narrow && !(PN.explore && PN.explore.open)) PN.cam.apply(PN.cam.home());
      root.classList.add('intro-done');
    }

    /* a way to stop it (WCAG 2.2.2: moving content that starts by itself and lasts over 5 s): a visible button and Esc */
    var skip = document.getElementById('skipanim');
    if (skip) skip.addEventListener('click', function () { tl.progress(1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tl.progress() < 1) tl.progress(1); });

    PN.intro = tl; PN.svg = svg; PN.P = P; PN.T = T;
    PN.fillT = fillT; PN.easeW = EASE_W;
    PN.times = { cold: T.cold, gas: G0, hot: hot0, sew: sew0, end: end, pipes: pipesEnd, house: [H, Math.max(wallsEnd, slabsEnd, roofEnd, winEnd)], dims: dEnd };
    root.classList.add('playing');
    tl.play(0);
    window.__intro = tl;
  } catch (err) { failSafe(err); }
})();
