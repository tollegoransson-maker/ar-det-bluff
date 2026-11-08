// Regression suite: the reviewers' realistic messages and edge cases, each with the verdict it must get.
// Usage: node regress.cjs <ar-det-bluff.html | app.js> [-v]
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8');
const verbose = process.argv.includes('-v');
const code = src.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const Bluffkoll = new Function(code + '\nreturn Bluffkoll;')();
const B = require(path.join(__dirname, 'regress-cases.cjs'));
const page = fs.readFileSync(path.join(__dirname, 'parts', 'page.html'), 'utf8');

// expect: 'high' | 'medium' | 'low' | 'medium+' (medium or high) | 'nothigh' (low or medium)
const cases = [];
B.scam.forEach(([n, t]) => cases.push([n, t, 'medium+']));
B.real.forEach(([n, t]) => cases.push([n, t, 'nothigh']));

const SITE = 'https://tollegoransson-maker.github.io/ar-det-bluff/';
[
  // Negation: encouragement is not a warning, and a warning does not cancel a later request.
  ['N1 kort', 'Skatteverket: Ange dina kortuppgifter i formuläret så betalar vi ut återbäringen.', 'high'],
  ['N2 tveka inte', 'Skatteverket: Tveka inte att ange dina kortuppgifter i formuläret så betalar vi ut återbäringen.', 'high'],
  ['N3 BankID ta emot', 'Godkänn med BankID för att ta emot pengarna.', 'high'],
  ['N4 glöm inte', 'Glöm inte att godkänna med BankID för att ta emot pengarna.', 'high'],
  ['N5 kod', 'Skicka koden till mig så hjälper jag dig.', 'medium+'],
  ['N6 missa inte', 'Missa inte att skicka koden till mig så hjälper jag dig.', 'medium+'],
  ['N7 aldrig ... men', 'Swedbank: Vi ber dig aldrig om koder men bekräfta med BankID nu för att stoppa köpet.', 'high'],
  ['N8 utan aldrig', 'Swedbank: Bekräfta med BankID nu för att stoppa köpet.', 'high'],
  ['N9 skicka den inte', 'Din engångskod är 482917. Skicka den inte vidare till någon.', 'low'],
  ['N10 dela inte', 'Din kod är 482917. Dela inte koden med någon, inte ens med oss.', 'low'],
  ['N11 don\'t forget', 'Don\'t forget to enter your card details to receive the refund.', 'high'],
  // QR and BankID in either order.
  ['Q1 skanna QR med BankID', 'Skanna QR-koden med BankID-appen för att läsa brevet.', 'high'],
  ['Q2 öppna BankID, skanna QR', 'Öppna BankID-appen och skanna QR-koden för att läsa brevet.', 'high'],
  // Links without https on cheap or unusual endings.
  ...['lat', 'pro', 'club', 'tech', 'space', 'website', 'top', 'shop'].map(t => ['L .' + t, 'Ditt paket väntar: pn-leverans.' + t + '/se', 'high']),
  ...['my', 'hk', 'sg'].map(t => ['L .' + t, 'Ditt paket väntar: pn-leverans.' + t + '/se', 'medium+']),
  ['L https .lat', 'Ditt paket väntar: https://pn-leverans.lat/se', 'high'],
  ['L okänd ändelse med sökväg', 'Ditt paket väntar: pn-leverans.zz/se/b12', 'medium+'],
  // English, emoji and invisible characters.
  ['E1 engelska paket', 'Your package could not be delivered. Pay the customs fee of $1.99 here: https://usps-redelivery.top', 'high'],
  ['E2 engelska hi mum', 'Hi mum, I lost my phone, this is my new number. Can you send me 300 pounds?', 'high'],
  ['E3 emoji i ord', 'Ditt Bank🔒ID har spärrats. Förnya här 👉 https://bank-id-fornya.com', 'high'],
  ['E4 bara emojis', '😀😀😀🎉🎉', 'low'],
  ['E5 nollbreddstecken', 'Ditt Bank\u200bID har spärrats, förnya i dag', 'medium+'],
  ['E6 emoji mitt i kortuppgifter', 'Ange dina kort😊uppgifter här så får du pengarna: https://swish-utbetalning.com', 'high'],
  // Markup is only text.
  ['X1 img onerror', '<img src=x onerror=alert(1)>', 'low'],
  ['X2 script', '<script>alert(1)</script> Ange dina kortuppgifter: https://x.example', 'high'],
  // Fake traffic fines (Polisen warned in April 2026), foreign senders, brands that were missing.
  ['T1 trafikbot polislänk', 'Polismyndigheten: Du har en obetald trafikbot på 1 500 kr. Betala senast 2 maj för att undvika ytterligare avgifter: https://polisen-bot.com', 'high'],
  ['T2 trafikbot neutral länk', 'Polismyndigheten: Du har en obetald trafikbot på 1 500 kr. Betala senast 2 maj för att undvika ytterligare avgifter: https://trafikbot-betala.se', 'high'],
  ['T3 trafikbot kort', 'Polismyndigheten: Du har en obetald trafikbot på 1 500 kr. Betala här: https://trafikbot-betala.se', 'high'],
  ['F1 utländskt nummer', '+44 7700 900456 Skatteverket: Din deklaration har ett fel. Logga in för att rätta den: https://skv-rattelse.se', 'high'],
  ['M1 Intrum', 'Intrum: Ärende 55120. Betala 2 340 kr till oss idag: https://intrum-betalning.com', 'high'],
  ['M2 Sparbanken', 'Sparbanken: Ditt konto är låst. Lås upp här: https://sparbanken-sakerhet.com', 'high'],
  ['M3 Tullverket', 'Tullverket: Ditt paket har fastnat. Betala 49 kr här: https://tullverket-se.com', 'high'],
  ['C1 samtalsutskrift', 'Hej, jag ringer från Nordeas bedrägeriavdelning. Vi har sett konstiga köp. Öppna din BankID-app så skickar jag en förfrågan som du godkänner.', 'high'],
  // The page's own texts must not warn about the page.
  ['O1 delningstexten', 'Hej! Här är en sida där du kan kolla om ett sms eller ett samtal är en bluff: ' + SITE + '\n\nKom ihåg: ingen bank eller polis ringer oväntat och ber dig använda BankID. Lägg på och ring upp själv. Sidan ber aldrig om BankID, koder eller pengar.', 'low'],
  ['O2 testresultatet', 'Jag fick 8 av 10 rätt på bluff-testet. Klarar du det? ' + SITE + '#testa', 'low'],
  ['O3 egen domän', 'Kolla sms:et på https://ardetbluff.se innan du klickar. BankID ska du bara använda själv.', 'low'],
  // Ordinary messages that must stay calm.
  ['R1 bankens råd', 'Klicka aldrig på länkar i sms. Logga in i appen själv om du vill se dina köp.', 'low'],
  ['R2 garagekod', 'Hej! Kan du skicka koden till garaget? Jag står utanför. /Pappa', 'nothigh'],
  ['R3 middag', 'Hej mamma! Kommer vid sex. Ska jag köpa med mig något? Kram', 'low'],
  ['R4 räkning', 'Hej! Fakturan för oktober på 1 250 kr finns nu i din internetbank. Förfallodag 30 november.', 'low']
].forEach(c => cases.push(c));
// Current scam types and real messages from the first review round.
require(path.join(__dirname, 'regress-extra.cjs')).forEach(c => cases.push(c));
// Scams written to slip past the analysis, and real messages that look scary, from the third review round.
require(path.join(__dirname, 'regress-round3.cjs')).forEach(c => cases.push(c));

