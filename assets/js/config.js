/**
 * NASTAVENÍ STRÁNKY CHATA – vše, co se mění, je tady.
 */
window.CHATA = {
  // Apps Script webová aplikace (končí /exec). Prázdné = ukázková data v kalendáři.
  API_URL: 'https://script.google.com/macros/s/AKfycbxYRlzBt-bFQ3D_a-Wb77bN-PZoyXvg4f708GV5FkFtacL9IEvgMX6C21KSssCie_E7LQ/exec',
  OBNOVA_S: 60,          // jak často se kalendář obnovuje (s)
  MESICU_ZPET: 12,       // 1 rok zpátky
  MESICU_DOPREDU: 120,   // 10 let dopředu

  // Fotky v galerii – v tomhle pořadí. Nahraď vlastními (ideálně 2000 px na šířku).
  GALERIE: [
    { src: 'assets/img/galerie/05-okno.jpg', popis: 'Výhled z okna chaty' },
    { src: 'assets/img/galerie/01.jpg', popis: 'Chata zvenku' },
    { src: 'assets/img/galerie/02.jpg', popis: 'Okno s okenicemi' },
    { src: 'assets/img/galerie/03.jpg', popis: 'Chata na louce' },
    { src: 'assets/img/galerie/04.jpg', popis: 'Pohled z verandy' },
  ],
};
