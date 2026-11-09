// Builds the standalone web version (index.html + app.js) from the artifact sources.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.argv[2];
// With --poster the notice links to affisch.pdf, which only works where the site can serve that file.
const posterLink = '\n        <p class="notice-foot">Lappen finns också som <a href="affisch.pdf" data-goatcounter-click="affisch-pdf">affisch att skriva ut</a> (pdf, A4).</p>';
const counterNote = '\n      <p>Sidan räknar besök och hur verktyget används, till exempel hur många meddelanden som kollas och vilket svar de får. Det du skriver räknas aldrig och skickas ingenstans. Det är GoatCounter som räknar, och GoatCounter sparar bara sammanräknade siffror, inte din IP-adress eller något annat som kan kopplas till dig.</p>';
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
if (ui.indexOf('var CAN_SW = false;') === -1) throw new Error('CAN_SW line not found');
if (ui.indexOf('var WEB = false;') === -1) throw new Error('WEB line not found');
const webUi = ui.replace(artUrl, "var SHARE_URL = location.protocol.indexOf('http') === 0 ? location.origin + location.pathname.replace(/index\\.html$/, '') : 'https://tollegoransson-maker.github.io/ar-det-bluff/';")
  .replace('var CAN_OCR = false;', 'var CAN_OCR = true;')
  .replace('var CAN_SW = false;', 'var CAN_SW = true;')
  .replace('var WEB = false;', 'var WEB = true;').trim();
const app = engine + '\n\n' + webUi + '\n';
const appVersion = crypto.createHash('sha1').update(app).digest('hex').slice(0, 8);

// If app.js never runs (an old browser, or the download broke off), this shows all tabs one after the other,
// so that the steps for victims can always be read. app.js sets window.bluffReady when it has started.
const fallback = "if(!window.bluffReady)document.documentElement.className+=' nojs';";
const sha256 = s => crypto.createHash('sha256').update(s, 'utf8').digest('base64');
// The browser itself keeps the promise that the pasted text never leaves the page: scripts may only talk to the
// counter and, for screenshot reading, to jsDelivr. 'wasm-unsafe-eval' is needed by the screenshot reader.
const csp = [
  "default-src 'none'",
  "script-src 'self' 'sha256-" + sha256(fallback) + "' https://gc.zgo.at https://cdn.jsdelivr.net 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  // data: lets the screenshot reader load its own built-in WebAssembly; it cannot send anything anywhere.
  "connect-src 'self' data: https://cdn.jsdelivr.net https://kollabluffen.goatcounter.com",
  "img-src 'self' data: blob: https://kollabluffen.goatcounter.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const pre = [
  '<!doctype html>',
  '<html lang="sv">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta http-equiv="Content-Security-Policy" content="' + csp + '">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta property="og:title" content="Är det bluff?">',
  '<meta property="og:description" content="Kolla om ett sms, mejl eller samtal är ett bedrägeri. Gratis och på svenska.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:locale" content="sv_SE">',
  '<meta property="og:url" content="' + SITE + '">',
  '<meta property="og:image" content="' + SITE + 'og.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="Är det bluff? Lägg på om någon ringer och ber dig använda BankID.">',
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

// The counter script has a fixed version and a checksum, so the browser refuses it if anyone changes it.
const counter = '<script data-goatcounter="https://kollabluffen.goatcounter.com/count" async src="https://gc.zgo.at/count.v5.js" ' +
  'integrity="sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ" crossorigin="anonymous"></script>';
// ?v= makes browsers fetch the new app.js together with a new index.html instead of reusing an old copy.
const index = pre + '\n' + headPart + '\n</head>\n<body>\n' + bodyPart + '\n<script src="app.js?v=' + appVersion + '"></script>\n<script>' + fallback + '</script>\n' + counter + '\n</body>\n</html>\n';

// The service worker keeps a copy of the page so that it opens without a connection. Every build gets its own cache name,
// so a new version replaces the old one in one go. Pages are fetched from the network first; the copy is only used offline
// or when the network has not answered in four seconds. To switch it off, see src/README.md.
const swVersion = crypto.createHash('sha1').update(index + app).digest('hex').slice(0, 8);
const sw = fs.readFileSync(path.join(dir, 'sw-template.js'), 'utf8')
  .replace("'%VERSION%'", "'" + swVersion + "'")
  .replace("'%APP%'", "'app.js?v=" + appVersion + "'");
if (sw.indexOf('%') !== -1) throw new Error('sw-template.js still has a placeholder');

fs.mkdirSync(path.join(dir, 'deploy'), { recursive: true });
fs.writeFileSync(path.join(dir, 'deploy', 'index.html'), index);
fs.writeFileSync(path.join(dir, 'deploy', 'app.js'), app);
fs.writeFileSync(path.join(dir, 'deploy', 'sw.js'), sw);
fs.mkdirSync(path.join(dir, 'deploy', 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(dir, 'fonts'))) {
  if (f !== 'fonts.css') fs.copyFileSync(path.join(dir, 'fonts', f), path.join(dir, 'deploy', 'fonts', f));
}
for (const [name, text] of [['index.html', index], ['app.js', app], ['sw.js', sw]]) {
  const buf = Buffer.from(text, 'utf8');
  console.log(name, buf.length, 'bytes, sha1', crypto.createHash('sha1').update(buf).digest('hex'), ', backslashes:', (text.match(/\\/g) || []).length);
}
