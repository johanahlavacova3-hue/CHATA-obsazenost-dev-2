# Poutníci – stránka CHATA

Statická stránka (HTML + CSS + JS). 3D scéna používá three.js z CDN (jsDelivr).

```
index.html              stránka CHATA (5 listů: 3D půdorys, O Rábu, Vybavení, Fotky, Rezervace + Kalendář)
404.html                všechny ostatní položky menu (zatím)
assets/css/styles.css   vzhled – barvy a písma nahoře v :root
assets/js/config.js     ★ NASTAVENÍ – adresa Apps Scriptu, seznam fotek v galerii
assets/js/stranka.js    menu na mobilu, animace při scrollu
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

## Písma (Google Fonts)
Archivo (nadpisy), Bricolage Grotesque (titulky), Figtree (text), Lobster (logo).
Pokud máš v Figmě jiná, vyměň je v odkazu v `<head>` a v proměnných `--pismo-*`.

## Spuštění
Kvůli 3D (ES moduly) otevírej přes lokální server, ne dvojklikem: `npx serve .` nebo `python3 -m http.server`.
