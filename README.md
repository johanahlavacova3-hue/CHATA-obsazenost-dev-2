# Poutníci – stránka CHATA

Statická stránka (HTML + CSS + JS). 3D scéna používá three.js z CDN (jsDelivr).

```
index.html              stránka CHATA (5 listů: 3D půdorys, O Rábu, Vybavení, Fotky, Rezervace + Kalendář)
404.html                všechny ostatní položky menu (zatím)
assets/css/styles.css   vzhled – barvy a písma nahoře v :root
assets/js/config.js     ★ NASTAVENÍ – adresa Apps Scriptu, seznam fotek v galerii
assets/js/efekty.js     menu, pilulka v menu, „nafukovací“ nadpisy, magnet, odhalování při scrollu
assets/js/galerie.js    galerie se šipkami, náhledy, swipe
assets/js/kalendar.js   kalendář obsazenosti (data z Google Tabulky)
assets/js/scena3d.js    3D louka s chatou v řezu (půdorys) – tvar chaty v poli STENY
assets/img/             fotky (zatím výřezy z návrhu – nahraď originály)
```

## Co vyměnit
- `assets/img/o-rabu.jpg` a `assets/img/galerie/*` – teď jsou to výřezy ze screenshotu návrhu, náhledy
  galerie mají nízké rozlišení. Dej originály (ideálně ~2000 px na šířku) a uprav seznam v `config.js`.
- Texty „Lorem ipsum“ a kontakty v `index.html`.
- Šedé čtverce (`polozka__obr`, `kontakt__foto`) → `<img>`.

## Písmo Gamay (Adobe Fonts)
1. fonts.adobe.com → Gamay → „Add to Web Project“ (vyber i Variable, kvůli animacím šířky/tloušťky).
2. Do projektu přidej doménu webu (a `localhost` pro testování).
3. ID projektu vlož do `ADOBE_KIT` v `<head>` souboru `index.html` i `404.html`.
4. Pokud Adobe ukáže jiný název rodiny než `gamay-variable`, přepiš ho v `--pismo` ve `styles.css`.
Dokud je ADOBE_KIT prázdné, používá se náhradní Archivo (Google Fonts). Logo: Lobster.

## Spuštění
Kvůli 3D (ES moduly) otevírej přes lokální server, ne dvojklikem: `npx serve .` nebo `python3 -m http.server`.

## Rozestupy
Na počítači je vše v jednotkách `--u` = 1 px návrhu (frame 1920 px), takže rozestupy odpovídají Figmě
na jakékoli šířce. Pod 1100 px tablet, pod 700 px mobil – vlastní rozvržení.
