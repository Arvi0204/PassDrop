# PassDrop API

The Express API behind the PassDrop web app and browser extension. It signs people in and stores their logins in MongoDB.

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
| `ENCRYPTION_KEY` | yes | Encrypts stored logins. Exactly 64 hex characters; the API refuses to start otherwise. |
| `PORT` | no | Default `3000`. |
| `DB_NAME` | no | Default `PassHaven`. |
| `JWT_EXPIRES_IN` | no | Default `7d`. |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

CORS is enabled only outside production (`NODE_ENV=production` turns it off), because in production the web app and the API share one address.

## Authentication

Sign in with `POST /api/auth/login` (or register) to get a token, then send it on every other request in an `auth-token` header. A token is a JWT that carries the account's `tokenVersion`, so it stops working as soon as the master password changes.

## Endpoints

All paths start with `/api`. "Token" means the `auth-token` header is required. "Re-auth" means the body must also contain `currentPassword`, the account's current master password.

### Account (`/api/auth`)

| Method and path | Needs | Body | What it does |
|---|---|---|---|
| `POST /register` | | `username` (3+ characters), `email`, `password` (8+ characters) | Creates an account. Returns `201` with `{ success, authToken, expiresAt }`. |
| `POST /login` | | `email`, `password` | Returns `{ success, authToken, expiresAt }`. |
| `GET /me` | Token | | The signed-in user's details. |
| `POST /change-password` | Token, re-auth | `currentPassword`, `newPassword` (8+ characters, different from the old one) | Changes the master password, ends every other session, and returns a new token. |
| `DELETE /me` | Token, re-auth | `currentPassword` | Deletes the account and all its logins. |

### Logins (`/api/passwords`)

| Method and path | Needs | Body | What it does |
|---|---|---|---|
| `GET /` | Token | | All of the user's logins, decrypted. |
| `POST /` | Token | `password` (required, up to 1024 characters); optional `title`, `username`, `url` (up to 2048 each), `notes` (up to 10000), `isFavorite` | Creates a login. |
| `PUT /:id` | Token | any of the fields above | Updates a login. |
| `DELETE /:id` | Token | | Deletes one login. |
| `DELETE /` | Token, re-auth | `currentPassword` | Deletes all of the user's logins. |

## Responses and errors

Success is `{ success: true, ... }`. A failure is `{ success: false, errors: [{ msg }] }` for validation and sign-in problems, or `{ success: false, error }` for the rest. Error messages never include internal details.

| Status | Meaning |
|---|---|
| `400` | Invalid input, a failed sign-in, or a missing `currentPassword`. |
| `401` | A missing token, or one that no longer works. |
| `403` | The `currentPassword` on a re-auth was wrong. |
| `429` | The account is locked after too many wrong master passwords. |
| `500` | Something broke on the server. |

## Security behaviour

- Master passwords are hashed with bcrypt.
- **Lockout:** 10 wrong master passwords in a row lock the account for 15 minutes. The count covers sign-in and every re-auth. An unknown email takes as long to answer as a wrong password, so it does not show which emails have accounts.
- **Sessions can be ended:** changing the master password raises the account's `tokenVersion`, which invalidates every older token, including a stolen one.
- **Re-auth:** changing the master password, deleting the account and deleting all logins need the master password again, so a stolen token alone cannot do them.
- **Encryption at rest:** logins are encrypted with AES-256 using `ENCRYPTION_KEY` before they are stored, and decrypted when sent to the signed-in user. The server holds the key, so it can read the logins; this is not zero-knowledge. Client-side encryption is on the [roadmap](../README.md#status-and-roadmap).

## Code layout

- `server.js`, `db.js`: the Express app and the MongoDB connection.
- `routes/`: `auth.js` and `passwords.js`.
- `middleware/`: `fetchUser` (checks the token and its `tokenVersion`) and `requirePassword` (asks for the master password again).
- `utils/`: `encryption` (AES-256) and `passwordGuard` (checks a master password and counts failures for the lockout).
- `bruno/`: the API request collection.

## Testing

There are no automated API tests yet. [`bruno/`](bruno/README.md) holds a [Bruno](https://www.usebruno.com/) collection with a request for every endpoint: open that folder in Bruno and pick the Local environment.

## License

MIT. See the [LICENSE](../LICENSE) at the repository root.
