// End-to-end check of the zero-knowledge vault in a real browser.
//
// It starts a throwaway MongoDB and the real API, serves the built web app (frontend/dist) from the same address like
// production does, and drives real headless Chrome with real clicks and typing over the DevTools protocol (the same
// technique as web_extension/e2e/menu.mjs). The flows are the ones that matter for "the server cannot read anything":
// sign-up with a recovery key, adding a login, a reload, a brand-new tab (which must be locked), a wrong and a right
// master password, sharing a login as a drop (opened once, then gone; revoked by the sender), changing the master password,
// signing in again, recovering with the recovery key, and finally a scan of the whole database for anything readable.
//
//   npm run test:e2e        (builds the web app first; needs Chrome, or set CHROME_PATH)

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'frontend', 'dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('frontend/dist is missing: run `npm run build:frontend` first (npm run test:e2e does)');
const fromBackend = createRequire(join(root, 'backend', 'package.json'));

// the server settings are set first, so a developer's .env can never point this test at a real database
process.env.NODE_ENV = 'production'; // no CORS, as on Vercel: the web app and the API share one address
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://never-connects.invalid/';
process.env.DB_NAME = 'e2e';

// the MongoDB version is pinned in backend/package.json; reading it here stops this script (which runs from the repo root,
// where that setting is not found) from downloading a different, much larger one
process.env.MONGOMS_VERSION = fromBackend('./package.json').config.mongodbMemoryServer.version;
const { MongoMemoryServer } = fromBackend('mongodb-memory-server-core');
const { MongoClient } = fromBackend('mongodb');
const express = fromBackend('express');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`); };

// ---- the secrets this run uses (made up; they must never appear in the database) ----
const MASTER = 'Correct-Horse-Battery-9!';
const MASTER2 = 'Another-Strong-Pass-7#';
const MASTER3 = 'Third-Strong-Pass-5$';
const LOGIN_TITLE = 'GitHubTitleXyz';
const LOGIN_USER = 'octocat-e2e-user';
const LOGIN_PASSWORD = 'S3cret-passw0rd!-e2e';
const EMAIL = 'ada.e2e@example.com';

// ---- server ----
const mongod = await MongoMemoryServer.create();
const mongoUri = mongod.getUri();
if (!mongoUri.startsWith('mongodb://127.0.0.1')) throw new Error(`refusing to run against ${mongoUri}`);
process.env.MONGODB_URI = mongoUri;
const api = fromBackend(join(root, 'backend', 'server.js'));
const web = express();
web.use((req, res, next) => (req.url.startsWith('/api/') ? api(req, res, next) : next()));
web.use(express.static(dist));
web.use((req, res) => res.sendFile(join(dist, 'index.html'))); // client-side routes
const server = createServer(web);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ---- Chrome ----
const chromePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
if (!chromePath) throw new Error('Chrome not found: set CHROME_PATH');
const debugPort = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-'))}`,
    '--no-first-run', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });

