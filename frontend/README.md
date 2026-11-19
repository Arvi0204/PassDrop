# PassDrop web app

The React app where you create an account and manage your vault. It talks to the [API](../backend/README.md) and also serves the browser extension download.

For setting up the whole project, start with the [root README](../README.md). This page covers the web app itself.

- [Running it](#running-it)
- [Configuration](#configuration)
- [What is in it](#what-is-in-it)
- [Code layout](#code-layout)
- [The water theme](#the-water-theme)
- [Build and deploy](#build-and-deploy)

## Running it

From the repository root, after `npm install`:

```bash
npm run dev:frontend     # the web app on its own, at http://localhost:5173
npm run dev              # the web app and the API together
```

Scripts in this folder (`npm run <name> --workspace=frontend`):

| Script | What it does |
|---|---|
| `dev` | Vite dev server with hot reload. |
| `build` | Production build into `dist/`. |
| `preview` | Serves the production build locally. |
| `test` | The component and helper tests (Vitest, with jsdom as a stand-in browser). |
| `lint` | ESLint. It passes with no errors; a few advisory warnings (hook dependencies, files that export more than components) are left on purpose. |

## Configuration

One setting, `VITE_BACKEND`: the address of the API.

| Where | Value |
|---|---|
| `frontend/.env` (local, not committed) | `http://localhost:3000` |
| `frontend/.env.production` (committed) | empty, because in production the API is on the web app's own address under `/api` |

## What is in it

| Route | Page |
|---|---|
| `/` | The vault: search, add, edit and delete logins, favourites, and the password generator. |
| `/login`, `/signup` | Sign in and create an account. |
| `/user` | Account: change the master password (with a strength meter) and the danger zone, which asks for the master password again. |
| `/extension` | The extension download and the steps to install it. |
| `/home` | The landing page. |

Behaviour worth knowing:

- Passwords are revealed through a waterline that drains away, instead of a plain swap.
- Feedback appears next to what you did, rather than as toasts, and Escape closes any open dialog.
- If your session stops working (it expired, or the master password was changed elsewhere), you are sent to the login page.

## Code layout

- `src/components/`: pages and UI pieces. `Manager` is the vault and `UserDetails` the Account page. `Vault/` holds the login list, detail and edit dialog, and `common/` shared pieces.
- `src/context/`: the vault state (`PasswordState`) and the tide animation (`TideContext`).
- `src/lib/`: plain helpers: the password generator and strength scoring (also imported by the extension), the authenticated fetch, and the animation helpers.
- `src/styles/`: `tide.css` and `water.css`.
- Tests sit next to the code they check, as `*.test.js` and `*.test.jsx`. `test-setup.js` fills in the few browser features jsdom lacks. Run them with `npm test --workspace=frontend`: they cover the Account page's delete dialog, the password mask, the site icons, the generator, the strength score and the session-expiry handling.
- `public/`: the favicon. `PassDrop.zip`, the extension download, is also built into this folder, from `web_extension/`, on every deploy. It is git-ignored; see [Local build or release build](../README.md#local-build-or-release-build) to make it locally.

## The water theme

The look is built from Tailwind plus two stylesheets, with motion by Framer Motion. `tide.css` is the animation that carries you between pages (its wave is `src/assets/tide-wave.svg`), and `water.css` is the waterline used for revealing passwords.

## Build and deploy

`npm run build:frontend` at the repository root builds the app into `frontend/dist`. It is deployed together with the API as one Vercel project; see [Deployment](../README.md#deployment).

## License

MIT. See the [LICENSE](../LICENSE) at the repository root.
