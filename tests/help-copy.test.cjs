const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "使い方・編集を開いている間は背景ページを固定し、内容はダイアログ内でスクロールできます。閉じるとページのスクロールが戻ります。",
  "Help and Edit scroll inside the dialog while the background page stays still. Close the dialog to scroll the page again."
];
for (const file of ["temporary-links.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
