// Runs the built content script (dist/content.js) in real Chrome pages and drives it with real, trusted
// mouse and key events through the DevTools protocol. Only the service worker is stood in for:
// chrome.runtime.sendMessage answers the way src/background.js does.
//
//   npm run test:browser          builds the content script first, then runs this
//   CHROME_PATH=/path/to/chrome node e2e/menu.mjs
//
// Needs a Chrome or Chromium install. It opens it headless with a throwaway profile.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'dist/content.js'), 'utf8');
const devDir = join(root, 'dev');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((path) => path && existsSync(path));
if (!chromePath) {
  console.error('Chrome not found. Install it, or set CHROME_PATH to its executable.');
  process.exit(1);
}

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#c00"/></svg>';
const web = createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(ICON); return; }
  const file = join(devDir, new URL(req.url, 'http://x').pathname);
  if (!existsSync(file) || file === devDir) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end(readFileSync(file));
});
await new Promise((r) => web.listen(0, r));
const origin = `http://localhost:${web.address().port}`;

const port = 9600 + Math.floor(Math.random() * 300);
const proc = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'passdrop-e2e-'))}`,
  '--no-first-run', '--window-size=900,700', 'about:blank'
], { stdio: 'ignore' });

let page;
for (let i = 0; i < 60 && !page; i++) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!page) await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
  return r.result.result.value;
};
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });

// What Chrome gives a content script, plus a stand-in service worker that answers like background.js does.
// attachShadow is wrapped only so the TEST can hold the (still closed) root; the page cannot read it.
const STUB = `
  window.__sent = []; window.__logins = [{ id: 'a', title: 'Local dev', username: 'alice' }]; window.__auth = true;
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) { return (window.__root = attach.call(this, init)); };
  globalThis.chrome = { runtime: { id: 'ext', sendMessage: async (m) => {
    window.__sent.push(m);
    if (!window.__auth) return { ok: false, code: 'auth', error: 'Please sign in.' };
    if (m.type === 'logins') return { ok: true, logins: window.__logins };
    if (m.type === 'credentials') return window.__logins.some((l) => l.id === m.id)
      ? { ok: true, username: 'alice', password: 's3cret!' } : { ok: false, code: 'server', error: 'no' };
    return { ok: false, code: 'server', error: 'Request not allowed.' };
  } } };`;
async function open(kase, prelude = '') {
  await send('Page.navigate', { url: `${origin}/test-forms.html?case=${kase}` });
  await sleep(1000);
  await evaluate(`${STUB}\n${prelude}\n${code}`); // injected the way Chrome does at document_idle
}

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`); };
const values = () => evaluate(`JSON.stringify(Object.fromEntries([...document.querySelectorAll('input')].map(i => [i.id, Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(i)])))`).then(JSON.parse);
const sent = () => evaluate('JSON.stringify(window.__sent.map(m => m.type))').then(JSON.parse);
const HOST = `document.documentElement.querySelector(':scope > div[style*="2147483647"]')`;
const menuOpen = () => evaluate(`!!${HOST}`);
const rows = () => evaluate('window.__root ? JSON.stringify([...window.__root.querySelectorAll("button")].map(b => b.textContent)) : "[]"').then(JSON.parse);
const menuText = () => evaluate('window.__root ? window.__root.textContent : ""');
const filled = (v) => v.username === 'alice' && v.password === 's3cret!';

// real (trusted) input through the browser, at the middle of an element
const centre = (expr) => evaluate(`(() => { const r = (${expr}).getBoundingClientRect(); return JSON.stringify([r.left + r.width / 2, r.top + r.height / 2]); })()`).then(JSON.parse);
async function realClick(expr, wait = 350) {
  const [x, y] = await centre(expr);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(wait);
}
const field = (name) => `document.getElementById('${name}')`;
const row = (n = 0) => `window.__root.querySelectorAll('button')[${n}]`;
const key = async (k, vk, text) => {
  await send('Input.dispatchKeyEvent', text ? { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: vk, text } : { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk });
  await sleep(250);
};

let v;

// ---- the basics
await open('plain');
check('plain: no menu at load, and only the list is asked for, never credentials', !(await menuOpen()) && !(await sent()).includes('credentials') && (await sent()).every((t) => t === 'logins'), JSON.stringify(await sent()));
await realClick(field('username'));
check('plain: clicking the username opens the menu', await menuOpen());
check('plain: it lists the title and username', (await rows()).length === 1 && /Local dev/.test((await rows())[0]) && /alice/.test((await rows())[0]), JSON.stringify(await rows()));
check('plain: only the list was requested, no credentials yet', (await sent()).includes('logins') && !(await sent()).includes('credentials'), JSON.stringify(await sent()));
check('plain: no password text is in the menu or the page', !(await menuText()).includes('s3cret') && !(await evaluate('document.documentElement.outerHTML')).includes('s3cret'));
check('plain: the page cannot reach into the menu (closed shadow root)', await evaluate(`${HOST}.shadowRoot === null`));
v = await values();
check('plain: nothing is filled before a row is chosen', v.username === '' && v.password === '', JSON.stringify(v));
await evaluate(`${row()}.click()`);
await sleep(300);
v = await values();
check('plain: a click made by the page itself on a row is ignored', v.username === '' && !(await sent()).includes('credentials') && (await menuOpen()));
await realClick(row());
v = await values();
check('plain: a real click on the row asks for that one login', (await sent()).filter((t) => t === 'credentials').length === 1);
check('plain: both fields are filled', filled(v), JSON.stringify(v));
check('plain: the menu is gone and does not pop up again', !(await menuOpen()));
check('plain: the cursor ends in the password field', (await evaluate('document.activeElement.id')) === 'password');

