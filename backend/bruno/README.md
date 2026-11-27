# PassDrop Bruno API Collection

This directory contains a complete [Bruno](https://www.usebruno.com/) collection for testing and inspecting the PassDrop REST API.

## How to Open in Bruno

1. Install and open **Bruno**.
2. Click **Open Collection** on the Bruno home screen.
3. Select the `backend/bruno` folder in this repository.
4. In the top-right corner, select the **Local** environment (`environments/Local.bru`).

## Features Included in the Collection

* **Automatic Token Handling**: When running `Register` or `Login`, the response's `authToken` is automatically captured and populated into the environment for subsequent requests.
* **Automatic ID Capture**: When creating a password via `POST /api/passwords`, the created ID is stored in `{{createdPasswordId}}` for instant testing with `PUT` and `DELETE`. Creating a drop stores its id in `{{dropId}}` for the look, open and revoke requests.

> **The requests carry made-up keys.** The server only checks that the keys have the right shape; it cannot tell a real one from a random one, so the sample bodies use random base64. An account created here can be inspected through the API, but it cannot be signed in to from the web app (the web app derives its keys from a real master password, in the browser). `Login` sends the same `authKey` as `Register`.

> **Running the drop requests.** Run `Register`, then `Vault/Create Password` (a drop is made from one of your logins), then the `Drops` folder in order: create, list, look, open, revoke, history, clear history. The drop's blob is random text like the vault's, so `Open a Drop` returns it as is; the real share key never reaches the server. `Look at a Drop` and `Open a Drop` are public and send no `auth-token`. `Open a Drop` takes one of the drop's 3 views, so run it before `Revoke a Drop`.
>
> `Recovery Reset` sets the master password's key to the same sample `authKey` that `Register` and `Login` use, so the account keeps working, and it returns a new `authToken` (the old one stops working when the password changes), which the request stores for the ones after it.

## Endpoint Reference

### Authentication (`/api/auth`)
* `POST /api/auth/register` - Create a new user account
* `POST /api/auth/login` - Authenticate existing user
* `GET /api/auth/me` - Get profile of authenticated user
* `GET /api/auth/prelogin?email=` - The key-derivation settings for an email
* `POST /api/auth/change-password` - Update master password (re-wraps the vault key)
* `POST /api/auth/recovery/unlock` - Prove the recovery key and get the vault key wrapped for it
* `POST /api/auth/recovery/reset` - Prove the recovery key again and set a new master password (re-wraps the vault key; signs in with a new token)
* `POST /api/auth/recovery/rotate` - Replace the recovery key (the old one stops working)
* `DELETE /api/auth/me` - Delete account and all associated vault items

### Vault Passwords (`/api/passwords`)
* `GET /api/passwords` - List all vault credentials for authenticated user
* `POST /api/passwords` - Create a new credential entry
* `PUT /api/passwords/:id` - Update credential entry
* `DELETE /api/passwords/:id` - Delete single credential entry
* `DELETE /api/passwords` - Purge all credentials

### Drops (`/api/drops`)
* `POST /api/drops` - Share one of your logins by a link (a number of views or a timer); the share key stays in the link's `#fragment`, never on the server
* `GET /api/drops` - List your live drops (never the blob)
* `GET /api/drops/history` - List your ended drops from the last 30 days
* `DELETE /api/drops/history` - Clear that history (`?login=` limits it to one login)
* `GET /api/drops/:id` - Public: what is left of a drop, without taking a view
* `DELETE /api/drops/:id` - Revoke one of your drops at once
* `POST /api/drops/:id/open` - Public: take a view and get the blob

### Health
* `GET /` - Answers `{ message: 'PassDrop API is running' }`
