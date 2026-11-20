# PassDrop Bruno API Collection

This directory contains a complete [Bruno](https://www.usebruno.com/) collection for testing and inspecting the PassDrop REST API.

## How to Open in Bruno

1. Install and open **Bruno**.
2. Click **Open Collection** on the Bruno home screen.
3. Select the `backend/bruno` folder in this repository.
4. In the top-right corner, select the **Local** environment (`environments/Local.bru`).

## Features Included in the Collection

* **Automatic Token Handling**: When running `Register` or `Login`, the response's `authToken` is automatically captured and populated into the environment for subsequent requests.
* **Automatic ID Capture**: When creating a password via `POST /api/passwords`, the created ID is stored in `{{createdPasswordId}}` for instant testing with `PUT` and `DELETE`.

> **The requests carry made-up keys.** The server only checks that the keys have the right shape; it cannot tell a real one from a random one, so the sample bodies use random base64. An account created here can be inspected through the API, but it cannot be signed in to from the web app (the web app derives its keys from a real master password, in the browser). `Login` sends the same `authKey` as `Register`.

## Endpoint Reference

### Authentication (`/api/auth`)
* `POST /api/auth/register` - Create a new user account
* `POST /api/auth/login` - Authenticate existing user
* `GET /api/auth/me` - Get profile of authenticated user
* `GET /api/auth/prelogin?email=` - The key-derivation settings for an email
* `POST /api/auth/change-password` - Update master password (re-wraps the vault key)
* `POST /api/auth/recovery/unlock` and `/recovery/reset` - Recover an account with the recovery key
* `POST /api/auth/recovery/rotate` - Replace the recovery key (the old one stops working)
* `DELETE /api/auth/me` - Delete account and all associated vault items

### Vault Passwords (`/api/passwords`)
* `GET /api/passwords` - List all vault credentials for authenticated user
* `POST /api/passwords` - Create a new credential entry
* `PUT /api/passwords/:id` - Update credential entry
* `DELETE /api/passwords/:id` - Delete single credential entry
* `DELETE /api/passwords` - Purge all credentials
