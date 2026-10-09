'use strict';
// A dependency-free behavior harness for the actual inline app script.
// DOM, keyboard, PiP and downloads use controlled doubles; native browser behavior is not covered.
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
      focus() { doc.activeElement = element; }, select() {}, children: [], append(child) { this.children.push(child); child.parent = this; }, remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }, click() { this.dispatch('click'); },
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
  const dataName = value => value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  doc.querySelectorAll = selector => {
    const key = selector.match(/^\[data-([a-z0-9-]+)\]$/)?.[1];
    return key ? [...nodes.values()].filter(element => element.dataset[dataName(key)]) : [];
  };
  for (const tag of html.split('<script>')[0].matchAll(/<[a-z][^>]*>/g)) {
    const id = tag[0].match(/\bid="([^"]+)"/)?.[1];
    if (!id && !tag[0].includes('data-i18n')) continue;
    const element = doc.querySelector('#' + (id || `translated-${nodes.size}`));
    for (const [, name, value] of tag[0].matchAll(/([a-z0-9-]+)="([^"]*)"/g)) {
      if (name.startsWith('data-')) element.dataset[dataName(name.slice(5))] = value;
      else if (name !== 'style') element.setAttribute(name, value);
    }
  }
  return doc;
}
function launch({ clipboard = {}, downloadThrows = false, onDownload = () => {}, persistent = [], session = [], local = storage({ [PERSISTENT]: JSON.stringify(persistent) }), tab = storage({ [SESSION]: JSON.stringify(session) }) } = {}) {
  const document = makeDocument();
  const downloads = [], blobs = [], revoked = [], scheduled = [];
  const originalCreate = document.createElement;
  document.createElement = tag => { const element = originalCreate(tag); if (tag === 'a') { element.click = () => { if (downloadThrows) throw new Error('blocked download'); downloads.push({ name: element.download, url: element.href }); onDownload(); }; } return element; };
  class CaptureURL extends URL { static createObjectURL(blob) { blobs.push(blob); return 'blob:local-test'; } static revokeObjectURL(url) { revoked.push(url); } }
  class CaptureBlob { constructor(parts, options) { this.parts = parts; this.type = options.type; } }

  const pip = { document: makeDocument(), closed: false, addEventListener() {}, setTimeout() { return 1; } };
  const documentPictureInPicture = { requestWindow: async () => pip };
  const window = { documentPictureInPicture, localStorage: local, sessionStorage: tab, isSecureContext: false, setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; } };
  const context = vm.createContext({ document, window, documentPictureInPicture, navigator: { language: 'en', clipboard }, Blob: CaptureBlob, URL: CaptureURL, Intl, Date, setTimeout: () => 1, clearTimeout() {}, confirm: () => true });
  const exposed = source.replace(/\}\)\(\);\s*$/, `globalThis.app = { expiry, isExpired, expiryLabel, exportMarkdown, openFloating, copyText, clearDone, clearExpired, clearAll, mainAdd, toggleLanguage, addItem, findItem, allItems, activeItems, getVisibleItems, itemCard, markdownFor, classify, canonical, titleFor, localPath, parentPath, openEdit, saveEdit, bindListEvents, setView(f, q = '') { filter = f; query = q; }, setPip(p) { pipWindow = p; }, render, translations }; })();`);
  vm.runInContext(exposed, context);
  const app = context.app;
  function start(id) { app.openEdit(id); return document.querySelector('#editDialog'); }
  function save(url, note) { document.querySelector('#editUrlInput').value = url; document.querySelector('#editNoteInput').value = note; document.querySelector('#editSaveButton').click(); }
  function action(id, action, doc = document) { const card = { dataset: { id } }; const button = { dataset: { action }, closest: () => card }; doc.dispatch('click', { target: { closest: () => button } }); }
  return { app, document, window, context, pip, local, tab, downloads, blobs, revoked, scheduled, setDownloadFailure(value) { downloadThrows = value; }, start, save, action, read: () => JSON.parse(local.getItem(PERSISTENT) || '[]'), readSession: () => JSON.parse(tab.getItem(SESSION) || '[]') };
}
const item = (id, overrides = {}) => ({ id, url: `https://${id}.example/`, kind: 'web', note: 'original', title: 'Clipboard title', createdAt: 123, done: false, expiresAt: null, ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));


