# Källkod och tester

Härifrån byggs sajten i roten, alltså `index.html` och `app.js`. Allt körs med Node.js, utan några extra paket. Kör kommandona från repots rot.

## Filerna

- `parts/page.html`: sidans text, struktur och utseende.
- `parts/ui.js`: det som händer på sidan, till exempel flikarna, testet, delningen och skärmbildsläsningen.
- `ar-det-bluff.html`: hela sidan i en fil, i den version som används på claude.ai. Analysen av meddelandena, motorn, finns bara här, mellan `/*ENGINE-START*/` och `/*ENGINE-END*/`. Ändringar i motorn görs direkt i den här filen.
- `fonts/fonts.css`: typsnittsreglerna som byggs in i `index.html`. Själva typsnittsfilerna ligger i `fonts/` i roten.
- `bilder/`: källorna till affischen, delningsbilden och ikonerna, och en testbild för skärmbildsläsningen.
- `regress.cjs`, `regress-cases.cjs`, `test-engine.cjs` och `verify.cjs`: testerna.

## Bygga

```
node src/assemble.cjs src
node src/deploy-build.cjs src --poster
cp src/deploy/index.html src/deploy/app.js .
```

`assemble.cjs` bygger om `ar-det-bluff.html` från `parts/` och motorn. `deploy-build.cjs` gör webbversionen i `src/deploy/`, som inte sparas i git. Där byts Google Fonts mot sajtens egna typsnitt, och besöksräknaren och skärmbildsläsningen kopplas på. `--poster` lägger till länken till `affisch.pdf`.

## Testa

Alla tre ska gå igenom innan något publiceras.

```
node src/regress.cjs src/ar-det-bluff.html
node src/test-engine.cjs src/ar-det-bluff.html
node src/verify.cjs src
```

- `regress.cjs` gör 119 kontroller. De flesta är realistiska bluffar och äkta meddelanden från en granskning, och vart och ett måste få rätt svar. Den mäter också att analysen går snabbt. Med `-v` visas alla meddelanden.
- `test-engine.cjs` kör 54 meddelanden.
- `verify.cjs` gör 35 kontroller av sidan: att exemplen och testfrågorna stämmer med verktyget, att telefonnumren ringer rätt, att texten har tillräcklig kontrast i ljust och mörkt läge och att alla länkar fungerar. Den behöver internet.

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
