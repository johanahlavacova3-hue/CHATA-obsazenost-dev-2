/**
 * NASTAVENÍ WEBU – jediný soubor, který je potřeba upravovat.
 */
window.CHATA_CONFIG = {
  // Adresa webové aplikace z Apps Scriptu (končí na /exec).
  // Prázdné = stránka ukazuje ukázková data.
  API_URL: 'https://script.google.com/macros/s/AKfycbxYRlzBt-bFQ3D_a-Wb77bN-PZoyXvg4f708GV5FkFtacL9IEvgMX6C21KSssCie_E7LQ/exec',

  // Název spolku, pokud by se nenačetl z tabulky.
  SPOLEK: 'Turistický oddíl',

  // Jak často se data obnovují (sekundy).
  OBNOVA_S: 60,

  // Kam jde listovat (v měsících od aktuálního měsíce).
  MESICU_ZPET: 12,      // 1 rok zpátky – tolik dat posílá i tabulka
  MESICU_DOPREDU: 120,  // 10 let dopředu
};