// Example sentences in the page's own table must at least get a warning.
for (const m of page.matchAll(/<th scope="row">([^<]+)<\/th><td class="say"[^>]*>”([^<]+)”<\/td>/g)) {
  cases.push(['Tabell: ' + m[1].replace(/&nbsp;/g, ' '), m[2].replace(/&nbsp;/g, ' '), 'medium+']);
}

const ok = (lvl, exp) => exp === lvl || (exp === 'medium+' && lvl !== 'low' && lvl !== 'empty') || (exp === 'nothigh' && lvl !== 'high');
let failed = 0, highScams = 0, scams = 0, lowReals = 0, reals = 0, slowest = 0;
for (const [name, text, exp] of cases) {
  const t0 = process.hrtime.bigint();
  const r = Bluffkoll.analyze(text);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  slowest = Math.max(slowest, ms);
  // The two pieces of advice the page shows must not open with the same three words (the same advice in other words).
  const shown = r.todos.slice(0, 2).map(t => t.toLowerCase().split(/[ ,.]+/).slice(0, 3).join(' '));
  const dupTodo = shown.length === 2 && shown[0] === shown[1];
  if (dupTodo) console.log(`FAIL ${name}: samma råd två gånger: ${r.todos.slice(0, 2).join(' | ')}`);
  const pass = ok(r.level, exp) && !dupTodo;
  if (!pass) failed++;
  if (/^S\d/.test(name)) { scams++; if (r.level === 'high') highScams++; }
  if (/^G\d/.test(name)) { reals++; if (r.level === 'low') lowReals++; }
  if (!pass || verbose) {
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(34)} ${r.level.padEnd(6)} (vill ha ${exp}) ${String(r.score).padStart(4)}  ${r.type || '-'}`);
    console.log('      ' + (r.flags.map(f => `${f.id}(${f.w})`).join(', ') || 'inga') + (r.links.length ? '  | ' + r.links.map(l => `${l.host}=${l.status}`).join(', ') : ''));
  }
}

// Speed and long input.
const perf = [
  ('Hej! Din leverans är försenad. Betala 19 kr inom 24 timmar: https://pn-se.top/b ').repeat(260),
  'a.'.repeat(10000), 'ring 0' + '1 '.repeat(10000), '(www.'.repeat(4000), '-a'.repeat(10000) + '.se',
  'x'.repeat(19990) + ' bankid', 'Skicka koden '.repeat(5000)
];
for (const t of perf) {
  const t0 = process.hrtime.bigint();
  Bluffkoll.analyze(t);
  slowest = Math.max(slowest, Number(process.hrtime.bigint() - t0) / 1e6);
}
const longScam = 'Hej! '.repeat(4000) + 'Ange dina kortuppgifter här: https://skatteverket-aterbaring.com';
const lr = Bluffkoll.analyze(longScam);
const truncOk = lr.truncated === true;
if (!truncOk) { failed++; console.log('FAIL lång text: analyze() säger inte att texten kortades (truncated)'); }
const slowOk = slowest < 250;
if (!slowOk) { failed++; console.log('FAIL långsammaste analysen tog ' + slowest.toFixed(0) + ' ms'); }

console.log(`\nBluffar hos granskaren: ${highScams}/${scams} troligen bluff, resten var försiktig eller sämre (se FAIL ovan).`);
console.log(`Äkta hos granskaren: ${lowReals}/${reals} inga tecken, ingen får troligen bluff (se FAIL ovan).`);
console.log(`Långsammaste analysen: ${slowest.toFixed(1)} ms`);
console.log(`${cases.length + 2 - failed}/${cases.length + 2} som väntat`);
