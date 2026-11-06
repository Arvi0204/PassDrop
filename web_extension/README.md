# PassDrop browser extension

Look up, copy and autofill your PassDrop logins from the browser toolbar. Chrome and other Chromium browsers (Edge, Brave, Arc); Manifest V3, Chrome 102 or newer.

## How it works

- **Popup** (`src/popup/`): sign in, then see the login for the site you are on pinned at the top (username in plain view, password hidden behind dots until you press the eye), search, a list of everything else, and a detail view for any login. The sparkle button opens the password generator as a sheet over the popup. Adding, editing and deleting logins stay in the web app ("Edit in PassDrop" opens it).
- **Automatic sync**: the popup shows what the extension already has at once, then refreshes it quietly, and again every 30 seconds while it is open. The service worker also refreshes every 5 minutes in the background (the `alarms` permission), so autofill never works from an old copy. If the server cannot be reached, the saved copy stays on screen with an "Offline" notice.
- **Service worker** (`src/background.js`): the only part that talks to the server or holds the sign-in. The popup and the content script ask it for things with messages.
- **Content script** (`src/content.js`): on a page with a login form, asks the service worker for the logins that belong to that page and fills the first one in.
- **Storage** (`src/storage.js`): the sign-in token is kept in `storage.local` so it survives a restart. The decrypted vault is kept only in `storage.session` (memory, gone when the browser closes, not readable by web pages' scripts).
- **Matching** (`src/match.js`): a saved address matches the page's host or a parent of it (`example.com` matches `login.example.com`, not `example.com.evil.com`).
- **API** (`src/api.js`): every call to the backend: `POST /api/auth/login`, `GET /api/auth/me` and `GET /api/passwords`, with the token in an `auth-token` header.
- **Shared with the web app**: the generator (`frontend/src/lib/passwordGen.js`) and the strength scoring (`frontend/src/lib/passwordStrength.js`) are imported, not copied, through `src/popup/shared.js`.
- **Fonts** (Plus Jakarta Sans, JetBrains Mono) are bundled in the build, so the popup never calls a font server.

## Build

The server addresses are set at build time, because an extension has no runtime environment.

```bash
cp .env.example .env     # then edit the two addresses
npm install              # from the repository root, once
npm run build            # writes dist/
```

| Variable | What it is |
|---|---|
| `VITE_BACKEND` | Address of the PassDrop API, no trailing slash. The manifest only allows the extension to call this origin. |
| `VITE_WEB_APP_URL` | Address of the web app, for the "Open PassDrop" and "Create an account" links. |

Both are required; the build stops with a message if one is missing.

## Try it

1. Build as above.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `dist/` folder.
3. After changing code, run `npm run build` again and press the reload icon on the extension's card.

`dev/test-log.html` is a plain login form for trying autofill by hand.

## Test

```bash
npm test
```

Runs the matching and API tests with Node's built-in test runner. No browser needed.

## Release zip

The web app's Extension page offers `frontend/public/PassDrop.zip`. To rebuild it:

1. Put the **real** server addresses in `.env` (or in `.env.production`, which wins for release builds).
2. `npm run package` (from the repository root: `npm run package:extension`).

The zip holds the contents of `dist/`, with `manifest.json` at the top.
