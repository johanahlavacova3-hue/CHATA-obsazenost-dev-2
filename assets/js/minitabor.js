/**
 * Stránka MINITÁBOR: odpočet dní, velké číslo na šířku podle návrhu, zelená hlavička nad odpočtem, QR kód přihlášky.
 */
(function () {
  'use strict';
  var C = window.MINITABOR || {};
  var el = function (id) { return document.getElementById(id); };
  var plynule = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- odpočet ---------- */
  function datum(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dniDo(cil) { var d = new Date(); d.setHours(0, 0, 0, 0); return Math.round((cil - d) / 864e5); }
  function slovo(n) { return n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní'; }

  var start = datum(C.ZACATEK || '2027-07-31'), konec = datum(C.KONEC || C.ZACATEK || '2027-08-08');
  var n = dniDo(start), poKonci = dniDo(konec) < 0;
  var nad = el('odpocetNad'), cislo = el('odpocetDni'), sl = el('odpocetSlovo'), pod = el('odpocetPod');
  var cil = n;
  if (n > 0) { sl.textContent = slovo(n); }
  else if (!poKonci) { nad.textContent = 'Právě'; cislo.textContent = 'běží'; sl.textContent = ''; pod.textContent = 'Minitábor ' + start.getFullYear(); cil = null; }
  else { nad.textContent = 'Minitábor'; cislo.textContent = 'byl'; sl.textContent = 'super'; pod.textContent = 'těšíme se příště'; cil = null; }

  // termín v textu podle nastavení
  var mes = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  var t = el('terminText');
  if (t) t.textContent = start.getDate() + '. ' + mes[start.getMonth()] + ' – ' + konec.getDate() + '. ' + mes[konec.getMonth()] + ' ' + konec.getFullYear();
  if (el('odkazMapy') && C.MAPY_URL) el('odkazMapy').href = C.MAPY_URL;

  /* ---------- velké číslo: šířka jako v návrhu (1175 px z 1920) v jakémkoli písmu ---------- */
  var obal = el('odpocetCislo'), vnitrek = obal && obal.querySelector('.odpocet__vnitrek');
  function prizpusob() {
    if (!obal) return;
    var sirkaOkna = Math.min(window.innerWidth, 2400);
    var cilova = window.innerWidth >= 1100 ? sirkaOkna * 1175 / 1920 : window.innerWidth * 0.86;
    var pc = window.innerWidth >= 1100, u = sirkaOkna / 1920;
    var cilovaVyska = pc ? 560 * u : window.innerWidth * 0.5;      // ať náhradní (vyšší) písmo nepřeteče do textu nad a pod
    obal.style.fontSize = '100px';
    var r = vnitrek.getBoundingClientRect();
    var w = r.width || 1, h = r.height || 1;
    obal.style.fontSize = Math.min(100 * cilova / w, 100 * cilovaVyska / h) + 'px';
  }
  prizpusob();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(prizpusob);
  window.addEventListener('resize', prizpusob);

  // číslo se při prvním zobrazení „dopočítá“ (krátce, jen když je povolený pohyb)
  if (cil !== null) {
    if (plynule && 'IntersectionObserver' in window) {
      cislo.textContent = '0';
      var io = new IntersectionObserver(function (z) {
        if (!z[0].isIntersecting) return;
        io.disconnect();
        var t0 = performance.now(), T = 1100;
        (function krok(t) {
          var k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
          cislo.textContent = String(Math.round(cil * e));
          if (k < 1) requestAnimationFrame(krok);
        })(t0);
      }, { threshold: 0.3 });
      io.observe(obal);
    } else cislo.textContent = String(cil);
  }

  /* ---------- hlavička je zelená, dokud je pod ní zelený odpočet ---------- */
  var hl = document.querySelector('.hlavicka'), zelena = el('odpocet');
  function barvaHlavicky() {
    if (!hl || !zelena) return;
    var r = zelena.getBoundingClientRect();
    hl.classList.toggle('hlavicka--zelena', r.bottom > hl.offsetHeight / 2 && r.top <= hl.offsetHeight);
  }
  window.addEventListener('scroll', barvaHlavicky, { passive: true });
  window.addEventListener('resize', barvaHlavicky);
  barvaHlavicky();

  /* ---------- QR kód a tlačítko přihlášky ---------- */
  var odkaz = el('prihlaskaOdkaz'), qr = el('qr');
  if (C.PRIHLASKA_URL) {
    odkaz.href = C.PRIHLASKA_URL; odkaz.target = '_blank'; odkaz.rel = 'noopener';
    var kresli = function () {
      if (typeof window.qrcode !== 'function') return;
      var q = window.qrcode(0, 'M'); q.addData(C.PRIHLASKA_URL); q.make();
      qr.innerHTML = q.createSvgTag(1, 0);   // bez vlastního okraje – klidovou zónu tvoří světlé pozadí stránky
      qr.classList.add('qr--hotovo');
    };
    if (typeof window.qrcode === 'function') kresli(); else window.addEventListener('load', kresli);
  }
})();
