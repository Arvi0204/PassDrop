# PassDrop API

The Express API behind the PassDrop web app and browser extension. It signs people in and stores their logins in MongoDB, **as encrypted data it cannot read**: the browser encrypts every login before sending it (see [Security behaviour](#security-behaviour)).

For setting up the whole project, start with the [root README](../README.md). This page covers the API itself.

- [Running it](#running-it)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Responses and errors](#responses-and-errors)
- [Security behaviour](#security-behaviour)
- [Code layout](#code-layout)
- [Testing](#testing)

## Running it

From the repository root, after `npm install` and creating `backend/.env`:

```bash
npm run dev:backend      # the API on its own, restarts on changes
npm run dev              # the API and the web app together
```

It listens on <http://localhost:3000>. In production it is not started as a server: Vercel runs it as a function through `api/index.js` at the repository root (see [Deployment](../README.md#deployment)).

## Configuration

Settings come from `backend/.env`. In production they are the Vercel project's environment variables.

| Setting | Required | What it does |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string. |
| `JWT_SECRET` | yes | Signs sign-in tokens. 32 or more random characters; the API warns if it is shorter. |
| `PORT` | no | Default `3000`. |
| `DB_NAME` | no | Default `PassDrop`. |
| `JWT_EXPIRES_IN` | no | Default `7d`. |

There is no encryption key to configure: the server never holds one. Generate the `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

CORS is enabled only outside production (`NODE_ENV=production` turns it off), because in production the web app and the API share one address.

## Authentication

Sign in with `POST /api/auth/login` (or register) to get a token, then send it on every other request in an `auth-token` header. A token is a JWT that carries the account's `tokenVersion`, so it stops working as soon as the master password changes.

## Endpoints

All paths start with `/api`. "Token" means the `auth-token` header is required. "Re-auth" means the body must also contain `currentAuthKey`, a proof the browser derives from the account's current master password. The server never receives a master password, a recovery key or a vault key, only keys derived from them, which it checks against a bcrypt hash.

### Account (`/api/auth`)

| Method and path | Needs | Body | What it does |
|---|---|---|---|
| `GET /prelogin?email=` | | | The key-derivation settings (`kdf`: algorithm, iterations, salt) the browser needs before it can compute its proof. An unknown email gets a believable, stable fake, so this cannot be used to find accounts. |
| `POST /register` | | `username` (3+ characters), `email`, `authKey`, `kdf`, `wrappedVaultKey`, `recoveryWrappedKey`, `recoveryAuthKey` | Creates an account. Returns `201` with `{ success, authToken, expiresAt, userId }`. |
| `POST /login` | | `email`, `authKey` | Returns `{ success, authToken, expiresAt, userId, kdf, wrappedVaultKey }`. |
| `GET /me` | Token | | `{ _id, username, email, createdAt, lastLogin, kdf, wrappedVaultKey }`: what a signed-in browser needs to unlock the vault again. |
| `POST /change-password` | Token, re-auth | `currentAuthKey`, `newAuthKey`, `newKdf`, `newWrappedVaultKey` | Changes the master password (the vault key is re-wrapped, not re-encrypted), ends every other session, and returns a new token. The salt in `newKdf` must stay the account's own. |
| `DELETE /me` | Token, re-auth | `currentAuthKey` | Deletes the account and all its logins. |
| `POST /recovery/unlock` | | `email`, `recoveryAuthKey` | Proves the recovery key and returns `{ kdf, recoveryWrappedKey }`. |
| `POST /recovery/rotate` | Token, re-auth | `currentAuthKey`, `recoveryAuthKey`, `recoveryWrappedKey` | Replaces the recovery key (the browser made a new one and sends only its proof and the vault key wrapped by it). The old recovery key stops working; sign-in and sessions are untouched. |
| `POST /recovery/reset` | | `email`, `recoveryAuthKey`, `newAuthKey`, `newKdf`, `newWrappedVaultKey` | Sets a new master password with the recovery key. Returns the same as `/login`. |

Each `...AuthKey` is base64 of 32 bytes and each wrapped key is a string like `v1.<iv>.<ciphertext>`; `kdf` is `{ name: "PBKDF2-SHA256", iterations (600000 or more), salt }`. The server checks their shape and size, nothing else: it cannot tell a real key from a random one.

### Logins (`/api/passwords`)

| Method and path | Needs | Body | What it does |
|---|---|---|---|
| `GET /` | Token | | The user's logins as `[{ _id, blob, createdAt, updatedAt }]`, newest first. |
| `POST /` | Token | `blob` | Stores a login. The blob is one encrypted string (`v1.<iv>.<ciphertext>`, up to 32768 characters); title, address, username, password and notes are all inside it. |
| `PUT /:id` | Token | `blob` | Replaces a login's blob. |
| `DELETE /:id` | Token | | Deletes one login. |
| `DELETE /` | Token, re-auth | `currentAuthKey` | Deletes all of the user's logins. |

### Drops (`/api/drops`)

A drop shares one login by a link. The browser encrypts the login with a fresh share key that stays in the link's `#` part, so the server holds only the encrypted login, a label for the sender's list (encrypted with the sender's vault key), and the rule. A drop ends by a view count or by a time, never both.

| Method and path | Needs | Body | What it does |
|---|---|---|---|
| `POST /` | Token | `login` (the id of one of the sender's logins), `blob`, `label`, `mode` (`views` or `timer`), and `views` (1 to 10) or `ttl` (600, 3600, 86400 or 604800 seconds) | Makes a drop and returns `{ id, mode, viewsLeft, expiresAt }`. At most 25 live drops per user. A views drop also ends after 7 days if nobody opens it. |
| `GET /` | Token | | The sender's live drops as `[{ id, login, label, mode, viewsLeft, expiresAt, createdAt }]`, newest first. Never the blob. |
| `GET /history` | Token | | The sender's links that ended in the last 30 days (used up, expired or revoked) as `[{ id, login, label, mode, createdAt, endedAt, reason, opens }]`, newest first, at most 200. Never the blob. |
| `GET /:id` | | | What is left of a live drop, with no sign-in and no key, so the page can show it before anyone opens it: `{ mode: "views", viewsLeft, now }` or `{ mode: "timer", expiresAt, createdAt, now }` (`now` is the server's clock, so a countdown follows the server's time). It only reads and never takes a view, so a link preview cannot use one up. Never the login, the label, the owner or the 7-day backstop. |
| `DELETE /:id` | Token | | Revokes one of your drops at once. |
| `POST /:id/open` | | | Opens a drop with no sign-in and returns `{ blob, mode, viewsLeft, expiresAt }` (`Cache-Control: no-store`). A views drop loses a view in one atomic update and is deleted on its last; a timer drop opens as often as you like until it ends. A POST, so a link preview cannot use up a view. |

Missing, malformed, ended, revoked and used-up drops all answer the same, on both the lookup and the open, `404 { success: false, error: "This drop is gone" }`. A MongoDB TTL index deletes ended drops within about a minute, and every query also checks the end time, so an ended drop is never served. A drop stores the id of the login it was made from (an opaque record id, nothing readable) and never outlives it: deleting a login (`DELETE /api/passwords/:id`) deletes its drops in the same request, Delete All Passwords deletes all of the user's drops, and deleting the account deletes them too. A drop made before logins were recorded has no `login`; it still lists and can be revoked on its own. Each drop also has a history row in the `droplog` collection (no blob): its encrypted label, the login id, the rule, when it was made, how many times it was opened and, once over, when and why it ended. A TTL index deletes the row 30 days after the link ended, so the history cannot grow for ever; it goes at once with its login, with Delete All Passwords and with the account. The history is a record for the sender only: it never decides whether a link works, and a failure to write it does not fail the request. It does mean the server keeps times and an open count for 30 days after a link ends. There is no rate limiter in the app: add a Vercel firewall rule for `/api/drops/*/open`.

## Responses and errors

Success is `{ success: true, ... }`. A failure is `{ success: false, errors: [{ msg }] }` for validation and sign-in problems, or `{ success: false, error }` for the rest. Error messages never include internal details.

| Status | Meaning |
|---|---|
| `400` | Invalid input, a failed sign-in, or a missing `currentAuthKey`. |
| `401` | A missing token, or one that no longer works. |
| `403` | The `currentAuthKey` on a re-auth was wrong. |
| `429` | The account is locked after too many wrong proofs. |
| `500` | Something broke on the server. |

## Security behaviour

- **The server cannot read a vault.** The browser derives two keys from the master password; one is the sign-in proof (`authKey`), which the server stores only as a bcrypt hash. The logins are encrypted in the browser with a random vault key that the server holds only in wrapped (encrypted) form. A second copy, wrapped by the recovery key, lets an account be recovered. The cryptography lives in [`frontend/src/lib/vaultCrypto.js`](../frontend/src/lib/vaultCrypto.js).
- **Lockout:** 10 wrong proofs in a row lock the account for 15 minutes. The count covers sign-in, every re-auth and account recovery. An unknown email takes as long to answer as a wrong password, so it does not show which emails have accounts.
- **Sessions can be ended:** changing the master password raises the account's `tokenVersion`, which invalidates every older token, including a stolen one.
- **Re-auth:** changing the master password, deleting the account and deleting all logins need the master password again (as a derived `currentAuthKey`), so a stolen token alone cannot do them. A stolen token also cannot read anything: it only returns encrypted data.
- **Indexes:** one account per email (this also settles two simultaneous sign-ups) and a quick lookup of one user's logins, created when the API first connects.

## Code layout

- `server.js`, `db.js`: the Express app and the MongoDB connection.
- `routes/`: `auth.js`, `passwords.js` and `drops.js`.
- `middleware/`: `fetchUser` (checks the token and its `tokenVersion`) and `requirePassword` (asks for the master password again).
- `utils/`: `removeDrops` (ends drops and their history with a login or an account), `passwordGuard` (checks a proof and counts failures for the lockout), `kdf` (the fake key settings for unknown emails) and `vaultFields` (checks the shape and size of the keys and blobs the browser sends).
- `bruno/`: the API request collection.
- `test/`: the automated tests. `test-helpers/`: the helper that boots the app against a throwaway MongoDB for them.

## Testing

```bash
npm test --workspace=backend
```

97 tests use Node's built-in runner and [Supertest](https://github.com/ladjs/supertest), which calls the real Express app without opening a port. They cover:
- **Accounts:** sign-up validation (spaces around the email and username are ignored, the password is kept exactly as typed) and duplicate emails, sign-in, the same answer for a wrong password and an unknown email, the lockout (ten failures, 15 minutes, counted across sign-in and re-authentication), `/me`, changing the master password (other sessions die, this one stays), and deleting the account.
- **Recovery and prelogin:** recovery with the recovery key (it works again after a password change), replacing the recovery key (the old one stops working), the same answer for a wrong key and an unknown email, the shared lockout, and a stable fake for unknown emails.
- **Logins:** every route needs a token, a login is stored as exactly one blob with no readable field (even if the client also sends plaintext), listing shows only your own, updating and deleting other people's logins is refused, size and format limits, and deleting all.
- **Drops:** the rule is one view count or one of the timers, only encrypted blobs are stored, the list never shows a blob, the last view deletes the drop, 6 simultaneous opens of a 2-view drop give exactly 2 successes, a timer drop is refused after its end, only the sender can revoke, every kind of "gone" answers the same, a link never outlives its login, deleting an account deletes its drops, and the history of ended links (how each ended, how often it was opened, kept 30 days, gone with its login).
- **The server:** malformed and oversized bodies, no framework header, and that nothing reads an encryption key any more.

**The tests use a real MongoDB.** Each test file starts its own throwaway MongoDB with [mongodb-memory-server-core](https://github.com/typegoose/mongodb-memory-server) and throws it away afterwards, so the API's real queries are what get tested, and nothing is mocked. `test-helpers/testApp.js` sets the tests' own secrets and a placeholder database address before the app loads, so not even a `.env` file pointing at your real database is used, and it refuses to carry on unless the throwaway database is on this computer.

The MongoDB version is pinned under `config` in `package.json` (7.0.14). **The first test run downloads that MongoDB once, about 590 MB on Windows**, into `~/.cache/mongodb-binaries` (shared by every project); after that it starts in a second or two. To fetch it ahead of time, run this in `backend/`:

```bash
node -e "require('mongodb-memory-server-core').MongoMemoryServer.create().then(s => s.stop())"
```

If the download does not work on your network, download `mongodb-windows-x86_64-7.0.14.zip` from `fastdl.mongodb.org/windows/` in a browser, unzip it, and set `MONGOMS_SYSTEM_BINARY` to the path of its `bin/mongod.exe`.

[`bruno/`](bruno/README.md) holds a [Bruno](https://www.usebruno.com/) collection with a request for every endpoint: open that folder in Bruno and pick the Local environment.

## License

MIT. See the [LICENSE](../LICENSE) at the repository root.