await open('plain');
await realClick(field('username'));
await key('Escape', 27);
check('plain: Escape closes the menu and keeps focus in the field', !(await menuOpen()) && (await evaluate('document.activeElement.id')) === 'username');
await realClick(field('password'));
check('plain: clicking the password field opens it too', await menuOpen());
await realClick('document.getElementById("title")');
check('plain: clicking elsewhere on the page closes it', !(await menuOpen()));
await realClick(field('username'));
await key('ArrowDown', 40);
check('plain: ArrowDown moves into the menu', await evaluate('(() => { try { return window.__root.activeElement?.tagName === "BUTTON"; } catch { return false; } })()'));
await key('Enter', 13, String.fromCharCode(13));
v = await values();
check('plain: Enter on the row fills the login (a keyboard pick is allowed)', filled(v), JSON.stringify(v));

await open('plain', `window.__logins = [{ id: 'a', title: 'Personal', username: 'alice' }, { id: 'b', title: 'Work', username: 'alice.w' }];`);
await realClick(field('username'));
check('plain: two logins are two rows', (await rows()).length === 2, JSON.stringify(await rows()));

// ---- kinds of forms
await open('controlled');
await realClick(field('username'));
await realClick(row());
const seen = await evaluate(`document.getElementById('seen').textContent`);
check('controlled: the page framework noticed both values', /username seen by framework: alice/.test(seen) && /password seen by framework: s3cret!/.test(seen), JSON.stringify(seen));

await open('decoy');
await realClick(field('username'));
await realClick(row());
v = await values();
const decoys = ['decoy-hidden', 'decoy-offpage', 'decoy-clear', 'decoy-tiny', 'decoy-right', 'decoy-clip', 'decoy-legacyclip', 'decoy-overflow'];
check('decoy: the real fields are filled', filled(v), JSON.stringify(v));
check('decoy: hidden, off-page (left and right), transparent, 1px, clip-path, clip and overflow-clipped fields stay empty',
  decoys.every((d) => v[d] === ''), JSON.stringify(Object.fromEntries(decoys.map((d) => [d, v[d]]))));

await open('signup');
await realClick(field('password'));
check('signup: no menu, and the service worker is not even asked', !(await menuOpen()) && (await sent()).length === 0, JSON.stringify(await sent()));

await open('twostep');
await realClick(field('email'));
await realClick(row());
v = await values();
check('twostep: first step fills only the email', v.email === 'alice', JSON.stringify(v));
await evaluate(`document.getElementById('next').click()`);
await sleep(300);
await realClick(field('password'));
check('twostep: the menu opens again on the password step', await menuOpen());
await realClick(row());
v = await values();
check('twostep: second step fills only the password', v.password === 's3cret!', JSON.stringify(v));

await open('search');
await realClick(field('site-search'));
check('search: clicking the site search box opens nothing', !(await menuOpen()));

// ---- the form that was clicked is the form that is filled
await open('twoforms');
await realClick(field('username2'));
await realClick(row());
v = await values();
check('twoforms: clicking in the second form fills the second form', v.username2 === 'alice' && v.password2 === 's3cret!' && v.username === '' && v.password === '', JSON.stringify(v));

await open('plain');
await realClick(field('username'));
await evaluate(`document.getElementById('stage').innerHTML = '<form><input id="username" type="text"><input id="password" type="password"></form>'`);
await realClick(row());
v = await values();
check('replaced form: if the clicked field left the page, nothing is filled anywhere', v.username === '' && v.password === '', JSON.stringify(v));

// ---- a page that tries to trick the click
const attack = async (name, tamper, { closes = false } = {}) => {
  await open('plain');
  await realClick(field('username'));
  await evaluate(tamper);
  await sleep(100);
  if (closes) {
    check(`clickjacking (${name}): the menu closes itself`, !(await menuOpen()));
    return;
  }
  await realClick(row());
  v = await values();
  check(`clickjacking (${name}): the click fills nothing and asks for no password`, v.username === '' && v.password === '' && !(await sent()).includes('credentials'), JSON.stringify([v, await sent()]));
};
await attack('faded out by script', `${HOST}.style.opacity = '0'`, { closes: true });
await attack('moved by script', `${HOST}.style.left = '5px'`, { closes: true });
await attack('faded out by a CSS rule', `document.head.insertAdjacentHTML('beforeend', '<style>div[style*="2147483647"] { opacity: 0 !important }</style>')`);
await attack('hidden by a filter rule', `document.head.insertAdjacentHTML('beforeend', '<style>div[style*="2147483647"] { filter: opacity(0) !important }</style>')`);
await attack('shifted by a rule on the page', `document.head.insertAdjacentHTML('beforeend', '<style>html { position: relative; top: 40px }</style>')`);
await attack('covered by a decoy button', `(() => { const d = document.createElement('button'); d.textContent = 'Play'; d.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;opacity:.01'; document.documentElement.append(d); })()`); // appended after the menu, so it paints on top

