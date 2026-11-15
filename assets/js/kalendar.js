/**
 * Kalendář obsazenosti – čte z Apps Scriptu jen bloky obsazených dnů (žádná jména).
 * Mřížka má vždy 6 týdnů (jako v návrhu), dny sousedních měsíců jsou šedé.
 */
(function () {
  'use strict';
  var cfg = window.CHATA || {};
  var MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  var MESICE_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  var el = function (id) { return document.getElementById(id); };
  if (!el('kalMrizka')) return;

  function dvoj(n) { return (n < 10 ? '0' : '') + n; }
  function klicZData(d) { return d.getFullYear() + '-' + dvoj(d.getMonth() + 1) + '-' + dvoj(d.getDate()); }
  function platny(k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k); }

  var stav = { dnes: klicZData(new Date()), dny: null, nacteno: false };
  var zobrazeny = mesicZKlice(stav.dnes);

  function mesicZKlice(k) { return { r: +k.slice(0, 4), m: +k.slice(5, 7) - 1 }; }
  function index(m) { return m.r * 12 + m.m; }
  function zIndexu(i) { return { r: Math.floor(i / 12), m: ((i % 12) + 12) % 12 }; }
  function hranice() {
    var d = index(mesicZKlice(stav.dnes));
    return { min: d - (cfg.MESICU_ZPET || 12), max: d + (cfg.MESICU_DOPREDU || 120) };
  }

  /* bloky {od,do} → množina obsazených dnů */
  function naDny(bloky) {
    var dny = {};
    (bloky || []).forEach(function (b) {
      if (!b || !platny(b.od) || !platny(b.do)) return;
      var t = new Date(Date.UTC(+b.od.slice(0, 4), +b.od.slice(5, 7) - 1, +b.od.slice(8, 10)));
      for (var i = 0; i < 4000; i++) {
        var k = t.getUTCFullYear() + '-' + dvoj(t.getUTCMonth() + 1) + '-' + dvoj(t.getUTCDate());
        if (k > b.do) break;
        dny[k] = true;
        t.setUTCDate(t.getUTCDate() + 1);
      }
    });
    return dny;
  }

  /* ---------- vykreslení ---------- */
  function vykresli() {
    var r = zobrazeny.r, m = zobrazeny.m;
    el('kalMesic').textContent = MESICE[m].toUpperCase() + ' ' + r;

    var posun = (new Date(r, m, 1).getDay() + 6) % 7;     // pondělí = 0
    var start = new Date(r, m, 1 - posun);
    var frag = document.createDocumentFragment();

    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var k = klicZData(d);
      var vMesici = d.getMonth() === m;
      var obs = stav.dny ? !!stav.dny[k] : null;
      var text = obs === null ? '' : (obs ? 'Obsazeno' : 'Volno');

      var tridy = ['den'];
      if (!vMesici) tridy.push('den--mimo');
      else if (obs === null) tridy.push('den--nacita');
      else tridy.push(obs ? 'den--obsazeno' : 'den--volno');
      if (vMesici && k < stav.dnes) tridy.push('den--minule');
      if (k === stav.dnes && vMesici) tridy.push('den--dnes');

      var bunka = document.createElement('div');
      bunka.className = tridy.join(' ');
      bunka.setAttribute('role', 'gridcell');
      bunka.setAttribute('aria-label', d.getDate() + '. ' + MESICE_GEN[d.getMonth()] + (text ? ': ' + text.toLowerCase() : '') +
        (k === stav.dnes ? ', dnes' : ''));
      if (!vMesici) bunka.setAttribute('aria-hidden', 'true');

      var c = document.createElement('span'); c.className = 'den__cislo'; c.textContent = d.getDate();
      var s = document.createElement('span'); s.className = 'den__stav'; s.textContent = text;
      bunka.appendChild(c); bunka.appendChild(s);
      frag.appendChild(bunka);
    }
    el('kalMrizka').textContent = '';
    el('kalMrizka').appendChild(frag);

    var h = hranice(), idx = index(zobrazeny);
    el('kalPred').disabled = idx <= h.min;
    el('kalDal').disabled = idx >= h.max;
    el('kalDnes').disabled = idx === index(mesicZKlice(stav.dnes));
  }

  function prejdi(i) {
    var h = hranice();
    i = Math.min(h.max, Math.max(h.min, i));
    zobrazeny = zIndexu(i);
    vykresli();
  }

  el('kalPred').addEventListener('click', function () { prejdi(index(zobrazeny) - 1); });
  el('kalDal').addEventListener('click', function () { prejdi(index(zobrazeny) + 1); });
  el('kalDnes').addEventListener('click', function () { prejdi(index(mesicZKlice(stav.dnes))); });

  // swipe po kalendáři na mobilu
  var mriz = el('kalMrizka'), sx = null;
  mriz.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  mriz.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) prejdi(index(zobrazeny) + (dx < 0 ? 1 : -1));
    sx = null;
  });

  /* ---------- data ---------- */
  function ukazka() {
    function pos(n) { var x = new Date(); x.setDate(x.getDate() + n); return klicZData(x); }
    return { dnes: klicZData(new Date()), aktualizovano: new Date().toISOString(), ukazka: true,
      obsazeno: [{ od: pos(-9), do: pos(-7) }, { od: pos(4), do: pos(6) }, { od: pos(18), do: pos(20) }, { od: pos(32), do: pos(36) }] };
  }

  function jsonp(url) {
    return new Promise(function (ok, chyba) {
      var jmeno = 'chataCb' + Date.now();
      var sc = document.createElement('script');
      function uklid() { try { delete window[jmeno]; } catch (e) { window[jmeno] = undefined; } if (sc.parentNode) sc.parentNode.removeChild(sc); }
      var t = setTimeout(function () { uklid(); chyba(new Error('timeout')); }, 15000);
      window[jmeno] = function (d) { clearTimeout(t); uklid(); ok(d); };
      sc.onerror = function () { clearTimeout(t); uklid(); chyba(new Error('jsonp')); };
      sc.src = url + '&callback=' + jmeno;
      document.head.appendChild(sc);
    });
  }

  function nacti() {
    if (!cfg.API_URL) return Promise.resolve(ukazka());
    var url = cfg.API_URL + '?data=obsazenost&_=' + Date.now();
    return fetch(url, { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () { return jsonp(url); });
  }

  function obnov() {
    nacti().then(function (d) {
      if (!d || !Array.isArray(d.obsazeno)) throw new Error('data');
      var bylo = JSON.stringify(stav.dny);
      if (platny(d.dnes)) stav.dnes = d.dnes;
      stav.dny = naDny(d.obsazeno);
      stav.nacteno = true;
      el('kalChyba').classList.add('skryt');
      var cas = new Date(d.aktualizovano || Date.now());
      el('kalStav').textContent = (d.ukazka ? 'Ukázková data – v assets/js/config.js doplň API_URL. ' : '') +
        'Aktualizováno ' + cas.getHours() + ':' + dvoj(cas.getMinutes()) + '.';
      if (bylo !== JSON.stringify(stav.dny)) vykresli();   // překresli jen při změně
    }).catch(function () {
      el('kalChyba').textContent = stav.nacteno
        ? 'Nepodařilo se načíst nejnovější stav, ukazuji poslední známý. Zkouším znovu…'
        : 'Obsazenost se teď nepodařilo načíst. Zkouším znovu…';
      el('kalChyba').classList.remove('skryt');
    });
  }

  vykresli();
  obnov();
  setInterval(function () { if (!document.hidden) obnov(); }, Math.max(20, cfg.OBNOVA_S || 60) * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) obnov(); });
})();
