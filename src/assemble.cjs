// Rebuilds the artifact page from parts/page.html + the engine already in ar-det-bluff.html + parts/ui.js.
// With a second argument, also writes a skeleton-wrapped preview file to that folder.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const previewDir = process.argv[3];
const file = path.join(dir, 'ar-det-bluff.html');
const old = fs.readFileSync(file, 'utf8');
const a = old.indexOf('/*ENGINE-START*/');
const b = old.indexOf('/*ENGINE-END*/') + '/*ENGINE-END*/'.length;
if (a < 0 || b < a) throw new Error('engine markers not found');

const page = fs.readFileSync(path.join(dir, 'parts', 'page.html'), 'utf8')
  .replace('\n        <!--POSTER-->', '').replace('\n      <!--COUNTER-->', '').trimEnd();
const ui = fs.readFileSync(path.join(dir, 'parts', 'ui.js'), 'utf8').trim();
const out = page + '\n\n<script>\n' + old.slice(a, b) + '\n\n' + ui + '\n</script>\n';
fs.writeFileSync(file, out);
console.log('assembled', Buffer.byteLength(out), 'bytes');

if (previewDir) {
  const skel = '<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<style>:root{color-scheme:light}[hidden]{display:none!important}</style></head><body>' + out + '</body></html>';
  fs.writeFileSync(path.join(previewDir, '_preview.html'), skel);
  console.log('preview written');
}
