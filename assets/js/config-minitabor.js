/**
 * NASTAVENÍ STRÁNKY MINITÁBOR – vše, co se mění, je tady.
 */
window.MINITABOR = {
  ZACATEK: '2027-07-31',          // první den tábora (odpočet běží do tohoto dne)
  KONEC: '2027-08-08',            // poslední den
  PRIHLASKA_URL: 'https://forms.gle/EDHBgMK3LBi7hWQQ7',   // předběžná přihláška (Google Form) – z něj se vytvoří QR kód a tlačítko
  MAPY_URL: 'https://mapy.cz/zakladni?source=coor&id=13.2833231%2C50.0531928&x=13.2833231&y=50.0531928&z=16',   // 50.0531928N, 13.2833231E
};

// Fotky v galerii (stejná komponenta jako na stránce Chata). Ideálně 2000 px na šířku.
// Teď jsou tu výřezy z návrhu – nahraď je originály.
window.CHATA = {
  GALERIE: [
    { src: 'assets/img/minitabor/galerie-01.jpg', popis: 'Hra na louce u chaty' },
    { src: 'assets/img/minitabor/galerie-02.jpg', popis: 'Děti s vedoucím' },
    { src: 'assets/img/minitabor/galerie-03.jpg', popis: 'U ohniště' },
    { src: 'assets/img/minitabor/galerie-04.jpg', popis: 'Hledání pokladu' },
    { src: 'assets/img/minitabor/galerie-05.jpg', popis: 'Štípání dřeva' },
  ],
};
