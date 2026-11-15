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

  var rok = document.getElementById('rok');
  if (rok) rok.textContent = new Date().getFullYear();
})();