await open('plain');
await realClick(field('username'), 0);
await sleep(60);
const early = await menuOpen();
if (early) await realClick(row(), 100);
v = await values();
check('clickjacking (too soon): a click right after the menu appears is ignored', !early || (v.username === '' && !(await sent()).includes('credentials')), JSON.stringify([early, v]));

await open('plain');
await realClick(field('username'));
await realClick(row());
check('clickjacking: an untouched menu still works after all that', filled(await values()));

// ---- events the page makes up
for (const [what, script] of [
  ['click()', `document.getElementById('username').click()`],
  ['a dispatched focusin', `document.getElementById('username').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))`],
  ['a dispatched click', `document.getElementById('username').dispatchEvent(new MouseEvent('click', { bubbles: true }))`]
]) {
  await open('plain');
  await sleep(300);
  const before = (await sent()).length;
  await evaluate(script);
  await sleep(500);
  check(`untrusted events: the page calling ${what} opens no menu and asks for nothing`, !(await menuOpen()) && (await sent()).length === before, JSON.stringify(await sent()));
}

await open('plain');
await sleep(300);
const base = (await sent()).filter((t) => t === 'logins').length;
for (let i = 0; i < 6; i++) { await realClick(field(i % 2 ? 'password' : 'username'), 60); }
check('lookups: moving between fields quickly reuses the list instead of asking each time', (await sent()).filter((t) => t === 'logins').length - base === 0, JSON.stringify(await sent()));

// ---- the browser's own list, icons, placement, states
await open('plain');
await sleep(300);
await realClick(field('username'));
check('browser list: the field is marked autocomplete=off once PassDrop has something to offer', (await evaluate(`document.getElementById('username').getAttribute('autocomplete')`)) === 'off');
await open('plain', 'window.__logins = [];');
await realClick(field('username'));
check('browser list: left alone on a page with no saved login', (await evaluate(`document.getElementById('username').getAttribute('autocomplete')`)) === null);
await open('twostep');
await sleep(300);
await realClick(field('email'));
check('browser list: the two-step field is switched off', (await evaluate(`document.getElementById('email').getAttribute('autocomplete')`)) === 'off');
await realClick(row());
v = await values();
check('browser list: and its original "username" hint is still understood afterwards', v.email === 'alice', JSON.stringify(v));

await open('plain');
await realClick(field('username'));
await sleep(500);
check("icon: the page's own icon replaces the letter", await evaluate(`!!window.__root.querySelector('.avatar.icon img')`));
await open('plain');
await evaluate(`document.head.insertAdjacentHTML('beforeend', '<link rel="icon" href="/nope.png">')`);
await realClick(field('username'));
await sleep(500);
check('icon: when it cannot be loaded the letter stays', (await evaluate(`window.__root.querySelector('.avatar').textContent`)) === 'L');

const box = `JSON.stringify((() => { const r = ${HOST}.getBoundingClientRect(); const f = document.getElementById('username').getBoundingClientRect(); return { menuTop: r.top, menuBottom: r.bottom, fieldBottom: f.bottom, fieldTop: f.top, left: r.left, right: r.right, vw: innerWidth }; })())`;
await open('plain');
await realClick(field('username'));
let b = JSON.parse(await evaluate(box));
check('placement: the menu sits below the field, with a gap', b.menuTop >= b.fieldBottom + 6, JSON.stringify(b));
await open('plain');
await evaluate(`document.body.style.marginTop = '440px'`);
await realClick(field('username'));
b = JSON.parse(await evaluate(box));
check('placement: with no room below, it goes above the field and stays inside the window', b.menuBottom <= b.fieldTop && b.left >= 0 && b.right <= b.vw, JSON.stringify(b));

await open('plain', 'window.__auth = false;');
await realClick(field('username'));
check('signed out: a hint to sign in, and no rows', (await menuOpen()) && (await rows()).length === 0 && /Sign in/.test(await menuText()));

await open('plain');
await evaluate(`const orig = chrome.runtime.sendMessage; chrome.runtime.sendMessage = async (m) => m.type === 'credentials' ? { ok: false, code: 'server', error: 'no' } : orig(m)`);
await realClick(field('username'));
await realClick(row());
v = await values();
check('refused: nothing is filled when the service worker says no', v.username === '' && v.password === '', JSON.stringify(v));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
ws.close(); proc.kill(); web.close();
process.exit(failed ? 1 : 0);
