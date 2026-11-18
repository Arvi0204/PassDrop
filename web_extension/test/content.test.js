import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// The real content script, bundled and run in jsdom with a fake `chrome`.
// jsdom can only make untrusted events, so this file proves what the script must NOT do for a page's own
// events. What a real click does (menu, fill, clickjacking) is covered by `npm run test:browser`.
const PAGE = '<!doctype html><form><input id="u" type="text"><input id="p" type="password"></form>';

let bundle;
let window;
let sent;

// `import x from 'file.svg?raw'` is Vite's; give esbuild the same meaning
const rawFiles = {
  name: 'raw-files',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (args) => ({ path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({ contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))}`, loader: 'js' }));
  }
};

before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/content.js', import.meta.url))],
    bundle: true, write: false, format: 'iife', logLevel: 'silent', plugins: [rawFiles]
  });
  bundle = result.outputFiles[0].text;
});

// load the script into a fresh page; `html` may have no login form
async function load(html = PAGE) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/login', pretendToBeVisual: true });
  window = dom.window;
  window.Element.prototype.getBoundingClientRect = () => ({ left: 10, top: 10, right: 210, bottom: 40, width: 200, height: 30 }); // no layout in jsdom
  sent = [];
  window.chrome = {
    runtime: {
      id: 'ext',
      sendMessage: async (message) => {
        sent.push(message.type);
        return message.type === 'logins'
          ? { ok: true, logins: [{ id: 'a', title: 'Example', username: 'alice' }] }
          : { ok: true, username: 'alice', password: 'secret' };
      }
    }
  };
  window.eval(bundle);
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const menus = () => [...window.document.documentElement.children].filter((el) => el.style.zIndex === '2147483647');
const fire = (element, Type, name) => element.dispatchEvent(new window[Type](name, { bubbles: true }));

beforeEach(() => { window = null; });

test('on a page with a login form it asks once for the list of logins, never for a password', async () => {
  await load();
  assert.deepEqual(sent, ['logins']);
});

test('on a page with no login form it sends nothing at all', async () => {
  await load('<!doctype html><p>No form here</p><input id="q" type="text" placeholder="Search">');
  assert.deepEqual(sent, []);
});

// One event per page: events fired back to back cancel each other's pending lookup, which would make this pass
// even without the check it is meant to prove.
for (const [what, run] of [
  ['click()', (field) => field.click()],
  ['a dispatched focusin', (field) => fire(field, 'FocusEvent', 'focusin')],
  ['a dispatched click', (field) => fire(field, 'MouseEvent', 'click')]
]) {
  test(`the page calling ${what} on a login field opens no menu and asks for nothing`, async () => {
    await load();
    run(window.document.getElementById('u'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(menus().length, 0);
    assert.deepEqual(sent, ['logins']); // only the one at load
  });
}

test('nothing is ever filled by events the page makes', async () => {
  await load();
  const field = window.document.getElementById('u');
  field.click();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(window.document.getElementById('u').value, '');
  assert.equal(window.document.getElementById('p').value, '');
  assert.ok(!sent.includes('credentials'));
});
