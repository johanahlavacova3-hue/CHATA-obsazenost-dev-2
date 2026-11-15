/**
 * Galerie: velká fotka, šipky, náhledy.
 * Ovládání: šipky, náhledy, klávesy ← →, swipe. Fotky se berou z CHATA.GALERIE (config.js).
 */
(function () {
  'use strict';
  var fotky = (window.CHATA && window.CHATA.GALERIE) || [];
  var okno = document.getElementById('galerieOkno');
  var nahledy = document.getElementById('galerieNahledy');
  if (!okno || !fotky.length) return;

  var aktivni = -1, velke = [], male = [];
  document.getElementById('galerieCelkem').textContent = fotky.length;

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
    b.addEventListener('click', function () { ukaz(i, i > aktivni ? 1 : -1); });
    nahledy.appendChild(b); male.push(b);
  });

  function ukaz(i) {
    i = (i + fotky.length) % fotky.length;
    aktivni = i;
    velke.forEach(function (el, j) { el.classList.toggle('galerie__foto--aktivni', j === i); });
    male.forEach(function (el, j) { el.setAttribute('aria-selected', String(j === i)); });
    document.getElementById('galerieCislo').textContent = i + 1;
    var n = male[i];
    if (nahledy.scrollWidth > nahledy.clientWidth) nahledy.scrollLeft = n.offsetLeft - (nahledy.clientWidth - n.offsetWidth) / 2;
  }

  document.getElementById('galeriePred').addEventListener('click', function () { ukaz(aktivni - 1, -1); });
  document.getElementById('galerieDal').addEventListener('click', function () { ukaz(aktivni + 1, 1); });

  var galerie = okno.parentElement;
  galerie.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') ukaz(aktivni - 1, -1);
    if (e.key === 'ArrowRight') ukaz(aktivni + 1, 1);
  });
  var sx = null;
  galerie.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  galerie.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) ukaz(aktivni + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    sx = null;
  });

  ukaz(0, 1);
})();