test('all export deliberately ignores the active search/filter, includes both stores and done/expired', () => {
  const h = launch({persistent: [item('web', {createdAt: 1}), item('done', {done: true, createdAt: 3}), item('expired', {expiresAt: '2000-01-01', createdAt: 2})], session: [item('tab', {expiresAt: 'session',createdAt: 4})]});
  h.app.setView('active','web');
  assert.deepEqual(plain(h.app.getVisibleItems().map(x => x.id)), ['web']);
  h.app.exportMarkdown();
  assert.equal(h.downloads.length, 1);
  for (const id of ['web','done','expired','tab']) assert.match(h.blobs[0].parts[0], new RegExp('https://' + id + '\\.example/'));
  assert.match(h.downloads[0].name, /^temporary-links-\d{4}-\d{2}-\d{2}\.md$/);
  assert.equal(h.blobs[0].type, 'text/markdown;charset=utf-8');
  h.scheduled.splice(0).forEach(fn => fn()); assert.deepEqual(h.revoked, ['blob:local-test']);
});
test('search and status/expiry filtering are consistent, including local path decoding', () => {
  const h = launch({ persistent: [item('old', {createdAt: 1}), item('new', {createdAt: 3}), item('done', {done: true, createdAt: 5}), item('expired', {expiresAt:'2000-01-01', createdAt: 4}), item('path', {kind:'file', url:'file:///C:/Work/Report%20One.txt', title:'', note:'資料',createdAt:2})] });
  for (const [filter,expected] of [['active',['new','path','old']], ['all',['expired','new','path','old','done']], ['done',['done']], ['expired',['expired']]]) { h.app.setView(filter); assert.deepEqual(plain(h.app.getVisibleItems().map(x=>x.id)), expected); }
  h.app.setView('all','  REPORT ONE  '); assert.deepEqual(plain(h.app.getVisibleItems().map(x=>x.id)), ['path']);
  h.app.setView('all','資料'); assert.equal(h.app.getVisibleItems()[0].id,'path');
  for (const expiresAt of ['session',null,'2099-01-01']) assert.equal(h.app.isExpired(item('x',{expiresAt})), false);
  assert.equal(h.app.isExpired(item('x',{expiresAt:'2000-01-01'})),true);
});
test('completion and Restore preserve item identity, expiry and storage ownership', () => {
  const original = item('tab',{expiresAt:'session'}); const h = launch({session:[original]});
  h.action('tab','done'); assert.equal(h.readSession()[0].done,true);
  h.action('tab','done'); assert.deepEqual(h.readSession(), [original]);
});
test('clipboard async success, fallback success, and failure show the right localized messages', async () => {
  let copied; const h=launch({clipboard:{writeText:async text=>{copied=text;}}});
  await h.app.copyText('/資料.txt'); assert.equal(copied,'/資料.txt'); assert.equal(h.document.querySelector('#toast').textContent,h.app.translations.en.copied);
  const fallback=launch({clipboard:{writeText:async()=>{throw Error('denied');}}});
  fallback.document.execCommand=()=>true; await fallback.app.copyText('/folder/a.txt'); assert.equal(fallback.document.querySelector('#toast').textContent,fallback.app.translations.en.copied);
  fallback.document.execCommand=()=>false; await fallback.app.copyText('/folder/a.txt'); assert.equal(fallback.document.querySelector('#toast').textContent,fallback.app.translations.en.copyFailed);
});
// These assertions fail if scope selection falls back to allItems, stale UI counts are used,
// validation diverges from Edit, IME Enter submits, or failed download initiation leaks a URL.
const scope = (h, value) => { const node = h.document.querySelector('#exportScope'); node.value = value; node.dispatch('change'); };
const preview = h => h.document.querySelector('#exportSummary').textContent;
const filename = h => h.document.querySelector('#exportFilename').textContent;
const contents = h => h.blobs.at(-1).parts.join('');
const rows = () => [
  item('old', { title: 'Old reference', createdAt: 1 }),
  item('new', { title: 'New reference', createdAt: 5 }),
  item('done', { title: 'Done reference', done: true, createdAt: 9 }),
  item('expired', { title: 'Expired reference', expiresAt: '2000-01-01', createdAt: 8 }),
  item('path', { kind: 'file', url: 'file:///C:/Work/Report%20One.txt', title: '', note: '資料', createdAt: 3 })
];

