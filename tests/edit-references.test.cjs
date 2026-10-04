'use strict';
// A dependency-free behavior harness for the actual inline app script.
// DOM/PiP are small doubles: native dialog, clipboard and window behavior still need browser QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'temporary-links.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const PERSISTENT = 'temporary-links-v1';
const SESSION = 'temporary-links-session-v2';

function storage(seed) {
  const data = new Map(Object.entries(seed));
  return { data, fail: false, writes: 0, getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('quota'); this.writes++; data.set(key, value); },
    removeItem: key => data.delete(key) };
}
function makeDocument() {
  const nodes = new Map();
  const doc = { nodes, activeElement: null };
  function node(id = '') {
    const listeners = new Map();
    const element = { id, value: '', textContent: '', innerHTML: '', dataset: {}, style: {}, open: false,
      isConnected: true, className: '', disabled: false,
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(type, listener) { const list = listeners.get(type) || []; list.push(listener); listeners.set(type, list); },
      dispatch(type, extra = {}) { const event = { target: element, preventDefault() { this.defaultPrevented = true; }, ...extra }; for (const fn of listeners.get(type) || []) fn(event); return event; },
      focus() { doc.activeElement = element; }, select() {}, append() {}, remove() {}, click() { this.dispatch('click'); },
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      showModal() { this.open = true; }, close() { this.open = false; this.dispatch('close'); },
      querySelector() { return null; }, contains() { return false; }, closest() { return null; } };
    return element;
  }
  Object.assign(doc, node('document'));
  doc.activeElement = null;
  doc.documentElement = { lang: 'en' };
  doc.body = node('body'); doc.head = node('head');
  doc.createElement = () => node();
  doc.querySelector = selector => {
    if (selector.startsWith('#')) { const id = selector.slice(1); if (!nodes.has(id)) nodes.set(id, node(id)); return nodes.get(id); }
    return null;
  };
  doc.querySelectorAll = () => [];
  return doc;
}
function launch({ persistent = [], session = [], local = storage({ [PERSISTENT]: JSON.stringify(persistent) }), tab = storage({ [SESSION]: JSON.stringify(session) }) } = {}) {
  const document = makeDocument();
  const window = { localStorage: local, sessionStorage: tab, isSecureContext: false, setTimeout: () => 1 };
  const context = vm.createContext({ document, window, navigator: { language: 'en' }, URL, Intl, Date, setTimeout: () => 1, clearTimeout() {}, confirm: () => true });
  const exposed = source.replace(/\}\)\(\);\s*$/, `globalThis.app = { addItem, findItem, allItems, activeItems, getVisibleItems, itemCard, markdownFor, classify, canonical, titleFor, localPath, parentPath, openEdit, saveEdit, bindListEvents, setView(f, q = '') { filter = f; query = q; }, setPip(p) { pipWindow = p; }, render, translations }; })();`);
  vm.runInContext(exposed, context);
  const app = context.app;
  function start(id) { app.openEdit(id); return document.querySelector('#editDialog'); }
  function save(url, note) { document.querySelector('#editUrlInput').value = url; document.querySelector('#editNoteInput').value = note; document.querySelector('#editSaveButton').click(); }
  function action(id, action, doc = document) { const card = { dataset: { id } }; const button = { dataset: { action }, closest: () => card }; doc.dispatch('click', { target: { closest: () => button } }); }
  return { app, document, local, tab, start, save, action, read: () => JSON.parse(local.getItem(PERSISTENT) || '[]'), readSession: () => JSON.parse(tab.getItem(SESSION) || '[]') };
}
const item = (id, overrides = {}) => ({ id, url: `https://${id}.example/`, kind: 'web', note: 'original', title: 'Clipboard title', createdAt: 123, done: false, expiresAt: null, ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));

// Syntax and policy guardrails apply to the same single-file distribution used by the tests.
test('inline script compiles and privacy CSP remains restrictive', () => {
  new vm.Script(source);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});
