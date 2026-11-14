/**
 * KALENDÁŘ – vykreslení jednoho měsíce do mřížky.
 */
(function (Chata) {
  'use strict';

  var MESICE_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
    'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

  /**
   * @param {HTMLElement} mrizka   kontejner pro dny
   * @param {{r:number, m:number}} mesic  zobrazený rok a měsíc (0–11)
   * @param {{dnes:string, dny:Object|null}} stav  dnešní den a obsazené dny (null = načítá se)
   */
  function vykresli(mrizka, mesic, stav) {
    var klic = Chata.data.klic;
    var posun = (new Date(mesic.r, mesic.m, 1).getDay() + 6) % 7; // pondělí = 0
    var dnuVMesici = new Date(mesic.r, mesic.m + 1, 0).getDate();
    var frag = document.createDocumentFragment();

    for (var i = 0; i < posun; i++) {
      var prazdny = document.createElement('div');
      prazdny.className = 'den den--prazdny';
      prazdny.setAttribute('aria-hidden', 'true');
      frag.appendChild(prazdny);
    }

    for (var d = 1; d <= dnuVMesici; d++) {
      var k = klic(mesic.r, mesic.m, d);
      var minule = k < stav.dnes;
      var dnes = k === stav.dnes;
      var obsazeno = stav.dny ? !!stav.dny[k] : null;

      var tridy = ['den'];
      var text = '';
      if (obsazeno === null) { tridy.push('den--nacita'); text = '…'; }
      else if (obsazeno) { tridy.push('den--obsazeno'); text = 'obsazeno'; }
      else { tridy.push('den--volno'); text = 'volno'; }
      if (minule) tridy.push('den--minule');
      if (dnes) tridy.push('den--dnes');

      var bunka = document.createElement('div');
      bunka.className = tridy.join(' ');
      bunka.setAttribute('role', 'gridcell');
      bunka.setAttribute('aria-label', d + '. ' + MESICE_GEN[mesic.m] +
        (obsazeno === null ? '' : ': ' + text) + (dnes ? ', dnes' : '') + (minule ? ', uplynulý den' : ''));

      var cislo = document.createElement('span');
      cislo.className = 'den__cislo';
      cislo.textContent = d;
      var popis = document.createElement('span');
      popis.className = 'den__stav';
      popis.textContent = text;

      bunka.appendChild(cislo);
      bunka.appendChild(popis);
      frag.appendChild(bunka);
    }

    mrizka.textContent = '';
    mrizka.appendChild(frag);
  }

  Chata.kalendar = { vykresli: vykresli };
})(window.Chata = window.Chata || {});
