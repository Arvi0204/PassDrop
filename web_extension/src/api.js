// Every call to the PassDrop API lives here. Contract: backend/routes/auth.js and passwords.js.
//  - the token goes in an `auth-token` header (the raw JWT, no "Bearer")
//  - the server only ever sees keys derived from the password and encrypted blobs (src/background.js does the crypto)
//  - failures come back as { success: false, errors: [{ msg }] } or { success: false, error }

export class ApiError extends Error {
  /** @param {'network'|'auth'|'locked'|'server'} kind */
  constructor(message, kind, status = 0) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const messageFrom = (json) => json?.errors?.[0]?.msg || json?.error || json?.message || '';

// When the token stops working, in ms. Newer servers send expiresAt; for older ones, read it from the JWT.
function expiryFromToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).exp * 1000;
  } catch {
    return Date.now() + 24 * 60 * 60 * 1000;
  }
}

/** The PassDrop API, talking to the server at `baseUrl` (no trailing slash). */
export function createApi(baseUrl) {
  async function request(path, { method = 'GET', token, body } = {}) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'auth-token': token } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw new ApiError("Can't reach PassDrop. Check your connection and try again.", 'network');
    }

    let json = null;
    try {
      json = await response.json();
    } catch {
      // an empty or non-JSON body is handled by the status checks below
    }

    if (response.status === 401) {
      throw new ApiError(messageFrom(json) || 'Your session has ended. Please sign in again.', 'auth', 401);
    }
    if (!response.ok || json?.success === false) {
      throw new ApiError(messageFrom(json) || `Something went wrong (${response.status}).`, 'server', response.status);
    }
    return json;
  }

  /** GET /api/auth/prelogin -> the key-derivation settings ({ name, iterations, salt }) for this email */
  async function prelogin(email) {
    const json = await request(`/api/auth/prelogin?email=${encodeURIComponent(email)}`);
    if (!json?.kdf) throw new ApiError('Unexpected reply from the server.', 'server');
    return json.kdf;
  }

  /** POST /api/auth/login with the proof derived from the password (never the password) -> { token, expiresAt, userId, wrappedVaultKey } */
  async function login(email, authKey) {
    const json = await request('/api/auth/login', { method: 'POST', body: { email, authKey } });
    if (!json?.authToken || !json.wrappedVaultKey) throw new ApiError('Unexpected reply from the server.', 'server');
    return {
      token: json.authToken,
      expiresAt: json.expiresAt || expiryFromToken(json.authToken),
      userId: String(json.userId),
      wrappedVaultKey: json.wrappedVaultKey
    };
  }

  /** GET /api/auth/me -> the signed-in user ({ _id, email, kdf, wrappedVaultKey, ... }) */
  function getMe(token) {
    return request('/api/auth/me', { token });
  }

  /** GET /api/passwords -> every saved login as [{ _id, blob, createdAt, updatedAt }]; the blobs are encrypted */
  async function getVault(token) {
    const json = await request('/api/passwords', { token });
    if (!Array.isArray(json)) throw new ApiError('Unexpected reply from the server.', 'server');
    return json;
  }

  return { prelogin, login, getMe, getVault };
}