class Tab {
    constructor(ws) {
        this.ws = ws; this.id = 0; this.waiting = new Map(); this.errors = [];
        ws.onmessage = (m) => {
            const d = JSON.parse(m.data);
            if (d.id && this.waiting.has(d.id)) { this.waiting.get(d.id)(d); this.waiting.delete(d.id); }
            if (d.method === 'Runtime.exceptionThrown') this.errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
        };
    }
    static async open(url) {
        let target;
        for (let i = 0; i < 80 && !target; i++) {
            try { target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json(); } catch { await sleep(250); }
        }
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((r) => (ws.onopen = r));
        const tab = new Tab(ws);
        await tab.cdp('Runtime.enable'); await tab.cdp('Page.enable');
        await tab.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        tab.targetId = target.id;
        return tab;
    }
    cdp(method, params = {}) { return new Promise((res) => { const i = ++this.id; this.waiting.set(i, res); this.ws.send(JSON.stringify({ id: i, method, params })); }); }
    async eval(expression) {
        const r = await this.cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluation failed');
        return r.result.result.value;
    }
    // a tab in the background is throttled by Chrome, so the tab being driven is always brought to the front first
    front() { return this.cdp('Page.bringToFront'); }
    async goto(path) { await this.front(); await this.cdp('Page.navigate', { url: `${base}${path}` }); await sleep(400); }
    text() { return this.eval('document.body.innerText'); }
    async waitFor(expression, label, ms = 25000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { try { if (await this.eval(expression)) return true; } catch { /* the page is reloading */ } await sleep(150); }
        throw new Error(`timed out waiting for ${label}`);
    }
    async waitText(text, ms) {
        await this.front();
        return this.waitTextNow(text, ms);
    }
    waitTextNow(text, ms) { return this.waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`, `the text "${text}"`, ms); }
    waitPath(path, ms) { return this.waitFor(`location.pathname === ${JSON.stringify(path)}`, `the page ${path}`, ms); }
    async fill(selector, text) {
        await this.front();
        await this.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`, selector);
        await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select && el.select(); })()`);
        await this.cdp('Input.insertText', { text });
    }
    async click(selector, text) {
        await this.front();
        const find = `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => !${JSON.stringify(text || '')} || e.textContent.includes(${JSON.stringify(text || '')}))`;
        await this.waitFor(`!!(${find})`, `${selector} ${text || ''}`);
        const box = await this.eval(`(() => { const el = ${find}; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await this.cdp('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    close() { try { this.ws.close(); } catch { /* already gone */ } }
}

const authedFetch = (tab, token) => tab.eval(`fetch('/api/auth/me', { headers: { 'auth-token': ${JSON.stringify(token)} } }).then((r) => r.status)`);
const stored = (tab, key, where = 'localStorage') => tab.eval(`${where}.getItem(${JSON.stringify(key)})`);

async function run() {
    const tab = await Tab.open(`${base}/signup`);

    // ---- sign-up and the recovery key ----
    await tab.fill('#username', 'Ada');
    await tab.fill('#email', EMAIL);
    await tab.fill('#password', MASTER);
    await tab.fill('#confirmPassword', MASTER);
    await tab.click('button[type=submit]');
    // sign-up now runs its water animation straight into the vault: nothing may get in its way
    await tab.waitPath('/');
    await tab.waitFor(`document.body.innerText.includes('Add Account') || document.body.innerText.includes('Add')`, 'the vault');
    check('sign-up goes straight to the vault, with no recovery key screen in the way of the animation', !(await tab.eval(`!!document.querySelector('[data-testid=recovery-key]')`)));
    check('the Account link carries a dot while the recovery key has not been seen', await tab.eval(`!!document.querySelector('[aria-label="Your recovery key is waiting on the Account page"]')`));

    // ---- the first visit to the Account page shows the recovery key, once ----
    await tab.goto('/user');
    await tab.waitFor(`!!document.querySelector('[data-testid=recovery-key]')`, 'the recovery key popup');
    const firstKey = (await tab.eval(`document.querySelector('[data-testid=recovery-key]').textContent`)).trim();
    check('the Account page shows the recovery key in a popup (8 groups of 4 hex digits)', /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/.test(firstKey), firstKey);
    if (process.env.E2E_SHOT_DIR) writeFileSync(join(process.env.E2E_SHOT_DIR, 'recovery-popup.png'), Buffer.from((await tab.cdp('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    check('Continue is disabled until the box is ticked', await tab.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Continue')).disabled`) === true);
    check('the key is held in this tab only (sessionStorage), never in localStorage', (await stored(tab, 'passdrop.pendingRecoveryKey', 'sessionStorage')) === firstKey && (await stored(tab, 'passdrop.pendingRecoveryKey')) === null);
    await tab.click('input[type=checkbox]');
    await tab.click('button', 'Continue');
    await tab.waitFor(`!document.querySelector('[data-testid=recovery-key]')`, 'the popup to close');
    await tab.goto('/user');
    await sleep(1500);
    check('the popup does not come back once the key has been saved', !(await tab.eval(`!!document.querySelector('[data-testid=recovery-key]')`)) && (await stored(tab, 'passdrop.pendingRecoveryKey', 'sessionStorage')) === null);
    // a key that was lost (or never saved) is not the end: a new one can be made at any time, and the old one stops working
    await tab.click('button', 'Make a new recovery key');
    await tab.fill('input[placeholder="Enter your master password to confirm"]', 'not-the-password');
    await tab.click('button', 'Make a new key');
    await sleep(2500);
    check('a wrong master password makes no new key', !(await tab.eval(`!!document.querySelector('[data-testid=recovery-key]')`)));
    await tab.fill('input[placeholder="Enter your master password to confirm"]', MASTER);
    await tab.click('button', 'Make a new key');
    await tab.waitFor(`!!document.querySelector('[data-testid=recovery-key]')`, 'the new recovery key popup');
    const recoveryKey = (await tab.eval(`document.querySelector('[data-testid=recovery-key]').textContent`)).trim();
    check('the master password makes a new recovery key, different from the first', /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/.test(recoveryKey) && recoveryKey !== firstKey, recoveryKey);
    await tab.click('input[type=checkbox]');
    await tab.click('button', 'Continue');
    await tab.waitFor(`!document.querySelector('[data-testid=recovery-key]')`, 'the popup to close');
    await tab.goto('/');
    await tab.waitFor(`document.body.innerText.includes('Add Account') || document.body.innerText.includes('Add')`, 'the vault');

    // ---- add a login ----
    await tab.click('button', 'Add Account');
    await tab.fill('input[placeholder="e.g. GitHub, Netflix, Work Email"]', LOGIN_TITLE);
    await tab.fill('input[placeholder="e.g. https://github.com/login"]', 'https://github.com/login');
    await tab.fill('input[placeholder="e.g. user@example.com"]', LOGIN_USER);
    await tab.fill('input[placeholder="Enter account password"]', LOGIN_PASSWORD);
    await tab.click('button[type=submit]', 'Save Account');
    await tab.waitText(LOGIN_TITLE);
    check('the saved login is listed', (await tab.text()).includes(LOGIN_TITLE));
    check('the password is hidden on screen until revealed', !(await tab.text()).includes(LOGIN_PASSWORD));

    const token1 = await stored(tab, 'passdrop.token');
    check('the token is kept for the next visit (localStorage) and the vault key for this tab only (sessionStorage)',
        !!token1 && !!(await stored(tab, 'passdrop.vaultKey', 'sessionStorage')) && (await stored(tab, 'passdrop.vaultKey')) === null);

    // ---- reload keeps it unlocked; a brand-new tab is locked ----
    await tab.goto('/');
    await tab.waitText(LOGIN_TITLE);
    check('a reload of the same tab stays unlocked', true);

    const tab2 = await Tab.open(`${base}/`);
    await tab2.waitText('Your passwords are encrypted. Enter your master password to unlock them.');
    check('a new tab shows the lock screen with the lock text', true);
    check('a locked tab shows no login', !(await tab2.text()).includes(LOGIN_TITLE));
    await tab2.fill('#lock-password', 'not-the-password');
    await tab2.click('button[type=submit]');
    await tab2.waitText('That is not your master password.');
    check('a wrong master password is refused and stores no key', (await stored(tab2, 'passdrop.vaultKey', 'sessionStorage')) === null);
    await tab2.fill('#lock-password', MASTER);
    await tab2.click('button[type=submit]');
    await tab2.waitText(LOGIN_TITLE);
    check('the right master password unlocks the vault and shows the login', true);

    // ---- drops: share a login by a link that ends after one view or a time, and revoke it ----
    const makeDrop = async (timerChoice) => {
        await tab2.waitFor(`!document.querySelector('[inert]')`, 'the frost to clear (the page cannot be clicked until it has)');
        await tab2.click('button[title="Share this login with a link"]');
        if (timerChoice) { await tab2.click('button', 'After a time'); await tab2.click('button', timerChoice); }
        await tab2.click('button', 'Create link');
        await tab2.waitFor(`!!document.querySelector('input[aria-label="Drop link"]')`, 'the drop link');
        const link = await tab2.eval(`document.querySelector('input[aria-label="Drop link"]').value`);
        // copying is the way out: the dialog closes itself 2 seconds later (and has no X until a copy is refused)
        await tab2.click('button', 'Copy link and close');
        await tab2.waitFor(`!document.querySelector('[role="dialog"]') || document.body.innerText.includes('would not copy')`, 'the dialog to close');
        const stillOpen = await tab2.eval(`!!document.querySelector('[role="dialog"]')`);
        check('copying the link closes the dialog by itself', !stillOpen, 'the browser refused to copy');
        if (stillOpen) { await tab2.click('button', 'Close'); await tab2.waitFor(`!document.querySelector('[role="dialog"]')`, 'the dialog to close'); }
        return link;
    };
    // the receiver's page looks at what is left first (no view is used), then Reveal opens it
    const openLink = async (link, rule) => {
        const t = await Tab.open(link);
        await t.waitText('Someone shared a login with you');
        if (rule) await t.waitText(rule);
        await t.click('button', 'Reveal login');
        return t;
    };

    const dropLink1 = await makeDrop(null); // one view
    check('sharing a login makes a link with the key after a # (which a browser never sends)', /\/drop\/[\w-]{22}#[\w-]{43}$/.test(dropLink1), dropLink1);
    const drop1 = await openLink(dropLink1, '1 view left');
    check('before Reveal the page already shows what is left, without using a view', true);
    await drop1.waitText(LOGIN_USER);
    check('the link shows the shared login to someone who opened it', (await drop1.text()).includes(LOGIN_TITLE));
    check('...on a page with no menu and nothing to click away to, although this browser is signed in', !(await drop1.text()).includes('Logout') && !(await drop1.eval(`!!document.querySelector('header a, header nav, header button')`)));
    check('...with the password hidden until it is shown', !(await drop1.text()).includes(LOGIN_PASSWORD));
    await drop1.click('button[aria-label="Show Password"]');
    await drop1.waitText(LOGIN_PASSWORD);
    check('...and shown when asked', true);
    await drop1.cdp('Page.reload'); // the same link again, as someone else with it would open it
    await drop1.waitText('This drop is gone'); // the lookup says so before anything can be pressed
    check('a one-view drop destroys itself after its view: the next visitor sees gone at once, with nothing to reveal',
        !(await drop1.text()).includes(LOGIN_USER) && !(await drop1.eval(`!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Reveal login'))`)));
    drop1.close();

    const dropLink2 = await makeDrop('1 hour'); // a timer
    const drop2 = await openLink(dropLink2, 'Ends in');
    await drop2.waitText(LOGIN_USER);
    check('a timer drop opens', true);
    drop2.close();
    // the links live with the login they were made from: in its panel, with a badge and a Shared filter
    await tab2.waitFor(`document.body.innerText.toLowerCase().includes('shared links (1)')`, 'the login to show its link'); // the heading is styled in capitals
    check('the login shows its link in its own panel, and the Shared filter counts the login', (await tab2.text()).includes('Shared (1)') && !!(await tab2.eval(`!!document.querySelector('[aria-label="1 shared link"]')`)));
    await tab2.click('button', 'Revoke');
    await tab2.click('button', 'Revoke now');
    await tab2.waitFor(`!document.body.innerText.toLowerCase().includes('shared links')`, 'the revoked link to leave the login');
    check('the sender revokes it from the login itself and it disappears there', true);
    // ...and the two links that ended (used up, revoked) move to the login's folded Past links, with how often each was opened
    await tab2.waitFor(`document.body.innerText.toLowerCase().includes('past links (2)')`, 'the ended links to appear under Past links');
    await tab2.click('button', 'Past links');
    const past = (await tab2.text()).toLowerCase();
    check('the login keeps its ended links under Past links: how each ended, and how often it was opened', past.includes('used up') && past.includes('revoked') && past.split('opened 1 time').length === 3); // each of the two was opened once
    const drop2again = await Tab.open(dropLink2); // revoked: the page says gone as soon as it has looked
    await drop2again.waitText('This drop is gone');
    check('a revoked drop says gone straight away', !(await drop2again.text()).includes(LOGIN_USER));
    drop2again.close();

    const dropLink3 = await makeDrop('7 days'); // left alive for the database scan below
    const dropKey3 = dropLink3.split('#')[1];

    // ---- change the master password ----
    await tab.goto('/user');
    await tab.fill('#currentPassword', MASTER);
    await tab.fill('#newPassword', MASTER2);
    await tab.fill('#confirmNewPassword', MASTER2);
    await tab.click('button[type=submit]');
    await tab.waitFor(`localStorage.getItem('passdrop.token') !== ${JSON.stringify(token1)}`, 'a new token after the password change');
    check('changing the master password ends the old token', (await authedFetch(tab, token1)) === 401);
    check('...and keeps this session signed in and unlocked', (await authedFetch(tab, await stored(tab, 'passdrop.token'))) === 200 && !!(await stored(tab, 'passdrop.vaultKey', 'sessionStorage')));
    // (two tabs of one browser share localStorage, so the second tab already has the new token; what changed is only how the
    // vault key is wrapped, so a tab that was already unlocked keeps its key and still opens the login)
    await tab2.goto('/');
    await tab2.waitText(LOGIN_TITLE);
    check('another tab that was already unlocked keeps working after the password change (the vault key itself did not change)', true);

    // ---- sign out, then sign in with the new and the old password ----
    await tab.click('button', 'Logout');
    await tab.click('button', 'Log Out');
    await tab.waitPath('/login');
    check('signing out clears the token and the vault key', (await stored(tab, 'passdrop.token')) === null && (await stored(tab, 'passdrop.vaultKey', 'sessionStorage')) === null);
    await tab.fill('#email', EMAIL);
    await tab.fill('#password', MASTER);
    await tab.click('button[type=submit]');
    await sleep(3500);
    check('the old master password no longer signs in', (await stored(tab, 'passdrop.token')) === null && (await tab.eval('location.pathname')) === '/login');
    await tab.goto('/login');
    await tab.fill('#email', EMAIL);
    await tab.fill('#password', MASTER2);
    await tab.click('button[type=submit]');
    await tab.waitPath('/');
    await tab.waitText(LOGIN_TITLE);
    check('the new master password signs in and the login is still readable', true);

    // ---- recover with the recovery key ----
    await tab.click('button', 'Logout');
    await tab.click('button', 'Log Out');
    await tab.waitPath('/login');
    await tab.goto('/recover');
    await tab.fill('#email', EMAIL);
    await tab.fill('#recoveryKey', firstKey);
    await tab.fill('#newPassword', MASTER3);
    await tab.fill('#confirmPassword', MASTER3);
    await tab.click('button[type=submit]');
    await tab.waitText('Check the email and recovery key.');
    check('the first recovery key no longer works once a new one has been made', (await stored(tab, 'passdrop.token')) === null);
    await tab.goto('/recover');
    await tab.fill('#email', EMAIL);
    await tab.fill('#recoveryKey', recoveryKey.toLowerCase().replaceAll('-', ' '));
    await tab.fill('#newPassword', MASTER3);
    await tab.fill('#confirmPassword', MASTER3);
    await tab.click('button[type=submit]');
    await tab.waitPath('/');
    await tab.waitText(LOGIN_TITLE);
    check('recovery with the recovery key (typed in lowercase with spaces) reopens the vault with the saved login', true);
    const reUnlocked = await authedFetch(tab, await stored(tab, 'passdrop.token'));
    check('...and signs in as the same account', reUnlocked === 200);

    // ---- what the database holds ----
    const client = await MongoClient.connect(mongoUri);
    const db = client.db('e2e');
    const dump = JSON.stringify({ users: await db.collection('users').find().toArray(), passwords: await db.collection('passwords').find().toArray(), drops: await db.collection('drops').find().toArray(), droplog: await db.collection('droplog').find().toArray() });
    const secrets = { 'the login title': LOGIN_TITLE, 'the login username': LOGIN_USER, 'the login password': LOGIN_PASSWORD, 'the address': 'github.com',
        'the first master password': MASTER, 'the second master password': MASTER2, 'the third master password': MASTER3, 'the first recovery key': firstKey, 'the recovery key': recoveryKey,
        'the recovery key without hyphens': recoveryKey.replaceAll('-', ''), 'the first recovery key without hyphens': firstKey.replaceAll('-', ''), 'a drop\'s share key': dropKey3 };
    for (const [what, value] of Object.entries(secrets)) check(`the database does not contain ${what}`, !dump.includes(value));
    const user = await db.collection('users').findOne();
    check('the account holds hashes, key settings and wrapped keys, and no password field', !!user.authHash && !!user.recoveryAuthHash && !!user.wrappedVaultKey && !!user.recoveryWrappedKey && user.password === undefined && user.v === 2);
    const items = await db.collection('passwords').find().toArray();
    check('each login is one blob with no readable field', items.length === 1 && Object.keys(items[0]).sort().join() === '_id,blob,createdAt,updatedAt,user');
    const drops = await db.collection('drops').find().toArray();
    check('the used-up and the revoked drop are gone from the database; the live one is two blobs and its rule', drops.length === 1 && Object.keys(drops[0]).sort().join() === '_id,blob,createdAt,expiresAt,label,login,mode,owner' && String(drops[0].login) === String(items[0]._id));

    const log = await db.collection('droplog').find().toArray();
    check('each link has a history row with no blob: its rule, how often it was opened, and (when over) how it ended',
        log.length === 3 && log.every((row) => row.blob === undefined && row.purgeAt > new Date() && typeof row.opens === 'number') && log.map((row) => row.endedBy ?? 'live').sort().join() === 'live,revoked,used');

    // ---- delete everything with the master password ----
    await tab.goto('/user');
    await tab.click('button', 'Delete All Passwords');
    await tab.fill('input[placeholder="Enter your master password to confirm"]', MASTER3);
    await tab.click('button', "Yes, I'm sure");
    await tab.waitFor(`(async () => (await fetch('/api/passwords', { headers: { 'auth-token': localStorage.getItem('passdrop.token') } }).then((r) => r.json())).length === 0)()`, 'the vault to be empty');
    check('Delete All Passwords works with the master password', (await db.collection('passwords').countDocuments()) === 0);
    check('...and ends every link made from those logins, so none outlives its login', (await db.collection('drops').countDocuments()) === 0);
    check('...and their history', (await db.collection('droplog').countDocuments()) === 0);
    await client.close();

    const errors = [...tab.errors, ...tab2.errors];
    check('no page errors were thrown in the browser', errors.length === 0, errors.join('\n      '));
    tab.close(); tab2.close();
}

let failure = null;
try { await run(); } catch (error) { failure = error; check(`the run completed (${error.message})`, false); }
chrome.kill(); server.close(); await mongod.stop();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed${failure ? ' (the run stopped early)' : ''}`);
process.exit(failed ? 1 : 0);
