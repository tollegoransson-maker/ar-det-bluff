// Builds the standalone web version (index.html + app.js) from the artifact sources.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.argv[2];
// With --poster the notice links to affisch.pdf, which only works where the site can serve that file.
const posterLink = '\n        <p class="notice-foot">Lappen finns också som <a href="affisch.pdf" data-goatcounter-click="affisch-pdf">affisch att skriva ut</a> (pdf, A4).</p>';
const counterNote = '\n      <p>Sidan räknar besök och hur verktyget används, till exempel hur många meddelanden som kollas och vilket svar de får. Det du skriver räknas aldrig och skickas ingenstans. Räkningen görs med GoatCounter, som bara sparar sammanräknade siffror, inte din IP-adress eller något annat som kan kopplas till dig.</p>';
const page = fs.readFileSync(path.join(dir, 'parts', 'page.html'), 'utf8')
  .replace('\n        <!--POSTER-->', process.argv.includes('--poster') ? posterLink : '')
  .replace('\n      <!--COUNTER-->', counterNote);
const SITE = 'https://tollegoransson-maker.github.io/ar-det-bluff/';
const art = fs.readFileSync(path.join(dir, 'ar-det-bluff.html'), 'utf8');
const ui = fs.readFileSync(path.join(dir, 'parts', 'ui.js'), 'utf8');

const cut = page.indexOf('<header class="site-head">');
// The fonts are served by the site itself, so visitors' browsers never have to contact Google.
const googleFonts = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">/;
const localFonts = ['atkinson-hyperlegible-next-latin', 'newsreader-latin']
  .map(f => '<link rel="preload" href="fonts/' + f + '.woff2" as="font" type="font/woff2" crossorigin>').join('\n') +
  '\n<style>\n' + fs.readFileSync(path.join(dir, 'fonts', 'fonts.css'), 'utf8').trim() + '\n</style>';
// In search results the title also says what the page does.
const artTitle = '<title>Är det bluff?</title>';
let headPart = page.slice(0, cut).trimEnd();
if (!googleFonts.test(headPart)) throw new Error('Google Fonts block not found');
if (headPart.indexOf(artTitle) === -1) throw new Error('title not found');
headPart = headPart.replace(googleFonts, () => localFonts).replace(artTitle, '<title>Är det bluff? Kolla sms, mejl och samtal</title>');
const bodyPart = page.slice(cut).trimEnd();
const engine = art.slice(art.indexOf('/*ENGINE-START*/'), art.indexOf('/*ENGINE-END*/') + '/*ENGINE-END*/'.length);

// On the web the page shares whatever address it is served from (github.io today, an own domain later).
const artUrl = "var SHARE_URL = 'https://tollegoransson-maker.github.io/ar-det-bluff/';";
if (ui.indexOf(artUrl) === -1) throw new Error('SHARE_URL line not found');
if (ui.indexOf('var CAN_OCR = false;') === -1) throw new Error('CAN_OCR line not found');
const webUi = ui.replace(artUrl, "var SHARE_URL = location.protocol.indexOf('http') === 0 ? location.origin + location.pathname.replace(/index\\.html$/, '') : 'https://tollegoransson-maker.github.io/ar-det-bluff/';")
  .replace('var CAN_OCR = false;', 'var CAN_OCR = true;').trim();

const pre = [
  '<!doctype html>',
  '<html lang="sv">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta property="og:title" content="Är det bluff?">',
  '<meta property="og:description" content="Kolla om ett sms, mejl eller samtal är ett bedrägeri. Gratis och på svenska.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:locale" content="sv_SE">',
  '<meta property="og:url" content="' + SITE + '">',
  '<meta property="og:image" content="' + SITE + 'og.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Är det bluff? Lägg på om någon ber dig använda BankID i telefon.">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#111315" media="(prefers-color-scheme: dark)">',
  // Visits via the poster QR code (?campaign=affisch) are the same page for search engines.
  '<link rel="canonical" href="' + SITE + '">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="icon-180.png">',
  '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2712%27 fill=%27%23B4142B%27/%3E%3Cpath d=%27M28 13h8v26h-8zM28 45h8v8h-8z%27 fill=%27%23fff%27/%3E%3C/svg%3E">',
  '<style>:root{color-scheme:light}[hidden]{display:none!important}</style>'
].join('\n');

const counter = '<script data-goatcounter="https://kollabluffen.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';
const index = pre + '\n' + headPart + '\n</head>\n<body>\n' + bodyPart + '\n<script src="app.js"></script>\n' + counter + '\n</body>\n</html>\n';
const app = engine + '\n\n' + webUi + '\n';

fs.mkdirSync(path.join(dir, 'deploy'), { recursive: true });
fs.writeFileSync(path.join(dir, 'deploy', 'index.html'), index);
fs.writeFileSync(path.join(dir, 'deploy', 'app.js'), app);
fs.mkdirSync(path.join(dir, 'deploy', 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(dir, 'fonts'))) {
  if (f !== 'fonts.css') fs.copyFileSync(path.join(dir, 'fonts', f), path.join(dir, 'deploy', 'fonts', f));
}
for (const [name, text] of [['index.html', index], ['app.js', app]]) {
  const buf = Buffer.from(text, 'utf8');
  console.log(name, buf.length, 'bytes, sha1', crypto.createHash('sha1').update(buf).digest('hex'), ', backslashes:', (text.match(/\\/g) || []).length);
}