test('export scope has bilingual labels, an associated preview and no new persistence keys', () => {
  const h = launch({ persistent: rows() });
  assert.match(html, /<label[^>]+for="exportScope"[^>]+data-i18n="exportScopeLabel"/);
  assert.match(html, /<select[^>]+id="exportScope"[^>]+aria-describedby="exportPreview exportEmptyHint"/);
  assert.match(html, /<option value="all"[^>]+data-i18n="exportAll"/);
  assert.match(html, /<option value="visible"[^>]+data-i18n="exportVisible"/);
  assert.match(html, /id="exportPreview"[^>]+aria-live="polite"/);
  for (const key of ['exportScopeLabel', 'exportAll', 'exportVisible', 'exportCount', 'exportVisibleEmpty', 'exportFailed']) {
    assert.ok(h.app.translations.en[key], key); assert.ok(h.app.translations.ja[key], key);
  }
  scope(h, 'visible'); scope(h, 'all');
  assert.equal(h.local.writes, 0); assert.equal(h.tab.writes, 0);
  assert.equal(launch({ local: h.local, tab: h.tab }).document.querySelector('#exportScope').value, 'all');
});

test('default all export preserves exact old contents, storage order and date-only filename', () => {
  const h = launch({ persistent: rows(), session: [item('tab', { expiresAt: 'session', createdAt: 10 })] });
  h.app.setView('done', 'no match'); h.app.render();
  assert.equal(h.document.querySelector('#exportScope').value, 'all');
  assert.equal(preview(h), '6 items');
  assert.match(filename(h), /^temporary-links-\d{4}-\d{2}-\d{2}\.md$/);
  h.document.querySelector('#exportButton').click();
  assert.equal(contents(h), h.app.markdownFor(h.app.allItems()));
  assert.equal(h.downloads[0].name, filename(h));
});

for (const [filter, expected] of [['active', ['new', 'path', 'old']], ['all', ['expired', 'new', 'path', 'old', 'done']], ['done', ['done']], ['expired', ['expired']]]) {
  test(`current-results export exactly matches ${filter} filter display ordering`, () => {
    const h = launch({ persistent: rows() });
    scope(h, 'visible');
    h.document.querySelector('#filterRow').dispatch('click', { target: { closest: () => ({ dataset: { filter } }) } });
    const visible = h.app.getVisibleItems();
    assert.deepEqual(plain(visible.map(row => row.id)), expected);
    assert.equal(preview(h), `${expected.length} ${expected.length === 1 ? 'item' : 'items'}`);
    h.document.querySelector('#exportButton').click();
    assert.equal(contents(h), h.app.markdownFor(visible));
    assert.match(h.downloads[0].name, /^temporary-links-visible-\d{4}-\d{2}-\d{2}\.md$/);
    assert.equal(h.downloads[0].name, filename(h));
  });
}

test('search uses the same title, URL, decoded path and Unicode-note matches as the list', () => {
  const h = launch({ persistent: rows() }); scope(h, 'visible'); h.app.setView('all');
  for (const [query, id] of [['  NEW REFERENCE  ', 'new'], ['done.example', 'done'], ['report one', 'path'], ['資料', 'path']]) {
    const input = h.document.querySelector('#searchInput'); input.value = query; input.dispatch('input');
    assert.equal(preview(h), '1 item');
    h.app.exportMarkdown();
    assert.equal(contents(h), h.app.markdownFor([h.app.findItem(id)]));
  }
});

test('preview and selected export update after edit, completion, Restore and removal', () => {
  const h = launch({ persistent: [item('one', { note: 'matching' })] }); scope(h, 'visible');
  h.app.setView('active', 'matching'); h.app.render(); assert.equal(preview(h), '1 item');
  h.start('one'); h.save('https://one.example/', 'changed'); assert.equal(preview(h), '0 items');
  h.app.setView('active', 'changed'); h.app.render(); assert.equal(preview(h), '1 item');
  h.action('one', 'done'); assert.equal(preview(h), '0 items');
  h.action('one', 'done'); assert.equal(preview(h), '1 item');
  h.app.exportMarkdown(); assert.match(contents(h), /changed/); assert.doesNotMatch(contents(h), /matching/);
  h.action('one', 'remove'); assert.equal(preview(h), '0 items');
});

