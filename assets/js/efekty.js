/**
 * EFEKTY STRÁNKY
 *  – mobilní menu, stín hlavičky
 *  – pilulka v menu, která klouže za kurzorem
 *  – nadpisy rozdělené na písmena: při odhalení se „nafouknou“ (osy wght/wdth písma Gamay)
 *    a pak reagují na kurzor – písmena u myši se roztahují do šířky
 *  – magnetické tlačítko
 *  – postupné odhalování při scrollu (třída .videt)
 */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var jemnyKurzor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- mobilní menu ---------- */
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

  /* ---------- stín hlavičky ---------- */
  var hl = document.querySelector('.hlavicka');
  var stin = function () { if (hl) hl.classList.toggle('hlavicka--stin', window.scrollY > 8); };
  window.addEventListener('scroll', stin, { passive: true });
  stin();

  /* ---------- pilulka v menu ---------- */
  var pilulka = document.querySelector('.menu__pilulka');
  if (menu && pilulka) {
    var aktivni = menu.querySelector('[aria-current="page"]');
    var najed = function (a, okamzite) {
      if (!a || getComputedStyle(pilulka).display === 'none') return;
      if (okamzite) pilulka.style.transition = 'none';
      pilulka.style.width = a.offsetWidth + 'px';
      pilulka.style.height = a.offsetHeight + 'px';
      pilulka.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      pilulka.style.opacity = '1';
      if (okamzite) { pilulka.offsetWidth; pilulka.style.transition = ''; }
    };
    if (aktivni) najed(aktivni, true); else pilulka.style.opacity = '0';
    $$('a', menu).forEach(function (a) {
      a.addEventListener('mouseenter', function () { najed(a); });
      a.addEventListener('focus', function () { najed(a); });
    });
    menu.addEventListener('mouseleave', function () { aktivni ? najed(aktivni) : (pilulka.style.opacity = '0'); });
    window.addEventListener('resize', function () { najed(aktivni, true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { najed(aktivni, true); });
  } else {
    doc.classList.add('no-pilulka');
  }

  /* ---------- nadpisy → písmena ---------- */
  var nadpisy = $$('.nadpis');
  nadpisy.forEach(function (h) {
    var text = h.textContent;
    h.setAttribute('aria-label', text);
    h.textContent = '';
    var i = 0;
    text.split(/(\s+)/).forEach(function (slovo) {
      if (!slovo) return;
      if (/^\s+$/.test(slovo)) { h.appendChild(document.createTextNode(' ')); return; }
      var obal = document.createElement('span');          // slovo se nesmí zlomit uprostřed
      obal.className = 'slovo';
      obal.setAttribute('aria-hidden', 'true');
      Array.from(slovo).forEach(function (z) {
        var s = document.createElement('span');
        s.className = 'pismeno';
        s.style.setProperty('--i', i++);
        s.textContent = z;
        obal.appendChild(s);
      });
      h.appendChild(obal);
    });
  });

  /* písmena u kurzoru se roztahují (jen myš, ne dotyk) */
  if (jemnyKurzor && !reduce) {
    var mys = { x: -9999, y: -9999 }, bezi = false;
    var stavy = new Map();     // span → aktuální rozšíření (0..1)
    window.addEventListener('pointermove', function (e) {
      mys.x = e.clientX; mys.y = e.clientY;
      if (!bezi) { bezi = true; requestAnimationFrame(krok); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { mys.x = mys.y = -9999; });

    var krok = function () {
      var pohyb = false;
      nadpisy.forEach(function (h) {
        if (!h.classList.contains('hotovo')) return;
        var r = h.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) return;
        var dosah = Math.max(140, r.height * 2.4);
        $$('.pismeno', h).forEach(function (p) {
          var b = p.getBoundingClientRect();
          var d = Math.hypot(b.left + b.width / 2 - mys.x, b.top + b.height / 2 - mys.y);
          var cil = Math.max(0, 1 - d / dosah);
          cil = cil * cil * (3 - 2 * cil);               // smoothstep
          var akt = stavy.get(p) || 0;
          var nove = akt + (cil - akt) * 0.16;
          if (Math.abs(nove - cil) > 0.002) pohyb = true; else nove = cil;
          if (nove !== akt) {
            stavy.set(p, nove);
            p.style.setProperty('--d', String(100 + nove * 25));
            p.style.setProperty('--w', String(900 - nove * 120));
          }
        });
      });
      if (pohyb) requestAnimationFrame(krok); else bezi = false;
    };
  }

  /* ---------- magnetické tlačítko ---------- */
  if (jemnyKurzor && !reduce) {
    $$('.magnet').forEach(function (b) {
      var vnitrek = b.firstElementChild;
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = 'translate(' + dx * 10 + 'px,' + dy * 8 + 'px)';
        if (vnitrek) vnitrek.style.transform = 'translate(' + dx * 6 + 'px,' + dy * 4 + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; if (vnitrek) vnitrek.style.transform = ''; });
    });
  }

  /* ---------- odhalování při scrollu ---------- */
  $$('.vybaveni, .kontakty').forEach(function (sk) {
    $$('.odhal', sk).forEach(function (el, i) { el.style.setProperty('--zpozdeni', (i * 0.07) + 's'); });
  });
  var odhal = function (el) {
    el.classList.add('videt');
    if (el.classList.contains('nadpis')) {
      var n = el.querySelectorAll('.pismeno').length;
      setTimeout(function () { el.classList.add('hotovo'); }, 1300 + n * 45);
    }
  };
  var prvky = $$('.odhal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) { if (z.isIntersecting) { odhal(z.target); io.unobserve(z.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    prvky.forEach(function (el) { io.observe(el); });
  } else {
    prvky.forEach(odhal);
  }

  var rok = document.getElementById('rok');
  if (rok) rok.textContent = new Date().getFullYear();
})();
