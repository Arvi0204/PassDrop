# PassDrop - Backend

This is the backend repository of PassDrop, a password manager app that prioritizes security and performance. The backend handles user authentication, encrypted storage of passwords, and API operations for the frontend and Chrome extension.

---

## Features

- **Secure Authentication**: JSON Web Token (JWT)-based user login validation.
- **Encrypted Data Storage**: Passwords are encrypted using AES-256 before storage.
- **Comprehensive APIs**: CRUD operations for password management.
- **MongoDB Integration**: Data is securely stored and fetched from a MongoDB database.
- **Express Framework**: Lightweight and performant backend framework.

---

## Tech Stack

- **Node.js**: Backend runtime environment.
- **Express.js**: Web framework for building REST APIs.
- **MongoDB**: NoSQL database for secure data storage.
- **AES-256 Encryption**: Ensures all sensitive data is securely encrypted.
- **CORS**: Enabled for secure communication with the frontend.

---

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/Arvi0204/passhaven-backend.git
cd passhaven-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in `backend/` (see `.env.example` at the repository root):
```env
MONGODB_URI=your-mongodb-uri
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=64-character-hex-string-for-aes-256
PORT=3000
```
Optional: `DB_NAME` (default `PassHaven`) and `JWT_EXPIRES_IN` (default `7d`).

### 4. Run the server
```bash
npm start
```

### 5. Test the APIs
Use tools like **Postman** or **ThunderClient** to test the endpoints.

---

## API Endpoints

All paths start with `/api`. Calls other than register and login send the JWT in an `auth-token` header.

### Authentication
- `POST /api/auth/register`: Register a new user. Returns `{ success, authToken, expiresAt }`.
- `POST /api/auth/login`: Authenticate and return `{ success, authToken, expiresAt }`.
- `GET /api/auth/me`: Retrieve the signed-in user's details.
- `POST /api/auth/change-password`: Change the account password.
- `DELETE /api/auth/me`: Delete the account and all its passwords.

### Password Management
- `GET /api/passwords`: Retrieve all passwords for the authenticated user (passwords are returned decrypted).
- `POST /api/passwords`: Create a new password entry.
- `PUT /api/passwords/:id`: Update a password entry.
- `DELETE /api/passwords/:id`: Delete a password entry.
- `DELETE /api/passwords`: Delete all password entries.

Failures are `{ success: false, errors: [{ msg }] }` (validation) or `{ success: false, error }`.

---

## Deployment

The backend is hosted on **Vercel**.

**Live API URL**: [PassDrop Backend](https://pass-haven-backend.vercel.app)

---

## Folder Structure

- **/routes**: Contains route handlers for authentication and password management.
- **/utils**: Helper functions like encryption and token validation.
- **/middlewares**: Express middlewares used to validate user authentication, JWT token verification, and request body parsing.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.