test('zero visible results disable saving with an explanation and never export all records', () => {
  const h = launch({ persistent: rows() }); scope(h, 'visible'); h.app.setView('active', 'nothing matches'); h.app.render();
  assert.equal(h.document.querySelector('#exportButton').disabled, true);
  assert.equal(h.document.querySelector('#exportEmptyHint').hidden, false);
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, h.app.translations.en.exportVisibleEmpty);
  h.app.exportMarkdown();
  assert.equal(h.downloads.length, 0); assert.equal(h.blobs.length, 0);
  scope(h, 'all'); assert.equal(h.document.querySelector('#exportButton').disabled, false);
  assert.equal(h.document.querySelector('#exportEmptyHint').hidden, true);
  h.app.exportMarkdown(); assert.equal(h.downloads.length, 1);
});

test('an empty all-items export keeps the existing Markdown behavior in English and Japanese', () => {
  const h = launch();
  assert.equal(h.document.querySelector('#exportButton').disabled, false);
  h.app.exportMarkdown(); assert.match(contents(h), /_No items\._/);
  h.app.toggleLanguage(); h.app.exportMarkdown(); assert.match(contents(h), /_項目はありません。_/);
});

test('language changes update count, labels and empty-state copy without changing scope', () => {
  const h = launch({ persistent: rows() }); scope(h, 'visible');
  h.app.setView('done'); h.app.render();
  h.app.toggleLanguage();
  assert.equal(preview(h), '1 件'); assert.equal(h.document.querySelector('#exportScope').value, 'visible');
  assert.equal(h.document.querySelector('#exportScopeLabel').textContent, h.app.translations.ja.exportScopeLabel);
  h.app.exportMarkdown(); assert.match(contents(h), /_\(完了\)_/);
  h.app.setView('done', 'none'); h.app.render();
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, h.app.translations.ja.exportVisibleEmpty);
  h.app.toggleLanguage(); assert.equal(preview(h), '0 items');
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, h.app.translations.en.exportVisibleEmpty);
});

test('Save takes the selected scope and live results at click, then keeps that download snapshot', () => {
  let h;
  h = launch({ persistent: rows(), onDownload() { h.app.setView('all'); scope(h, 'all'); h.app.findItem('done').note = 'later mutation'; } });
  scope(h, 'visible'); h.app.setView('active'); h.app.render();
  // Change the view after preview creation: Save must not trust a stale cached list.
  h.app.setView('done');
  const expected = h.app.markdownFor(h.app.getVisibleItems());
  h.document.querySelector('#exportButton').click();
  assert.equal(contents(h), expected); assert.match(h.downloads[0].name, /-visible-/);
  assert.doesNotMatch(contents(h), /later mutation/);
});

test('opening More refreshes the current result count before choosing Save', () => {
  const h = launch({ persistent: rows() }); scope(h, 'visible');
  h.app.setView('expired'); h.document.querySelector('#moreTools').open = true; h.document.querySelector('#moreTools').dispatch('toggle');
  assert.equal(preview(h), '1 item');
});

test('Add and Edit reject the same malformed URLs while preserving the Add draft and stores', () => {
  for (const value of ['https://', 'http://', 'https://[invalid', 'https://bad host/', 'file://', 'file://[invalid', 'javascript:alert(1)', 'relative.txt', '']) {
    const h = launch({ persistent: [item('one')] });
    const input = h.document.querySelector('#urlInput'); input.value = value; input.dataset.pastedTitle = 'Draft title';
    h.document.querySelector('#noteInput').value = 'Draft note';
    input.dispatch('input');
    assert.equal(h.app.addItem(value, 'Draft note', 'keep'), false, value);
    h.app.mainAdd();
    assert.equal(input.value, value); assert.equal(h.document.querySelector('#noteInput').value, 'Draft note');
    assert.deepEqual(h.read(), [item('one')]); assert.equal(h.tab.writes, 0); assert.equal(h.local.writes, 0);
    if (value) assert.equal(h.document.querySelector('#inputHint').textContent, h.app.translations.en.hintInvalid);
    h.start('one'); h.save(value, 'note');
    assert.equal(h.document.querySelector('#editError').textContent, h.app.translations.en.hintInvalid);
  }
});

