// Pre-launch checks, each a yes/no question (after the IGenBench idea: looking right is not the same as being right).
const fs = require('fs');
const path = require('path');
const https = require('https');

const dir = process.argv[2];
const html = fs.readFileSync(path.join(dir, 'ar-det-bluff.html'), 'utf8');
const page = fs.readFileSync(path.join(dir, 'parts', 'page.html'), 'utf8');
const ui = fs.readFileSync(path.join(dir, 'parts', 'ui.js'), 'utf8');
const engine = html.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const Bluffkoll = new Function(engine + '\nreturn Bluffkoll;')();

const results = [];
const check = (q, ok, note) => results.push({ q, ok: !!ok, note: note || '' });

// 1. Each example in the tool gives the verdict its label promises.
const EX = new Function('return ' + ui.slice(ui.indexOf('var EX = {') + 9, ui.indexOf('};', ui.indexOf('var EX = {')) + 1))();
const expected = { paket: 'high', mamma: 'high', skatt: 'high', blocket: 'high', vanligt: 'low' };
for (const k of Object.keys(expected)) {
  const lvl = Bluffkoll.analyze(EX[k]).level;
  check(`Exemplet "${k}" ger ${expected[k]}?`, lvl === expected[k], lvl);
}

// 1b. The quiz teaches the same thing the tool says: its bluffs get a warning, its real messages do not.
const quizSrc = ui.slice(ui.indexOf('var QUIZ = [') + 11, ui.indexOf('];', ui.indexOf('var QUIZ = [')) + 1);
const QUIZ = new Function('return ' + quizSrc)();
check('Testet har tio frågor?', QUIZ.length === 10, String(QUIZ.length));
QUIZ.forEach((q, i) => {
  const lvl = Bluffkoll.analyze(q.text).level;
  const ok = q.answer === 'bluff' ? lvl !== 'low' : lvl === 'low';
  check(`Testfråga ${i + 1} (${q.answer}) stämmer med verktyget?`, ok, lvl);
});

// 2. Copy has none of the usual AI tells.
const text = page.replace(/<style[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ') + ' ' + (ui.match(/'[^']*'/g) || []).join(' ');
check('Inga tankstreck (—) i texten?', !/—/.test(text));
const banned = ['sömlös', 'banbrytande', 'revolutionerande', 'kraftfull', 'dyk in', 'i dagens digitala', 'lås upp din', 'seamless', 'unlock', 'elevate', 'empower'];
const hits = banned.filter(w => text.toLowerCase().includes(w));
check('Inga slitna AI-ord?', hits.length === 0, hits.join(', '));
check('Varningen om att verktyget kan missa knep står bara en gång?', (html.match(/kan missa nya knep/g) || []).length === 1);

// 3. Phone numbers are the right ones and the links dial the same numbers.
for (const [shown, tel] of [['114 14', '11414'], ['112', '112'], ['116 006', '116006'], ['020-10 54 00', '020105400'], ['08-27 00 29', '08270029'], ['0771-567 567', '0771567567']]) {
  check(`Numret ${shown} finns och länken ringer ${tel}?`, page.replace(/&nbsp;/g, ' ').includes('>' + shown + '<') && page.includes('href="tel:' + tel + '"'));
}

// 4. Markup integrity.
const ids = (page.match(/\sid="([^"]+)"/g) || []).map(s => s.slice(5, -1));
const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
check('Alla id är unika?', dupes.length === 0, dupes.join(', '));
const refs = [...page.matchAll(/(?:aria-controls|aria-labelledby|aria-describedby|for)="([^"]+)"/g)].map(m => m[1]);
const missing = refs.filter(r => ids.indexOf(r) === -1);
check('Alla etiketter och flikar pekar på något som finns?', missing.length === 0, missing.join(', '));
// Every element the page script looks up must exist, or everything set up after that line stops working.
// Ids that the script creates itself (in its own HTML strings) are left out.
const made = [...ui.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const used = [...new Set([...ui.matchAll(/\$\('#([\w-]+)'/g), ...ui.matchAll(/getElementById\('([\w-]+)'\)/g)].map(m => m[1]))];
const lost = used.filter(id => made.indexOf(id) === -1 && ids.indexOf(id) === -1);
check('Alla element som skriptet använder finns på sidan?', lost.length === 0, lost.join(', '));

// 5. Text contrast in both themes (WCAG AA, 4.5:1).
function tokens(block) {
  const t = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) t[m[1]] = m[2];
  return t;
}
const light = tokens(page.slice(page.indexOf(':root {'), page.indexOf('@media (prefers-color-scheme: dark)')));
const dark = Object.assign({}, light, tokens(page.slice(page.indexOf(':root[data-theme="dark"]'), page.indexOf('*, *::before'))));
function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [['ink', 'bg'], ['ink-2', 'bg'], ['accent', 'bg'], ['on-accent', 'accent'], ['on-danger', 'danger'], ['danger-text', 'bg'],
  ['caution-ink', 'caution-bg'], ['calm-ink', 'calm-bg'], ['mark-ink', 'mark'], ['ink', 'surface'], ['ink-2', 'surface'], ['accent', 'surface']];
for (const [name, theme] of [['ljust', light], ['mörkt', dark]]) {
  const weak = pairs.map(([f, b]) => [f, b, ratio(theme[f], theme[b])]).filter(p => p[2] < 4.5);
  check(`All text har minst 4,5:1 i kontrast i ${name} läge?`, weak.length === 0, weak.map(p => `${p[0]}/${p[1]} ${p[2].toFixed(2)}`).join(', '));
}

// 6. Every external link answers.
function status(url, hops) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36', 'Accept-Language': 'sv-SE,sv' }, timeout: 15000 }, res => {
      res.resume();
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) resolve(status(new URL(res.headers.location, url).href, hops + 1));
      else resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve('timeout'); });
    req.on('error', e => resolve('error ' + e.code));
  });
}
(async () => {
  const urls = [...new Set([...page.matchAll(/<a [^>]*href="(https:[^"]+)"/g)].map(m => m[1]))];
  for (const u of urls) {
    const s = await status(u, 0);
    check(`Länken svarar: ${u.replace(/^https:\/\/(www\.)?/, '').slice(0, 60)}?`, typeof s === 'number' && s < 400, String(s));
  }
  let failed = 0;
  for (const r of results) { if (!r.ok) failed++; console.log((r.ok ? 'ja  ' : 'NEJ ') + r.q + (r.note ? '  (' + r.note + ')' : '')); }
  console.log(`\n${results.length - failed}/${results.length} kontroller godkända`);
})();
