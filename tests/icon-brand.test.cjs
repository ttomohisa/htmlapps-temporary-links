const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const asset = read('assets/favicon.svg');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)=(["'])(.*?)\2/gs)].map(m => [m[1], m[3]]));
function favicon(html) {
  const tag = html.match(/<link\b[^>]*rel=["']icon["'][^>]*>/);
  assert.ok(tag, 'favicon exists');
  const uri = attrs(tag[0]).href;
  const svg = uri.includes(';base64,') ? Buffer.from(uri.split(',')[1], 'base64').toString() : decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
  assert.equal(svg.trim(), asset.trim(), 'embedded favicon preserves the complete canonical SVG');
}
test('canonical icon preserves the supplied artwork byte for byte', () => {
  assert.equal(createHash('sha256').update(asset).digest('hex'), '314a8f5afacf4f4a0a1beb273f9138847709192f065af606f26784501d702f5a');
});
test('canonical background keeps brand color and quarter-side radii', () => {
  const svg = attrs(asset.match(/<svg\b[^>]*>/)[0]);
  const rect = attrs(asset.match(/<rect\b[^>]*>/)[0]);
  assert.equal(svg.viewBox, '0 0 64 64');
  assert.equal(rect.fill || svg.fill, '#16624f');
  assert.equal(Number(rect.width), 64);
  assert.equal(Number(rect.height), 64);
  assert.equal(Number(rect.rx), 16);
  assert.equal(Number(rect.ry || rect.rx), 16);
});
for (const file of ['temporary-links.html']) test(`${file} keeps canonical header and favicon artwork`, () => {
  const html = read(file);
  const mark = html.match(/<div class="brand-mark"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(mark, 'brand mark exists');
  assert.equal(mark[1].trim(), asset.trim(), 'header includes canonical root attributes and artwork');
  favicon(html);
  assert.match(html, /\.brand-mark\s*>\s*svg\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.doesNotMatch(html, /\.brand-mark\s+svg\s*\{/);
});
