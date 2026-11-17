# Poutníci – stránka CHATA

Statická stránka (HTML + CSS + JS). 3D scéna používá three.js z CDN (jsDelivr).

```
index.html              stránka CHATA (5 listů: 3D půdorys, O Rábu, Vybavení, Fotky, Rezervace + Kalendář)
404.html                všechny ostatní položky menu (zatím)
assets/css/styles.css   vzhled – barvy a písma nahoře v :root
assets/js/config.js     ★ NASTAVENÍ – adresa Apps Scriptu, seznam fotek v galerii
assets/js/efekty.js     mobilní menu, stín hlavičky
assets/js/galerie.js    galerie se šipkami, náhledy, swipe
assets/js/kalendar.js   kalendář obsazenosti (data z Google Tabulky)
assets/js/scena3d.js    3D louka s chatou v řezu (statická, otáčí se tažením) – tvar chaty v poli STENY
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
Nadpisy a titulky = Gamay Condensed (osa šířky 75), text = Gamay Regular (400).
Dokud je ADOBE_KIT prázdné, používá se náhradní Archivo (Google Fonts). Logo: Lobster.

## Spuštění
Kvůli 3D (ES moduly) otevírej přes lokální server, ne dvojklikem: `npx serve .` nebo `python3 -m http.server`.

## Rozestupy
Na počítači je vše v jednotkách `--u` = 1 px návrhu (frame 1920 px), takže rozestupy odpovídají Figmě
na jakékoli šířce. Pod 1100 px tablet, pod 700 px mobil – vlastní rozvržení.

## 3D model chaty

Scéna (`assets/js/scena3d.js`) zobrazuje skutečný pozemek z Blenderu: terén, chatu, ohniště a potok.
- **Slunce a obloha** se počítají podle skutečného času a polohy (`GPS` v config.js). Plech, sklo a voda odrážejí oblohu.
- **Roční období:** mění se barva trávy a listí. Sníh se bere ze skutečného počasí (open-meteo.com). Když počasí není dostupné, padá od poloviny prosince do konce února.
- **Noc:** svítí okna a ohniště (to jen v létě).
- **Pohledy:** Z dronu, Podkroví a Přízemí. Patra se odříznou vodorovným řezem a stěny v řezu jsou černé.

### Nová verze modelu z Blenderu
1. Export: **glTF Binary (.glb)**, „+Y Up“ zapnuto, „Apply Modifiers“ zapnuto.
2. Spusť převod:
   ```
   cd nastroje
   npm install            # jen poprvé
   node priprav-model.mjs ~/Downloads/chata_POZEMEK.glb ../assets/3d
   ```
3. Skript vytvoří `assets/3d/chata.glb` (zhruba 2 MB), `pozemek.json` a `trava.webp`.

Co skript dělá:
- Terén (materiál „Material“) převede na výškovou mapu.
- Koule stromů („Material.002“) nahradí stromy, které vykreslí web.
- Když je chata v souboru dvakrát, nechá tu, která stojí na terénu.
- Normálové mapy převede z DirectX na OpenGL a nastaví jim sílu 1.
- Dřevo přebarví na smrk v medové lazuře, střechu na antracitový plech a sklo udělá průhledné (podle fotek chaty).
- Textury zmenší na 1024 / 512 px ve WebP a geometrii zkomprimuje meshoptem.

Výšku podlahy podkroví nastavíš v config.js (`PODKROVI_NAD_PODLAHOU`).

Náhled jiného času: `index.html?cas=2027-01-15T21:30&snih=1`
