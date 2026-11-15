/**
 * Společné chování stránky: mobilní menu, stín hlavičky, animace při scrollu.
 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  /* mobilní menu */
  var tl = document.querySelector('.menu-tl');
  var menu = document.getElementById('menu');
  if (tl && menu) {
    function zavri() { tl.setAttribute('aria-expanded', 'false'); menu.classList.remove('menu--otevreno'); }
    tl.addEventListener('click', function () {
      var ot = tl.getAttribute('aria-expanded') === 'true';
      tl.setAttribute('aria-expanded', String(!ot));
      menu.classList.toggle('menu--otevreno', !ot);
    });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') zavri(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zavri(); });
  }

  /* stín hlavičky po odscrollování */
  var hl = document.querySelector('.hlavicka');
  function stin() { if (hl) hl.classList.toggle('hlavicka--stin', window.scrollY > 8); }
  window.addEventListener('scroll', stin, { passive: true });
  stin();

  /* postupné odhalování prvků – nadpis se „vysouvá“ z vnitřního obalu */
  Array.prototype.forEach.call(document.querySelectorAll('.nadpis.odhal'), function (h) {
    var s = document.createElement('span');
    s.className = 'nadpis__vnitrek';
    while (h.firstChild) s.appendChild(h.firstChild);
    h.appendChild(s);
  });
  var prvky = document.querySelectorAll('.odhal');
  // prvky ve stejné skupině dostanou malé zpoždění za sebou
  Array.prototype.forEach.call(document.querySelectorAll('.vybaveni, .kontakty'), function (sk) {
    Array.prototype.forEach.call(sk.querySelectorAll('.odhal'), function (el, i) { el.style.setProperty('--zpozdeni', (i * 0.08) + 's'); });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (z.isIntersecting) { z.target.classList.add('videt'); io.unobserve(z.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(prvky, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(prvky, function (el) { el.classList.add('videt'); });
  }

  var rok = document.getElementById('rok');
  if (rok) rok.textContent = new Date().getFullYear();
})();
