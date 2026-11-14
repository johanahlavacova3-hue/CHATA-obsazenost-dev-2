/**
 * DATA – načtení obsazenosti z Apps Scriptu a převod na jednotlivé dny.
 * Ven se nedostane nic jiného než bloky { od, do } ve formátu RRRR-MM-DD.
 */
(function (Chata) {
  'use strict';

  var MAX_DNU_BLOKU = 4000; // pojistka proti nesmyslným datům

  function dvoj(n) { return (n < 10 ? '0' : '') + n; }
  function klic(r, m, d) { return r + '-' + dvoj(m + 1) + '-' + dvoj(d); }
  function klicZData(d) { return klic(d.getFullYear(), d.getMonth(), d.getDate()); }
  function platnyKlic(k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k); }

  /** Bloky { od, do } → množina obsazených dnů { 'RRRR-MM-DD': true }. */
  function naDny(bloky) {
    var dny = {};
    (bloky || []).forEach(function (b) {
      if (!b || !platnyKlic(b.od) || !platnyKlic(b.do)) return;
      var t = new Date(Date.UTC(+b.od.slice(0, 4), +b.od.slice(5, 7) - 1, +b.od.slice(8, 10)));
      for (var i = 0; i < MAX_DNU_BLOKU; i++) {
        var k = t.getUTCFullYear() + '-' + dvoj(t.getUTCMonth() + 1) + '-' + dvoj(t.getUTCDate());
        if (k > b.do) break;
        dny[k] = true;
        t.setUTCDate(t.getUTCDate() + 1);
      }
    });
    return dny;
  }

  function ukazkovaData(spolek) {
    var t = new Date();
    function pos(n) { var x = new Date(t); x.setDate(x.getDate() + n); return klicZData(x); }
    return {
      spolek: spolek, dnes: klicZData(t), aktualizovano: new Date().toISOString(), ukazka: true,
      obsazeno: [
        { od: pos(-40), do: pos(-37) }, { od: pos(-12), do: pos(-10) }, { od: pos(-3), do: pos(-2) },
        { od: pos(2), do: pos(4) }, { od: pos(9), do: pos(11) }, { od: pos(16), do: pos(17) },
        { od: pos(23), do: pos(30) }, { od: pos(41), do: pos(43) }, { od: pos(55), do: pos(58) },
        { od: pos(400), do: pos(407) },
      ],
    };
  }

  /** Záložní načtení přes <script>, když fetch narazí (např. na starém prohlížeči). */
  function nactiJsonp(url) {
    return new Promise(function (ok, chyba) {
      var jmeno = 'chataCb' + Date.now();
      var sc = document.createElement('script');
      function uklid() {
        try { delete window[jmeno]; } catch (e) { window[jmeno] = undefined; }
        if (sc.parentNode) sc.parentNode.removeChild(sc);
      }
      var casovac = setTimeout(function () { uklid(); chyba(new Error('timeout')); }, 15000);
      window[jmeno] = function (d) { clearTimeout(casovac); uklid(); ok(d); };
      sc.onerror = function () { clearTimeout(casovac); uklid(); chyba(new Error('jsonp')); };
      sc.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + jmeno + '&_=' + Date.now();
      document.head.appendChild(sc);
    });
  }

  /** Vrátí Promise s daty { spolek, dnes, aktualizovano, obsazeno:[{od,do}] }. */
  function nacti(cfg) {
    if (!cfg.API_URL) return Promise.resolve(ukazkovaData(cfg.SPOLEK));
    var url = cfg.API_URL + (cfg.API_URL.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now();
    return fetch(url, { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () { return nactiJsonp(cfg.API_URL); })
      .then(function (d) {
        if (!d || !Array.isArray(d.obsazeno)) throw new Error('Neplatná data');
        return d;
      });
  }

  Chata.data = { nacti: nacti, naDny: naDny, klic: klic, klicZData: klicZData, platnyKlic: platnyKlic, dvoj: dvoj };
})(window.Chata = window.Chata || {});
