/**
 * Galerie: velká fotka + šipky + náhledy. Fotky se berou z CHATA.GALERIE (config.js).
 * Ovládání: šipky, klik na náhled, klávesy ← →, swipe na mobilu.
 */
(function () {
  'use strict';
  var fotky = (window.CHATA && window.CHATA.GALERIE) || [];
  var okno = document.getElementById('galerieOkno');
  var nahledy = document.getElementById('galerieNahledy');
  if (!okno || !fotky.length) return;

  var aktivni = 0;
  var velke = [], male = [];

  fotky.forEach(function (f, i) {
    var img = document.createElement('img');
    img.className = 'galerie__foto';
    img.src = f.src; img.alt = f.popis || '';
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    okno.appendChild(img); velke.push(img);

    var b = document.createElement('button');
    b.type = 'button'; b.className = 'nahled';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Fotka ' + (i + 1) + (f.popis ? ': ' + f.popis : ''));
    var m = document.createElement('img');
    m.src = f.src; m.alt = ''; m.loading = 'lazy';
    b.appendChild(m);
    b.addEventListener('click', function () { ukaz(i); });
    nahledy.appendChild(b); male.push(b);
  });

  function ukaz(i) {
    aktivni = (i + fotky.length) % fotky.length;
    velke.forEach(function (el, j) { el.classList.toggle('galerie__foto--aktivni', j === aktivni); });
    male.forEach(function (el, j) { el.setAttribute('aria-selected', String(j === aktivni)); });
    var n = male[aktivni];
    if (n && nahledy.scrollWidth > nahledy.clientWidth) {
      nahledy.scrollTo({ left: n.offsetLeft - (nahledy.clientWidth - n.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  document.getElementById('galeriePred').addEventListener('click', function () { ukaz(aktivni - 1); });
  document.getElementById('galerieDal').addEventListener('click', function () { ukaz(aktivni + 1); });

  var galerie = okno.parentElement;
  galerie.tabIndex = 0;
  galerie.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') ukaz(aktivni - 1);
    if (e.key === 'ArrowRight') ukaz(aktivni + 1);
  });

  // swipe
  var startX = null;
  galerie.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  galerie.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) ukaz(aktivni + (dx < 0 ? 1 : -1));
    startX = null;
  });

  ukaz(0);
})();