test('valid web URLs and supported local references remain accepted by Add and Edit', () => {
  for (const value of ['https://example.com/a?x=1#top', 'http://localhost:8080/', 'file:///C:/work/report%20one.txt', 'file://server/share/file.txt', 'C:\\work\\資料.txt', '\\\\server\\share\\file.txt', '/home/user/資料.txt']) {
    const h = launch(); assert.equal(h.app.addItem(value, 'note', 'keep'), true, value);
    const record = h.read()[0]; assert.equal(record.url, value);
    h.start(record.id); h.save(value, 'edited');
    assert.equal(h.document.querySelector('#editDialog').open, false, value); assert.equal(h.read()[0].note, 'edited');
  }
});

for (const event of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }]) {
  test(`main Add ignores composition Enter ${JSON.stringify(event)} and preserves its draft`, () => {
    const h = launch(); const input = h.document.querySelector('#urlInput');
    input.value = 'https://example.com/'; input.dataset.pastedTitle = 'Draft title';
    h.document.querySelector('#noteInput').value = '日本語入力中'; h.document.querySelector('#retentionSelect').value = 'keep';
    const sent = input.dispatch('keydown', event);
    assert.equal(sent.defaultPrevented, undefined); assert.equal(h.app.allItems().length, 0);
    assert.equal(input.value, 'https://example.com/'); assert.equal(input.dataset.pastedTitle, 'Draft title');
    assert.equal(h.document.querySelector('#noteInput').value, '日本語入力中'); assert.equal(h.local.writes, 0);
    input.dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 13 });
    assert.equal(h.read().length, 1); assert.equal(input.value, ''); assert.equal(h.document.querySelector('#noteInput').value, '');
  });
}

test('floating-window Add uses the same composition guard and still adds normally to the session', async () => {
  const h = launch(); h.window.isSecureContext = true; await h.app.openFloating();
  const input = h.pip.document.querySelector('#pipUrl'); input.value = '/資料.txt';
  input.dispatch('keydown', { key: 'Enter', isComposing: true });
  input.dispatch('keydown', { key: 'Enter', keyCode: 229 });
  assert.equal(h.app.allItems().length, 0); assert.equal(input.value, '/資料.txt');
  input.dispatch('keydown', { key: 'Enter', keyCode: 13 });
  assert.equal(h.readSession()[0].url, '/資料.txt'); assert.equal(input.value, ''); assert.equal(h.read().length, 0);
});

test('Edit also ignores legacy keyCode 229 without replacing the saved record', () => {
  const h = launch({ persistent: [item('one')] }); h.start('one'); const input = h.document.querySelector('#editUrlInput');
  input.value = 'https://changed.example/'; input.dispatch('keydown', { key: 'Enter', keyCode: 229 });
  assert.equal(h.document.querySelector('#editDialog').open, true); assert.deepEqual(h.read(), [item('one')]);
});

test('failed download initiation reports failure, removes its anchor, revokes its URL and permits retry', () => {
  const h = launch({ persistent: [item('one')], downloadThrows: true });
  assert.doesNotThrow(() => h.app.exportMarkdown());
  assert.equal(h.downloads.length, 0); assert.equal(h.document.body.children.length, 0);
  h.scheduled.splice(0).forEach(fn => fn()); assert.deepEqual(h.revoked, ['blob:local-test']);
  assert.equal(h.document.querySelector('#toast').textContent, h.app.translations.en.exportFailed);
  h.app.toggleLanguage(); h.app.exportMarkdown();
  assert.equal(h.document.querySelector('#toast').textContent, h.app.translations.ja.exportFailed);
  h.scheduled.splice(0).forEach(fn => fn()); h.revoked.length = 0;
  h.setDownloadFailure(false); h.app.exportMarkdown();
  assert.equal(h.downloads.length, 1); assert.equal(h.document.body.children.length, 0);
  h.scheduled.splice(0).forEach(fn => fn()); assert.deepEqual(h.revoked, ['blob:local-test']);
  assert.equal(h.document.querySelector('#toast').textContent, h.app.translations.ja.exported);
});

