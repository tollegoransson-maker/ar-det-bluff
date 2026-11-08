# Källkod och tester

Härifrån byggs sajten i roten, alltså `index.html` och `app.js`. Allt körs med Node.js, utan några extra paket. Kör kommandona från repots rot.

## Filerna

- `parts/page.html`: sidans text, struktur och utseende.
- `parts/ui.js`: det som händer på sidan, till exempel flikarna, testet, delningen och skärmbildsläsningen.
- `ar-det-bluff.html`: hela sidan i en fil, i den version som används på claude.ai. Analysen av meddelandena, motorn, finns bara här, mellan `/*ENGINE-START*/` och `/*ENGINE-END*/`. Ändringar i motorn görs direkt i den här filen.
- `fonts/fonts.css`: typsnittsreglerna som byggs in i `index.html`. Själva typsnittsfilerna ligger i `fonts/` i roten.
- `sw-template.js`: mallen för `sw.js`, som sparar en kopia av sidan i telefonen så att den öppnas även utan uppkoppling.
- `bilder/`: källorna till affischen, delningsbilden och ikonerna, och en testbild för skärmbildsläsningen.
- `regress.cjs`, `regress-cases.cjs`, `regress-extra.cjs`, `test-engine.cjs` och `verify.cjs`: testerna.

## Bygga

```
node src/assemble.cjs src
node src/deploy-build.cjs src --poster
cp src/deploy/index.html src/deploy/app.js src/deploy/sw.js .
```

`assemble.cjs` bygger om `ar-det-bluff.html` från `parts/` och motorn. `deploy-build.cjs` gör webbversionen i `src/deploy/`, som inte sparas i git. Där byts Google Fonts mot sajtens egna typsnitt, och besöksräknaren, skärmbildsläsningen och kopian för användning utan uppkoppling kopplas på. `--poster` lägger till länken till `affisch.pdf`.

## Säkerhet och användning utan uppkoppling

- `index.html` har en säkerhetsregel (Content Security Policy) som gör att sidans skript bara får kontakta besöksräknaren och, för skärmbildsläsningen, jsDelivr. Löftet att den inklistrade texten aldrig lämnar enheten hålls alltså av webbläsaren själv. Lägger du till något som hämtas från en annan adress måste regeln i `deploy-build.cjs` ändras, annars stoppas det. Kontrollsumman för reservskriptet räknas ut automatiskt.
- Skärmbildsläsaren (`TESSERACT_SRI` i `parts/ui.js`) och besöksräknaren (`count.v5.js` i `deploy-build.cjs`) har kontrollsummor. Byts versionen räknas summan om med `curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`.
- `sw.js` sparar sidan, `app.js`, typsnitten och ikonen i telefonen. Varje bygge får ett nytt namn på kopian, så en ny version ersätter den gamla på en gång. Sidan hämtas alltid från nätet först, och kopian används bara utan uppkoppling eller om nätet inte har svarat på fyra sekunder.
- Startar inte `app.js` (en mycket gammal webbläsare eller en avbruten nedladdning) visar ett litet reservskript alla flikar efter varandra, så att stegen för den som har blivit lurad alltid går att läsa.

Skulle kopian i telefonerna behöva stängas av, publicera den här `sw.js` i stället. Den tar bort kopian och avregistrerar sig själv hos varje besökare som öppnar sidan:

```
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); })
    .then(function () { return self.registration.unregister(); }));
});
```

## Testa

Alla tre ska gå igenom innan något publiceras.

```
node src/regress.cjs src/ar-det-bluff.html
node src/test-engine.cjs src/ar-det-bluff.html
node src/verify.cjs src
```

- `regress.cjs` kör drygt 200 meddelanden. De flesta är realistiska bluffar och äkta meddelanden från granskningar (`regress-cases.cjs` och `regress-extra.cjs`), och vart och ett måste få rätt svar. Den kontrollerar också att de två råd som visas inte säger samma sak, och att analysen går snabbt. Med `-v` visas alla meddelanden.
- `test-engine.cjs` kör 54 meddelanden.
- `verify.cjs` gör drygt 35 kontroller av sidan: att exemplen och testfrågorna stämmer med verktyget, att telefonnumren ringer rätt, att texten har tillräcklig kontrast i ljust och mörkt läge och att alla länkar fungerar. Den behöver internet.

Telefonnumren i testerna är nummer som PTS och Ofcom har reserverat för påhittade sammanhang, så att inga riktiga personers nummer hamnar här. Använd sådana nummer i nya testfall också, till exempel 070-174 06 35 eller 08-465 004 56.

## Bilder

Affischen och delningsbilden görs med Chrome utan fönster. Byt `chrome` mot sökvägen till Chrome, på Windows oftast `"/c/Program Files/Google/Chrome/Application/chrome.exe"`. Chrome behöver fulla sökvägar både till filen som ska visas och till filen som ska skrivas, därför `$(pwd)`.

```
chrome --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 --print-to-pdf="$(pwd)/affisch.pdf" "$(pwd)/src/bilder/poster.html"
chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 --force-device-scale-factor=1 --virtual-time-budget=15000 --screenshot="$(pwd)/og.png" "$(pwd)/src/bilder/og.html"
```

QR-koden på affischen pekar på sajten med `?campaign=affisch`, så att besök via affischen syns för sig i besöksräknaren. Skanna den med mobilen efter varje ändring.

`bilder/icons.html` ritar ikonerna. `chrome --headless=new --dump-dom "$(pwd)/src/bilder/icons.html"` skriver ut dem som data-adresser i attributet `data-icons`. `bilder/sms.html` är en påhittad sms-skärmbild för att testa skärmbildsläsningen. Med `#dark` i slutet av adressen visas den i mörkt läge.

## Typsnitt

Typsnitten kommer från Google Fonts men ligger på sajten själv. Så byts de:

1. Hämta css-filen från Google Fonts-länken i `parts/page.html` med en webbläsares User-Agent, så att den pekar på woff2-filer, och spara den som `google.css`.
2. `node src/fonts-build.cjs google.css fonts` hämtar latin- och latin-ext-filerna till `fonts/` och skriver `fonts/fonts.css`.
3. Flytta `fonts/fonts.css` till `src/fonts/`, ta bort typsnittsfiler som inte används längre och lägg licensfilerna i `fonts/`.
4. Ändra filnamnen i `localFonts` i `deploy-build.cjs`, alltså de typsnitt som hämtas först, och bygg om.

## Byta adress

När sajten får en egen domän ska adressen ändras i:

- `deploy-build.cjs`: `SITE` och de två raderna med `SHARE_URL`. Raden som letas efter måste stämma exakt med raden i `parts/ui.js`.
- `parts/ui.js`: `SHARE_URL`.
- `regress.cjs`: `SITE`.
- `ar-det-bluff.html`: `OWN`, sajtens egna adresser, så att en länk till sajten inte varnar för sig själv. `ardetbluff.se` finns redan med.
- `bilder/poster.html`: adressen i QR-koden och adressen som står under den. Gör sedan om affischen.

Bygg sedan om, kör testerna och lägg till domänen i inställningarna för GitHub Pages.
