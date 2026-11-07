// Turns the Google Fonts stylesheet into self-hosted files: downloads the latin and latin-ext woff2 files
// and writes @font-face rules that point to fonts/<name>.woff2 on the site itself.
const fs = require('fs');
const path = require('path');
const https = require('https');
const [cssFile, outDir] = process.argv.slice(2);
const css = fs.readFileSync(cssFile, 'utf8');
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)].map(m => {
  const body = m[2], get = k => ((body.match(new RegExp(k + ':([^;]+);')) || [])[1] || '').trim();
  return { subset: m[1], family: get('font-family').replace(/'/g, ''), style: get('font-style'), weight: +get('font-weight'),
    url: get('src').match(/url\(([^)]+)\)/)[1], range: get('unicode-range') };
}).filter(b => b.subset !== 'vietnamese');
const faces = new Map();
for (const b of blocks) {
  const key = [b.family, b.style, b.url, b.range].join('|');
  if (!faces.has(key)) faces.set(key, Object.assign({}, b, { weights: [] }));
  faces.get(key).weights.push(b.weight);
}
function get(url, file) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(url + ' ' + res.statusCode));
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { fs.writeFileSync(file, Buffer.concat(chunks)); resolve(); });
    }).on('error', reject);
  });
}
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  let out = '';
  for (const f of faces.values()) {
    const name = f.family.toLowerCase().replace(/ /g, '-') + (f.style === 'italic' ? '-italic' : '') + '-' + f.subset + '.woff2';
    await get(f.url, path.join(outDir, name));
    const head = fs.readFileSync(path.join(outDir, name)).slice(0, 4).toString('latin1');
    if (head !== 'wOF2') throw new Error(name + ' is not woff2: ' + head);
    const lo = Math.min(...f.weights), hi = Math.max(...f.weights);
    out += '@font-face{font-family:"' + f.family + '";font-style:' + f.style + ';font-weight:' + (lo === hi ? lo : lo + ' ' + hi) +
      ';font-display:swap;src:url(fonts/' + name + ') format("woff2");unicode-range:' + f.range + '}\n';
    console.log(name, fs.statSync(path.join(outDir, name)).size, 'bytes, weights', f.weights.join('/'));
  }
  fs.writeFileSync(path.join(outDir, 'fonts.css'), out);
  console.log('fonts.css', Buffer.byteLength(out), 'bytes');
})().catch(e => { console.error(e.message); process.exit(1); });