test('current results combine both stores and retain status ordering without rewriting either store', () => {
  const h = launch({ persistent: [item('old', { createdAt: 1 }), item('done', { createdAt: 99, done: true })], session: [item('tab', { createdAt: 8, expiresAt: 'session' })] });
  scope(h, 'visible'); h.app.setView('all'); h.app.render(); h.app.exportMarkdown();
  assert.equal(contents(h), h.app.markdownFor([h.app.findItem('tab'), h.app.findItem('old'), h.app.findItem('done')]));
  assert.equal(h.local.writes, 0); assert.equal(h.tab.writes, 0);
});

test('scope and preview remain coherent after adding and clearing records repeatedly', () => {
  const h = launch(); scope(h, 'visible');
  assert.equal(h.document.querySelector('#exportButton').disabled, true);
  for (let index = 0; index < 2; index++) {
    h.app.addItem('https://one.example/', '', 'keep'); assert.equal(preview(h), '1 item');
    h.app.addItem('/資料.txt', '', 'session'); assert.equal(preview(h), '2 items');
    h.action(h.app.allItems()[0].id, 'done'); assert.equal(preview(h), '1 item');
    h.app.clearDone(); assert.equal(preview(h), '1 item');
    h.app.clearAll(); assert.equal(preview(h), '0 items');
    assert.equal(h.document.querySelector('#exportScope').value, 'visible');
    assert.equal(h.document.querySelector('#exportButton').disabled, true);
  }
});

test('distribution stays a single self-contained app and CI discovers the whole test suite', () => {
  const path = require('node:path');
  const root = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(root, /location\.replace\('temporary-links\.html'\)/);
  assert.match(root, /content="0;url=temporary-links\.html"/);
  assert.match(html, /connect-src 'none'/); assert.doesNotMatch(html, /<script[^>]+src=/);
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/preview.yml'), 'utf8');
  assert.match(workflow, /run: node --test\s*\n/);
  assert.match(workflow, /Copy-Item -LiteralPath "\.\/temporary-links\.html" -Destination "\.\/preview-dist\/temporary-links\.html"/);
});

test('hidden accessible description never claims a non-empty or all-items export is empty', () => {
  const h = launch({ persistent: [item('one')] });
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, '');
  scope(h, 'visible'); h.app.setView('done'); h.app.render();
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, h.app.translations.en.exportVisibleEmpty);
  scope(h, 'all'); assert.equal(h.document.querySelector('#exportEmptyHint').textContent, '');
  scope(h, 'visible'); h.app.setView('active'); h.app.render();
  assert.equal(h.document.querySelector('#exportEmptyHint').textContent, '');
  h.app.toggleLanguage(); assert.equal(h.document.querySelector('#exportEmptyHint').textContent, '');
});


for (const stage of ['Blob', 'createObjectURL', 'createElement', 'href', 'download', 'append']) {
  test(`a controlled ${stage} failure cleans allocated resources and allows same-page retry`, () => {
    const h = launch({ persistent: [item('one')] });
    let restore;
    const fail = () => { throw new Error('controlled ' + stage); };
    if (stage === 'Blob') {
      const original = h.context.Blob; h.context.Blob = function () { fail(); }; restore = () => { h.context.Blob = original; };
    } else if (stage === 'createObjectURL') {
      const original = h.context.URL.createObjectURL; h.context.URL.createObjectURL = fail; restore = () => { h.context.URL.createObjectURL = original; };
    } else if (stage === 'append') {
      const original = h.document.body.append; h.document.body.append = fail; restore = () => { h.document.body.append = original; };
    } else {
      const original = h.document.createElement;
      h.document.createElement = tag => {
        if (tag === 'a' && stage === 'createElement') fail();
        const element = original(tag);
        if (tag === 'a') Object.defineProperty(element, stage, { set: fail });
        return element;
      };
      restore = () => { h.document.createElement = original; };
    }
    assert.doesNotThrow(() => h.app.exportMarkdown());
    assert.equal(h.downloads.length, 0); assert.equal(h.document.body.children.length, 0);
    assert.equal(h.document.querySelector('#toast').textContent, h.app.translations.en.exportFailed);
    h.scheduled.splice(0).forEach(fn => fn());
    assert.equal(h.revoked.length, ['Blob', 'createObjectURL'].includes(stage) ? 0 : 1);
    restore(); h.app.exportMarkdown();
    assert.equal(h.downloads.length, 1); assert.equal(h.document.body.children.length, 0);
    assert.equal(h.document.querySelector('#toast').textContent, h.app.translations.en.exported);
  });
}


