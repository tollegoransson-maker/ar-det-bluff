// Runs the page's detection engine against known scam and legit messages.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const code = html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const Bluffkoll = new Function(code + '\nreturn Bluffkoll;')();

const samples = [
  ['scam', 'PostNord: Ditt paket kunde inte levereras eftersom tullavgiften (19 kr) inte är betald. Betala inom 24 timmar för att undvika retur: https://postnord.se-tull.example/betala'],
  ['scam', 'Hej mamma! Det är jag. Jag har tappat min telefon så det här är mitt nya nummer, spara det. Jag måste betala en räkning idag men kommer inte åt min bank. Kan du swisha 4 800 kr? Jag betalar tillbaka imorgon ❤️'],
  ['scam', 'Skatteverket: Du har en skatteåterbäring på 2 341 kr som inte har kunnat betalas ut. Ange dina kortuppgifter senast idag för att få pengarna: skatteverket-aterbetalning.example'],
  ['scam', 'Hej! Jag vill köpa din soffa och betalar direkt via Swish. Jag har skickat en betalningsförfrågan. Godkänn med BankID så får du pengarna. Mvh Anna'],
  ['scam', 'Ditt BankID har spärrats på grund av misstänkt aktivitet. Förnya ditt BankID omedelbart här: https://bankid-sakerhet.example/'],
  ['scam', 'Kronofogden: Du har en obetald skuld på 1 245 kr. Betala senast idag för att undvika utmätning. Ring 08-465 004 56'],
  ['scam', 'Tjäna 5000 kr om dagen med vår AI-robot! Garanterad avkastning. Registrera dig här: bit.ly/3xYz12'],
  ['scam', 'Hej! Vi söker personer för ett flexibelt deltidsjobb. Tjäna 1500–3000 kr per dag genom att gilla videor. Kontakta oss på WhatsApp: +44 7700 900123'],
  ['scam', 'Köparen har betalat för din vara på Blocket. För att ta emot pengarna, fyll i dina kortuppgifter: https://blocket-frakt.example/ta-emot'],
  ['scam', 'Din dator är infekterad med virus. Ladda ner AnyDesk så hjälper vår tekniker dig att ta bort det.'],
  ['scam', 'Grattis! Du har vunnit ett presentkort på 5000 kr. Svara JA och betala 29 kr i frakt.'],
  ['scam', 'Min älskling, jag sitter fast i tullen och behöver 15 000 kr för att komma hem till dig. Berätta inte för någon.'],
  ['scam', 'Swedbank: Ett köp på 8 950 kr har gjorts med ditt kort. Var det inte du? Ring vår säkerhetsavdelning direkt på 08-465 004 78.'],
  ['scam', 'Your package is on hold due to an unpaid customs fee of €1.99. Pay now: https://dhl-parcel.example/pay'],
  ['scam', 'Netflix: Din betalning misslyckades. Uppdatera dina betalningsuppgifter inom 24 timmar för att undvika att ditt konto stängs: https://netflix-konto.example'],
  ['scam', 'Hej! Jag råkade skicka en sexsiffrig kod till ditt nummer av misstag, kan du skicka den till mig?'],
  ['scam', 'Your Apple ID has been locked. Verify your identity: http://apple-id-support.example/login'],
  ['scam', 'Polisen här. Vi har gripit ett gäng. En kollega kommer och hämtar ditt bankkort och dina smycken så att de är säkra.'],
  ['scam', 'Hej, detta är banken. För att skydda dina pengar måste du flytta dem till ett säkert konto idag.'],
  ['scam', 'Försäkringskassan: Du har rätt till en återbetalning. Logga in med BankID via länken: https://fk-utbetalning.top/se'],
  ['legit', 'Din engångskod är 482193. Den gäller i 10 minuter. Dela aldrig koden med någon.'],
  ['legit', 'Hej mamma, jag kommer hem vid sju. Kan du köpa mjölk på vägen?'],
  ['legit', 'Ditt paket från Zalando levereras idag mellan 17 och 21. Följ leveransen i appen.'],
  ['legit', 'Vi ses på lördag! Här är adressen: https://maps.google.com/?q=Storgatan+1'],
  ['legit', 'Swedbank: Ditt nya kort skickas till din folkbokföringsadress inom 5 bankdagar.'],
  ['legit', 'Hej! Påminnelse om din tid hos tandläkaren tisdag 12 november kl. 14.30. Välkommen! Behöver du avboka, hör av dig senast dagen innan.'],
  ['legit', 'Grattis på födelsedagen! Kram från oss alla ❤️'],
  ['legit', 'PostNord: Ditt paket finns att hämta hos ditt ombud. Spåra: https://www.postnord.se/vara-verktyg/spara?id=123'],
  ['legit', '1177: Du har fått ett nytt meddelande. Logga in på 1177.se för att läsa det.'],
  ['legit', 'Kan du swisha mig 150 kr för pizzan igår?'],
  ['legit', 'Klarna: Din betalning på 349 kr förfaller 15 nov. Betala enkelt i Klarna-appen.'],
  ['legit', 'Du behöver aldrig använda BankID för att ta emot pengar på Swish. Lägg på om någon ber dig.'],
  ['legit', 'Hej! Vi ses t.ex. på fredag kl.18, bl.a. Anna kommer. Mvh Per'],
  // Built on patterns that PostNord, Skatteverket, Kronofogden, banks and police have warned about.
  ['scam', 'PostNord: Ditt paket kan inte levereras på grund av ofullständig adress. Bekräfta din adress inom 12 timmar: https://postnord-leverans.example/se'],
  ['scam', 'Skatteverket: Du har ett betalningskrav. Logga in för att se beloppet och undvika avgifter: https://skv-betalning.example'],
  ['scam', 'Kronofogden: Ett ärende om obetald skuld har registrerats på ditt personnummer. Undvik betalningsanmärkning genom att betala idag: kfm-arende.example'],
  ['scam', 'Transportstyrelsen: Du har en obetald trängselskatt på 45 kr. Betala senast idag för att undvika tilläggsavgift: https://ts-betala.example'],
  ['scam', 'Swedbank: Ditt BankID upphör idag. Förnya här för att undvika spärr: https://swedbank-bankid.example'],
  ['scam', 'Polisen: Ditt bankkort har använts vid ett bedrägeri. Ring utredare Johansson på 08-555 012 34 för att spärra kortet.'],
  ['scam', 'Hej! Jag är Anna från ett investeringsbolag. Med vår AI-handel kan du tjäna 3 000 kr i veckan. Svara JA så ringer vi upp dig.'],
  ['warn', 'Hej, är det Eva? Vi skulle ses på lördag. Jag hittade ditt nummer i min telefon.'],
  ['scam', 'Du har fått ett nytt röstmeddelande. Lyssna här: https://rostbrevlada.example/12345'],
  ['scam', '1177: Du har ett nytt meddelande från din vårdcentral. Logga in med BankID här: https://1177-inloggning.example'],
  ['scam', 'Hej! Jag såg din annons på Blocket. Jag bokar frakt via PostNords kurirtjänst, fyll i dina uppgifter här för att få betalt: https://postnord-kurir.example'],
  ['scam', 'Telia: Din faktura kunde inte dras. Uppdatera din betalningsmetod inom 24 timmar för att undvika avstängning: https://telia-betalning.example'],
  ['scam', 'Hej! Jag skickade en kod till dig av misstag, kan du skicka den till mig? Det är bråttom'],
  ['scam', 'Grattis! Du har vunnit ett presentkort på ICA värt 1000 kr. Svara inom 24 h: https://ica-vinst.example'],
  ['scam', 'En man i uniform säger att han är polis. Han vill ta med sig ditt bankkort och dina smycken för att skydda dem från ett gäng.'],
  ['legit', 'Ditt nya bankkort är klart. Du kan hämta det på kontoret från och med måndag.'],
  ['legit', 'Telia: Du har ett nytt röstmeddelande. Ring 222 för att lyssna.'],
  ['legit', 'Hej! Din beställning från Apotea har skickats och levereras imorgon. Spåra paketet i appen.'],
  ['legit', 'Swedbank: Ett köp på 1 299 kr har gjorts med kortet som slutar på 4821.'],
  ['legit', 'Kivra: Du har fått ett nytt brev från Skatteverket. Logga in i appen för att läsa det.'],
  ['legit', 'Hej Eva! Vi ses på lördag som vanligt. Kram Kerstin'],
];

let wrong = 0;
for (const [kind, text] of samples) {
  const r = Bluffkoll.analyze(text);
  const ok = kind === 'scam' ? r.level === 'high' : kind === 'warn' ? r.level !== 'low' : r.level !== 'high';
  if (!ok) wrong++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${kind}] ${r.level.toUpperCase().padEnd(6)} ${String(r.score).padStart(4)}  ${r.type || '-'}`);
  console.log('      ' + (r.flags.map(f => `${f.id}(${f.w})`).join(', ') || 'no flags'));
  if (r.links.length) console.log('      links: ' + r.links.map(l => `${l.host} [${l.status}${l.brand ? ' ' + l.brand.name : ''}]`).join(' | '));
}
console.log(`\n${samples.length - wrong}/${samples.length} as expected`);
