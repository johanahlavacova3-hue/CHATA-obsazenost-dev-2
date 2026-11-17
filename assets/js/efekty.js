/**
 * Chování stránky: mobilní menu, stín hlavičky po odscrollování, rok v patičce.
 */
(function () {
  'use strict';
  var tl = document.querySelector('.menu-tl');
  var menu = document.getElementById('menu');
  if (tl && menu) {
    var zavri = function () { tl.setAttribute('aria-expanded', 'false'); menu.classList.remove('menu--otevreno'); };
    tl.addEventListener('click', function () {
      var ot = tl.getAttribute('aria-expanded') === 'true';
      tl.setAttribute('aria-expanded', String(!ot));
      menu.classList.toggle('menu--otevreno', !ot);
    });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') zavri(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zavri(); });
  }

  var hl = document.querySelector('.hlavicka');
  var stin = function () { if (hl) hl.classList.toggle('hlavicka--stin', window.scrollY > 8); };
  window.addEventListener('scroll', stin, { passive: true });
  stin();

  // jemné vysunutí obsahu při posunu stránky
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var prvky = document.querySelectorAll('.list:not(.list--chata) .nadpis, .list .odstavec, .list .pilulka, .foto, .polozka, .plany, .cenik__chata, .cenik__cena, .cenik__pozn, .kontakt, .kalendar');
    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) { if (z.isIntersecting) { z.target.classList.add('je-videt'); io.unobserve(z.target); } });
    }, { threshold: 0.15 });
    Array.prototype.forEach.call(prvky, function (p, i) {
      p.classList.add('odhal');
      p.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(p);
    });
  }

  var rok = document.getElementById('rok');
  if (rok) rok.textContent = new Date().getFullYear();
})();