// Removing target attributes, localizing EN/JA itself, resetting state on language
// changes, or reverting the single patch release must fail these regressions.
test('header uses stable EN/JA targets and localized target, privacy and Help text', () => {
  const h = launch();
  const language = h.document.querySelector('#languageButton');
  const help = h.document.querySelector('#helpButton');
  const localBadge = h.document.querySelectorAll('[data-i18n]').find(node => node.dataset.i18n === 'localBadge');
  for (const [lang, target, label, privacy, helpTitle] of [
    ['en', 'JA', 'Switch to Japanese', 'Fully local processing', 'How to use & notes'],
    ['ja', 'EN', '英語に切り替え', '完全ローカル処理', '使い方と注意事項'],
    ['en', 'JA', 'Switch to Japanese', 'Fully local processing', 'How to use & notes']
  ]) {
    assert.equal(h.document.documentElement.lang, lang);
    assert.equal(language.textContent, target);
    assert.equal(language['aria-label'], label);
    assert.equal(language.title, label);
    assert.equal(localBadge.textContent, privacy);
    assert.equal(help['aria-label'], helpTitle);
    assert.equal(help.title, helpTitle);
    help.click();
    assert.equal(h.document.querySelector('#helpDialog').open, true);
    h.document.querySelector('#closeHelpButton').click();
    assert.equal(h.document.querySelector('#helpDialog').open, false);
    language.click();
  }
});

test('language roundtrip preserves saved references, edit/add drafts, view and export scope', () => {
  const records = [item('one'), item('done', {done: true})];
  const tabRecords = [item('tab', {expiresAt: 'session'})];
  const h = launch({persistent: records, session: tabRecords});
  h.app.setView('active', 'one'); scope(h, 'visible'); h.app.render();
  h.document.querySelector('#urlInput').value = 'https://draft.example/';
  h.document.querySelector('#noteInput').value = '未保存のメモ';
  h.start('one');
  h.document.querySelector('#editUrlInput').value = 'https://edit.example/';
  h.document.querySelector('#editNoteInput').value = 'draft note';
  for (let i = 0; i < 2; i++) {
    h.document.querySelector('#languageButton').click();
    assert.deepEqual(h.read(), records);
    assert.deepEqual(h.readSession(), tabRecords);
    assert.deepEqual(plain(h.app.getVisibleItems().map(item => item.id)), ['one']);
    assert.equal(h.document.querySelector('#exportScope').value, 'visible');
    assert.equal(h.document.querySelector('#urlInput').value, 'https://draft.example/');
    assert.equal(h.document.querySelector('#noteInput').value, '未保存のメモ');
    assert.equal(h.document.querySelector('#editDialog').open, true);
    assert.equal(h.document.querySelector('#editUrlInput').value, 'https://edit.example/');
    assert.equal(h.document.querySelector('#editNoteInput').value, 'draft note');
  }
});

test('single-file release normalizes prior v1.0 and increments its patch once', () => {
  assert.equal(html.match(/class="version-badge">([^<]+)<\/span>/)?.[1], 'v1.0.3');
});


test('privacy badge describes the local processing boundary in both languages', () => {
  const h = launch();
  const badge = h.document.querySelectorAll('[data-i18n]').find(node => node.dataset.i18n === 'localBadge');
  assert.equal(badge.textContent, 'Fully local processing');
  h.document.querySelector('#languageButton').click();
  assert.equal(badge.textContent, '完全ローカル処理');
});
