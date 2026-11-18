# PassDrop browser extension

Look up, copy and fill your PassDrop logins from the browser toolbar and from the login field itself. It works in Chrome and other Chromium browsers (Edge, Brave, Arc), as a Manifest V3 extension for Chrome 102 or newer.

For setting up the whole project, start with the [root README](../README.md). This page covers the extension itself.

- [Using it](#using-it)
- [How it works](#how-it-works)
- [What a web page can and cannot do](#what-a-web-page-can-and-cannot-do)
- [Building](#building)
- [Try it locally](#try-it-locally)
- [Testing](#testing)
- [Release zip](#release-zip)
- [Code layout](#code-layout)

## Using it

**Install.** The web app's Extension page has the download and the steps: unzip it, open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**.

**Fill a login.** Open a site you have a login for and click its username or password field. A PassDrop menu opens under the field with the title and username of each saved login for that site. Click a row to fill it. Arrow Down moves into the menu, Enter picks a row, and Escape closes it. Nothing is filled until you click a row. If you are signed out, the menu tells you to sign in from the toolbar icon.

**The popup.** Click the toolbar icon to sign in. The login for the site you are on is pinned at the top (username in plain view, password hidden until you press the eye), with search, a list of everything else, a detail view for any login, and the password generator behind the sparkle button. Adding, editing and deleting logins happen in the web app ("Edit in PassDrop" opens it).

**What gets filled.** Login forms only. It skips hidden fields and site search boxes, and refuses sign-up and change-password forms. Two-step logins (username first, then password) fill one step at a time: click the field again on the second step.

## How it works

- **Service worker** (`src/background.js`): the only part that talks to the server or holds the sign-in. The popup and the content script ask it for things with messages.
- **Popup** (`src/popup/`): the toolbar window described above.
- **Content script** (`src/content.js`): runs on every page, opens the menu when you click a login field, and fills the login you pick. It holds no passwords.
- **Field detection** (`src/fields.js`): finds the login form on a page and fills it, setting values the way a keyboard would so React and Vue forms notice them.
- **Matching** (`src/match.js`): a saved address matches only the exact host **and port** of the page (`www.` is ignored, and the scheme you typed is ignored). `example.com` does not match `login.example.com`, `example.com.evil.com` or `example.com:8443`. Only https pages match, plus plain http on `localhost`, `127.0.0.1` and `[::1]` for development. To use a login on a local app, save its address with the port (`localhost:5173`); that also keeps it from being offered to another app on `localhost:3000`.
- **Sync**: the popup shows what the extension already has at once, then refreshes it quietly, and again every 30 seconds while it is open. The service worker also refreshes every 5 minutes in the background (the `alarms` permission). If the server cannot be reached, the saved copy stays on screen with an "Offline" notice.
- **Storage** (`src/storage.js`): the sign-in token is kept in `storage.local` so it survives a restart. The decrypted vault is kept only in `storage.session` (memory, gone when the browser closes, not readable by web pages' scripts).
- **API** (`src/api.js`): every call to the backend: `POST /api/auth/login`, `GET /api/auth/me` and `GET /api/passwords`, with the token in an `auth-token` header.
- **Shared with the web app**: the generator (`frontend/src/lib/passwordGen.js`) and the strength scoring (`frontend/src/lib/passwordStrength.js`) are imported, not copied, through `src/popup/shared.js`.
- **Fonts** (Plus Jakarta Sans, JetBrains Mono) are bundled in the build, so the popup never calls a font server.

## What a web page can and cannot do

- The content script holds no passwords. The page can ask the service worker for the **titles and usernames** saved for its own address, and for **one login's password after a real click** on a row in the menu. A click made by the page's own script is ignored.
- The address is taken from the browser, never from the page. Subdomains, plain http (except localhost), other sites, iframes and other extensions get nothing.
- The menu lives in a closed shadow root, so the page's scripts cannot read it or press a row. Only real clicks and key presses open it: a page's own `click()` or dispatched events do nothing.
- The menu sits in the page's own DOM, so a page could try to fade it out or move it under a decoy button. Before a password is handed over, the script checks that the menu is still exactly where it was drawn, fully visible and on top at the click point, and it ignores a click made within 300 ms of the menu appearing. If the page changes the menu's element, the menu closes.
- The form that is filled is the one of the field you clicked. If that field has left the page by the time you choose a row, nothing is filled.
- Moving between fields reuses the list of logins for a few seconds, so a page cannot make the extension look it up over and over.
- To keep the browser's own suggestion list (saved emails, passkeys) from covering the menu, a login field is marked `autocomplete="off"` on pages where you have a saved login. That also hides the browser's passkey row on that field, and on a page that builds its form with script the browser's list can still show on the very first click.
- On a page with a login form, the content script asks the service worker once at load whether you have a login for it (titles and usernames only, no passwords). Pages without a login form send nothing.

Limits, marked `shortcut:` in the code: top frame only (no login forms inside iframes), no shadow-DOM forms, a field pushed far below the fold or covered by another element still counts as visible, and the menu closes on scroll instead of following the field. A page can also tell that the extension is there (the menu element, and `autocomplete` on the field), as with any in-page password manager.

## Building

The server addresses are fixed when the extension is built, because an extension has no runtime environment. Which file they come from depends on the command, so there are two builds:

| | Local development | Release |
|---|---|---|
| Command | `npm run build:dev` | `npm run package` |
| Addresses from | `.env` (localhost) | `.env.production` (the live site) |
| Output | `dist/` | `dist/` and `../frontend/public/PassDrop.zip` (git-ignored) |

From the repository root, the same commands are `npm run build:extension:dev` and `npm run package:extension`.

> **Plain `npm run build` is a production build.** Vite reads `.env.production` in that mode, so it ignores `.env` and points at the live site. Use `build:dev` for local work.

| Setting | What it is |
|---|---|
| `VITE_BACKEND` | Address of the PassDrop API, no trailing slash. The manifest only allows the extension to call this origin. |
| `VITE_WEB_APP_URL` | Address of the web app, for the "Open PassDrop" and "Create an account" links. |

Both are required; the build stops with a message if one is missing. `.env.example` shows the localhost values to copy into `.env`. `.env.production` is committed and holds the live site's address.

## Try it locally

1. Copy `.env.example` to `.env` (once), and start the API and web app from the repository root with `npm run dev`.
2. `npm run build:dev`
3. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `dist/` folder.
4. After changing code, run `npm run build:dev` again, press the reload icon on the extension's card, **and reload the page you are testing**. Chrome keeps the old background script until you reload the extension.

To try the menu on a test page, serve the `dev/` folder (for example `npx serve dev`), save a login for that address **with its port** (such as `localhost:3000`) in PassDrop, and open `test-forms.html?case=plain`. The other cases are `controlled` (a React-style form), `decoy` (hidden, clipped and off-page fields that must stay empty), `signup` (must be refused), `twostep`, `search` and `twoforms`. `test-log.html` is a plain login form.

## Testing

```bash
npm test                 # fast, no browser
npm run test:browser     # needs Chrome; builds just the content script first
```

`npm test` uses Node's built-in test runner. It covers address matching (including ports), field detection (with jsdom), the service worker's page requests (with a fake `chrome`), the content script's rules for events a page makes up, the API client and the popup helpers.

`npm run test:browser` runs the built content script in real headless Chrome with real mouse and key events (`e2e/menu.mjs`). It is where the menu, the fill, the clickjacking attempts, the hidden-field decoys and the two-form pages are checked. It finds Chrome in the usual places; set `CHROME_PATH` if yours is elsewhere. It builds only the content script (which uses no `.env` settings), so it works on a fresh checkout and leaves the rest of `dist/` alone.

Not covered by the automated tests: the service worker inside a really loaded extension (the browser test stands one in), forms inside iframes or shadow DOM, and real sites. Check those by hand with a local build.

## Release zip

The web app's Extension page offers `PassDrop.zip`. You do not build or commit it: the Vercel deploy runs `npm run package:extension` before it builds the web app, so the download is always made from the code being deployed. `frontend/public/PassDrop.zip` is git-ignored.

To make it yourself, for example to try the Extension page's download locally:

```bash
npm run package        # from the repository root: npm run package:extension
```

This builds in production mode, so the addresses come from `.env.production`, and writes the zip with `manifest.json` at the top. Check that `.env.production` holds the live address, since that is what ships. The build also overwrites `dist/`, so run `npm run build:dev` again afterwards to go back to a local build.

## Code layout

- `manifest.js`: builds `dist/manifest.json` at build time, so the backend address is never written by hand.
- `src/`: `background.js`, `content.js`, `fields.js`, `match.js`, `storage.js`, `api.js`, and `popup/` for the toolbar window.
- `dev/`: the hand-test pages.
- `test/`: the unit tests. `e2e/`: the real-Chrome test.
- `scripts/package.js`: zips `dist/` into the web app's download.
- `vite.config.js`, `vite.content.config.js`: the content script is built on its own, as one self-contained file, because Chrome loads content scripts as classic scripts.

## License

MIT. See the [LICENSE](../LICENSE) at the repository root.
