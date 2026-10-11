'use strict';
// Source contracts complement the native browser checks. They do not simulate
// CSS, wheel/touch scrolling, native Escape, focus restoration, or dialog geometry.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'temporary-links.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
function rule(selector) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(match => match[1].trim().split(/\s*,\s*/).includes(selector))?.[2] || '';
}

// Removing either lock, applying it to ordinary open dialogs, or making it
// permanent must fail this regression for the confirmed background-scroll bug.
test('root and body scroll locks apply only to native modal dialogs', () => {
  for (const selector of ['html:has(dialog:modal)', 'body:has(dialog:modal)']) {
    assert.match(rule(selector), /(?:^|;)\s*overflow\s*:\s*hidden\s*(?:;|$)/, selector);
  }
  for (const selector of ['html', 'body', 'html:has(dialog[open])', 'body:has(dialog[open])']) {
    assert.doesNotMatch(rule(selector), /overflow\s*:\s*(?:hidden|clip)/, selector);
  }
});

test('Help and Edit retain their bounded inner-scrolling shells', () => {
  assert.match(rule('dialog'), /max-height:\s*min\(760px,\s*calc\(100dvh - 28px\)\)/);
  assert.match(rule('dialog'), /overflow:\s*hidden/);
  assert.match(rule('.dialog-body'), /overflow:\s*auto/);
  assert.match(rule('.dialog-body'), /max-height:\s*calc\(100dvh - 102px\)/);
  const help = html.match(/<dialog id="helpDialog"[\s\S]*?<\/dialog>/)[0];
  const edit = html.match(/<dialog id="editDialog"[\s\S]*?<\/dialog>/)[0];
  assert.match(help, /id="closeHelpButton"/);
  assert.ok(help.indexOf('id="closeHelpButton"') < help.indexOf('class="dialog-body"'));
  assert.match(help, /class="dialog-body"[\s\S]*data-i18n="helpOffline"/);
  assert.match(edit, /class="dialog-body"[\s\S]*id="editCancelButton"[\s\S]*id="editSaveButton"/);
});

test('the local-processing badge preserves its decorative shield', () => {
  const badge = html.match(/<div class="local-badge">([\s\S]*?)<\/div>/)[1];
  assert.match(badge, /<svg[^>]*aria-hidden="true"/);
  assert.match(badge, /<path d="M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z"/);
  assert.match(badge, /<path d="m9 12 2 2 4-5"/);
  assert.match(badge, /<span data-i18n="localBadge">完全ローカル処理<\/span>/);
});
