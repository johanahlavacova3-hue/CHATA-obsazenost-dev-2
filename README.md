# Obsazenost chaty – veřejný web

Statická stránka s kalendářem obsazenosti. Data čte z Google Tabulky
(Apps Script webová aplikace) a ukazuje jen **volno / obsazeno** a název spolku.

## Struktura

```
index.html        – kostra stránky
css/styles.css    – vzhled (barvy nahoře v :root)
js/config.js      – NASTAVENÍ: adresa API, název spolku, rozsah listování
js/data.js        – načtení dat z Apps Scriptu (fetch, záložně JSONP)
js/kalendar.js    – vykreslení měsíce
js/app.js         – navigace, automatické obnovování, hlášky
```

## Nastavení

Vše v `js/config.js`:

- `API_URL` – adresa webové aplikace z Apps Scriptu (končí `/exec`). Prázdné = ukázková data.
- `SPOLEK` – záložní název, normálně se bere z tabulky (Nastavení → „Název spolku na webu“).
- `MESICU_ZPET` / `MESICU_DOPREDU` – rozsah listování (12 = rok zpátky, 120 = 10 let dopředu).
  Rok zpátky musí odpovídat `WEB_ROKU_ZPET` v Chata.gs.

## Bezpečnost

Z tabulky na web jde jen název spolku a souvislé bloky obsazených dnů.
Žádná jména, kontakty ani poznámky. Předběžné termíny se zobrazují jako obsazené.

## Nasazení

Stačí nahrát celou složku na libovolný statický hosting (GitHub Pages, Netlify,
hosting oddílového webu). Do jiného webu jde vložit přes:

```html
<iframe src="https://…/index.html" style="width:100%;height:760px;border:0"></iframe>
```
