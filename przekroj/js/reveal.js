/* reveal.js - things come alive when they come into view: the pipe run fills with water fitting by fitting, groups marked
 * data-rv rise in one after another, a service figure's pipes fill from their source. IntersectionObserver with the
 * implicit root watches the TOP-LEVEL viewport, so inside a canvas board it waits until the board is panned into view.
 * Content is there without it (no script, no observer, reduced motion): only the fittings' pop and the water wait.
 * Shared: the vision 4 site loads this file; the canvas boards of visions 1, 3 and 4 inline it (szkice/runda3/common.py). */
(function () {
  'use strict';
  var d = document.documentElement;
  if (d.getAttribute('data-rv-on')) return;              /* a board may mount twice */
  d.setAttribute('data-rv-on', '1');
  d.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var groups = [].slice.call(document.querySelectorAll('.run, [data-rv]'));
  var figs = [].slice.call(document.querySelectorAll('.fig'));
  function fill(fig) {                                     /* the figure's water, heat and sewage run from their source */
    var svg = fig.querySelector('svg:not([hidden])');
    [].slice.call(fig.querySelectorAll('svg')).forEach(function (s) { if (s.getBoundingClientRect().width > 0) svg = s; });
    if (svg && svg.animate && !reduce) {
      [].slice.call(svg.querySelectorAll('.pc, .gmask[data-m="fill"]')).forEach(function (el, i) {
        var L = Math.ceil(el.getTotalLength ? el.getTotalLength() : 0);
        if (!L) return;
        el.animate([{ strokeDasharray: L + ' ' + L, strokeDashoffset: L }, { strokeDasharray: L + ' ' + L, strokeDashoffset: 0 }],
          { duration: Math.max(600, L / 640 * 1000), delay: 200 + i * 110, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'backwards' });
      });
    }
    fig.classList.add('in');
  }
  function show(el) { if (el.classList.contains('fig')) fill(el); else el.classList.add('in'); }
  if (reduce || !('IntersectionObserver' in window)) { groups.concat(figs).forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); show(x.target); } });
  }, { threshold: 0.15 });
  groups.concat(figs).forEach(function (el) { io.observe(el); });
})();