test('main-list edit controls and dialog have accessible bilingual copy', () => {
  const h = launch();
  assert.match(h.app.itemCard(item('one')), /data-action="edit"/);
  assert.match(html, /<dialog id="editDialog" aria-labelledby="editTitle"/);
  assert.match(html, /for="editUrlInput"/);
  assert.match(html, /for="editNoteInput"/);
  assert.match(html, /id="editError"[^>]*role="alert"/);
  for (const key of ['edit', 'editTitle', 'save', 'cancel', 'saved', 'editMissing', 'editStorageFailed', 'editHelp']) {
    assert.ok(h.app.translations.en[key], key);
    assert.ok(h.app.translations.ja[key], key);
  }
});
test('note-only edit preserves identity, order, status, retention, title and unrelated records', () => {
  const records = [item('one'), item('two', { done: true, expiresAt: '2000-01-01T00:00:00.000Z' })];
  const h = launch({ persistent: records });
  h.app.setView('done'); h.start('two'); h.save(' https://two.example/ ', ' 新しいメモ 😀 ');
  assert.deepEqual(h.read(), [records[0], { ...records[1], note: '新しいメモ 😀' }]);
  assert.equal(h.document.querySelector('#editDialog').open, false);
  assert.equal(h.app.getVisibleItems()[0].id, 'two');
  assert.equal(h.tab.writes, 0);
});
test('all retention modes keep their exact expiry and storage ownership on edit and reload', () => {
  for (const expiresAt of ['session', null, '2000-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', '2099-01-03T00:00:00.000Z', '2099-01-07T00:00:00.000Z']) {
    const record = item('one', { expiresAt });
    const h = launch(expiresAt === 'session' ? { session: [record] } : { persistent: [record] });
    h.start('one'); h.save('https://updated.example/', 'updated');
    const reloaded = launch({ local: h.local, tab: h.tab });
    assert.deepEqual(plain(reloaded.app.findItem('one')), { ...record, url: 'https://updated.example/', note: 'updated', title: '' });
    assert.equal(expiresAt === 'session' ? h.local.writes : h.tab.writes, 0);
  }
});
test('web, file URLs, Windows, UNC and absolute paths transition without stale title or actions', () => {
  const inputs = ['https://new.example/', 'file:///C:/work/report%20one.txt', 'C:\\work\\report.txt', '\\\\server\\share\\report.txt', '/home/user/資料.txt', 'https://final.example/'];
  const h = launch({ persistent: [item('one')] });
  for (const url of inputs) {
    h.start('one'); h.save(url, 'note');
    const actual = h.app.findItem('one');
    assert.equal(actual.url, url); assert.equal(actual.kind, h.app.classify(url)); assert.equal(actual.title, '');
    assert.equal(h.app.itemCard(actual).includes('data-action="copy-path"'), actual.kind !== 'web');
    assert.equal(h.app.itemCard(actual).includes('target="_blank"'), actual.kind === 'web');
  }
});
test('canonical-equivalent URL edits preserve the clipboard title and no-op saves work', () => {
  const h = launch({ persistent: [item('one', { url: 'https://example.com' })] });
  h.start('one'); h.save('https://EXAMPLE.com:443/', 'original');
  assert.equal(h.app.findItem('one').title, 'Clipboard title');
  h.local.fail = true;
  h.start('one'); h.save('https://EXAMPLE.com:443/', 'original');
  assert.equal(h.document.querySelector('#editDialog').open, false);
});
test('invalid or duplicate destinations never change either store or the live item', () => {
  for (const invalid of ['', '   ', 'relative/file.txt', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com', 'https://', 'file://', 'https://TWO.example:443/']) {
    const records = [item('one'), item('two')];
    const h = launch({ persistent: records });
    h.start('one'); h.save(invalid, 'should not save');
    assert.deepEqual(h.read(), records); assert.deepEqual(plain(h.app.allItems()), records);
    assert.equal(h.document.querySelector('#editDialog').open, true);
    assert.ok(h.document.querySelector('#editError').textContent);
    assert.equal(h.local.writes + h.tab.writes, 0);
  }
});
test('duplicate checks exclude self, allow inactive duplicates and include active items in both stores', () => {
  const h = launch({ persistent: [item('one'), item('done', { done: true }), item('expired', { expiresAt: '2000-01-01' })], session: [item('session', { expiresAt: 'session' })] });
  for (const url of ['https://one.example/', 'https://done.example/', 'https://expired.example/']) { h.start('one'); h.save(url, 'fine'); assert.equal(h.document.querySelector('#editDialog').open, false); }
  h.start('one'); h.save('https://session.example/', 'blocked'); assert.equal(h.document.querySelector('#editDialog').open, true);
});
test('Cancel and Escape discard edits repeatedly without touching the add draft', () => {
  const h = launch({ persistent: [item('one')] });
  h.document.querySelector('#urlInput').value = 'https://draft.example/';
  h.document.querySelector('#urlInput').dataset.pastedTitle = 'Draft title';
  h.document.querySelector('#noteInput').value = 'unsaved draft';
  h.document.querySelector('#retentionSelect').value = '7d';
  for (let i = 0; i < 2; i++) {
    h.start('one'); h.document.querySelector('#editUrlInput').value = 'https://discard.example/';
    h.document.querySelector('#editCancelButton').click();
    h.start('one'); assert.equal(h.document.querySelector('#editUrlInput').value, item('one').url);
    h.document.querySelector('#editDialog').dispatch('cancel');
    assert.equal(h.document.querySelector('#editDialog').open, false);
  }
  assert.deepEqual(h.read(), [item('one')]);
  assert.equal(h.document.querySelector('#urlInput').value, 'https://draft.example/');
  assert.equal(h.document.querySelector('#urlInput').dataset.pastedTitle, 'Draft title');
  assert.equal(h.document.querySelector('#noteInput').value, 'unsaved draft');
  assert.equal(h.document.querySelector('#retentionSelect').value, '7d');
});
test('save updates search/export and restores focus when the item leaves the current search', () => {
  const h = launch({ persistent: [item('one')] });
  h.app.setView('active', 'original'); h.start('one'); h.save('https://new.example/', 'changed');
  assert.equal(h.app.getVisibleItems().length, 0);
  assert.equal(h.document.activeElement.id, 'searchInput');
  h.app.setView('active', 'changed'); assert.equal(h.app.getVisibleItems().length, 1);
  const markdown = h.app.markdownFor(h.app.allItems());
  assert.match(markdown, /https:\/\/new.example\//); assert.match(markdown, /changed/); assert.doesNotMatch(markdown, /Clipboard title|original/);
});
test('Unicode and HTML-like note text are preserved and escaped in cards', () => {
  const h = launch({ persistent: [item('one')] });
  h.start('one'); h.save('/資料/<report>.txt', '<img src=x onerror=alert(1)> & 日本語 😀');
  const actual = h.app.findItem('one'); const card = h.app.itemCard(actual);
  assert.equal(actual.note, '<img src=x onerror=alert(1)> & 日本語 😀');
  assert.doesNotMatch(card, /<img src=x/); assert.match(card, /&lt;img/); assert.match(card, /日本語 😀/);
});
test('PiP changes while editing use the current item and removed items are never recreated', () => {
  const h = launch({ persistent: [item('one'), item('two')] });
  const pip = makeDocument(); h.app.bindListEvents(pip);
  h.app.setPip({ document: pip, closed: false, setTimeout() {} });
  h.start('one'); h.action('one', 'done', pip); h.save('https://edited.example/', 'edited');
  assert.equal(h.app.findItem('one').done, true); assert.equal(h.app.findItem('one').note, 'edited');
  assert.doesNotMatch(pip.querySelector('#pipList').innerHTML, /edited.example/);
  h.start('two'); h.action('two', 'remove', pip); h.save('https://never.example/', 'never');
  assert.equal(h.app.findItem('two'), null); assert.equal(h.read().length, 1);
  assert.ok(h.document.querySelector('#editError').textContent);
});
test('successful edit synchronizes the active floating list without touching its input draft', () => {
  const h = launch({ session: [item('one', { expiresAt: 'session' })] });
  const pip = makeDocument(); pip.querySelector('#pipUrl').value = '/draft.txt';
  h.app.setPip({ document: pip, closed: false, setTimeout() {} });
  h.start('one'); h.save('/updated/資料.txt', 'changed');
  assert.match(pip.querySelector('#pipList').innerHTML, /資料.txt/);
  assert.match(pip.querySelector('#pipList').innerHTML, /data-action="copy-path"/);
  assert.equal(pip.querySelector('#pipUrl').value, '/draft.txt');
});
test('a failed owning-store write leaves the item and dialog draft intact for retry', () => {
  for (const isSession of [false, true]) {
    const original = item('one', { expiresAt: isSession ? 'session' : null });
    const h = launch(isSession ? { session: [original] } : { persistent: [original] });
    const store = isSession ? h.tab : h.local; store.fail = true;
    h.start('one'); h.save('/updated.txt', 'new note');
    assert.deepEqual(plain(h.app.findItem('one')), original);
    assert.equal(h.document.querySelector('#editDialog').open, true);
    assert.equal(h.document.querySelector('#editUrlInput').value, '/updated.txt');
    assert.ok(h.document.querySelector('#editError').textContent);
    store.fail = false; h.save('/updated.txt', 'new note');
    assert.equal(h.app.findItem('one').url, '/updated.txt');
    assert.equal(h.document.querySelector('#editDialog').open, false);
  }
});
test('note-only and no-op edits remain possible for historical items sharing an active destination', () => {
  const h = launch({ persistent: [item('one', { done: true, url: 'https://same.example/' }), item('two', { url: 'https://same.example/' })] });
  h.start('one'); h.save('https://same.example/', 'history note');
  assert.equal(h.app.findItem('one').note, 'history note');
  assert.equal(h.document.querySelector('#editDialog').open, false);
});
test('Edit event opens existing records only, Enter saves, and IME confirmation does not save', () => {
  const h = launch({ persistent: [item('one')] });
  h.action('one', 'edit'); assert.equal(h.document.querySelector('#editDialog').open, true);
  h.document.querySelector('#editNoteInput').value = 'changed';
  h.document.querySelector('#editUrlInput').dispatch('keydown', { key: 'Enter', isComposing: true });
  assert.equal(h.app.findItem('one').note, 'original');
  h.document.querySelector('#editUrlInput').dispatch('keydown', { key: 'Enter', isComposing: false });
  assert.equal(h.app.findItem('one').note, 'changed');
  h.action('missing', 'edit'); assert.equal(h.document.querySelector('#editDialog').open, false);
});
test('adding, retention, filtering, path helpers, completion and removal still work', () => {
  const h = launch();
  assert.equal(h.app.addItem('https://example.com', 'web note', 'keep', 'A title'), true);
  assert.equal(h.app.addItem('https://EXAMPLE.com:443/', 'duplicate', 'session'), false);
  assert.equal(h.app.addItem('javascript:alert(1)', '', 'session'), false);
  assert.equal(h.app.addItem('file:///C:/work/report%20one.txt', 'file note', 'session'), true);
  assert.equal(h.readSession().length, 1); assert.equal(h.read().length, 1);
  assert.equal(h.app.localPath('file:///C:/work/report%20one.txt'), 'C:\\work\\report one.txt');
  assert.equal(h.app.parentPath('C:\\work\\report.txt'), 'C:\\work');
  assert.equal(h.app.titleFor({ url: '\\\\server\\share\\report.txt' }), 'report.txt');
  const web = h.read()[0]; h.action(web.id, 'done');
  h.app.setView('done'); assert.equal(h.app.getVisibleItems()[0].id, web.id);
  h.action(web.id, 'done'); assert.equal(h.app.getVisibleItems().length, 0);
  h.action(web.id, 'remove'); assert.equal(h.app.findItem(web.id), null);
});
