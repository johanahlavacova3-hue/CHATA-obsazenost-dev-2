/**
 * APLIKACE – navigace mezi měsíci, pravidelné obnovování dat, stavové hlášky.
 */
(function (Chata) {
  'use strict';

  var MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen',
    'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

  var cfg = window.CHATA_CONFIG || {};
  var D = Chata.data;
  var el = function (id) { return document.getElementById(id); };

  var stav = {
    dnes: D.klicZData(new Date()),
    dny: null,          // obsazené dny, null = zatím nenačteno
    nacteno: false,
  };
  var zobrazeny = mesicZKlice(stav.dnes);

  function mesicZKlice(k) { return { r: +k.slice(0, 4), m: +k.slice(5, 7) - 1 }; }
  function index(m) { return m.r * 12 + m.m; }               // měsíc jako jedno číslo
  function zIndexu(i) { return { r: Math.floor(i / 12), m: i % 12 }; }
  function hranice() {
    var dnesI = index(mesicZKlice(stav.dnes));
    return { min: dnesI - (cfg.MESICU_ZPET || 12), max: dnesI + (cfg.MESICU_DOPREDU || 120) };
  }

  /* ---------- výběr měsíce a roku ---------- */

  function naplnVybery() {
    var h = hranice();
    var vm = el('vyberMesic'), vr = el('vyberRok');
    vm.textContent = ''; vr.textContent = '';
    MESICE.forEach(function (n, i) { vm.add(new Option(n, i)); });
    for (var r = zIndexu(h.min).r; r <= zIndexu(h.max).r; r++) vr.add(new Option(r, r));
  }

  function prejdi(i) {
    var h = hranice();
    zobrazeny = zIndexu(Math.min(h.max, Math.max(h.min, i)));
    prekresli();
  }

  function prekresli() {
    var h = hranice(), i = index(zobrazeny), dnesI = index(mesicZKlice(stav.dnes));
    if (el('vyberRok').options.length === 0 ||
        +el('vyberRok').options[0].value !== zIndexu(h.min).r) naplnVybery();
    el('vyberMesic').value = zobrazeny.m;
    el('vyberRok').value = zobrazeny.r;
    el('predchozi').disabled = i <= h.min;
    el('dalsi').disabled = i >= h.max;
    el('dnes').disabled = i === dnesI;
    Chata.kalendar.vykresli(el('mrizka'), zobrazeny, stav);
  }

  el('predchozi').addEventListener('click', function () { prejdi(index(zobrazeny) - 1); });
  el('dalsi').addEventListener('click', function () { prejdi(index(zobrazeny) + 1); });
  el('dnes').addEventListener('click', function () { prejdi(index(mesicZKlice(stav.dnes))); });
  el('vyberMesic').addEventListener('change', function () { prejdi(zobrazeny.r * 12 + +this.value); });
  el('vyberRok').addEventListener('change', function () { prejdi(+this.value * 12 + zobrazeny.m); });
  document.addEventListener('keydown', function (e) {
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') prejdi(index(zobrazeny) - 1);
    if (e.key === 'ArrowRight') prejdi(index(zobrazeny) + 1);
  });

  /* ---------- načítání dat ---------- */

  function obnov() {
    D.nacti(cfg).then(function (d) {
      if (D.platnyKlic(d.dnes)) stav.dnes = d.dnes;
      stav.dny = D.naDny(d.obsazeno);
      stav.nacteno = true;
      el('spolek').textContent = String(d.spolek || cfg.SPOLEK || '').slice(0, 80);
      el('chyba').classList.add('skryt');
      var cas = new Date(d.aktualizovano || Date.now());
      el('stav').textContent = (d.ukazka ? 'Ukázková data – v js/config.js doplň API_URL. ' : '') +
        'Aktualizováno ' + cas.getHours() + ':' + D.dvoj(cas.getMinutes()) + ', obnovuje se automaticky.';
      prekresli();
    }).catch(function () {
      el('chyba').textContent = stav.nacteno
        ? 'Nepodařilo se načíst nejnovější stav, zobrazuji poslední známý. Zkouším znovu…'
        : 'Obsazenost se teď nepodařilo načíst. Zkouším znovu…';
      el('chyba').classList.remove('skryt');
    });
  }

  el('spolek').textContent = cfg.SPOLEK || '';
  naplnVybery();
  prekresli();
  obnov();
  setInterval(function () { if (!document.hidden) obnov(); }, Math.max(20, cfg.OBNOVA_S || 60) * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) obnov(); });
})(window.Chata = window.Chata || {});
