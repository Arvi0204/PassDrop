// What the extension remembers.
//  - the sign-in (token, when it ends, the email to show, the user id) lives in storage.local, so it survives a restart
//  - the vault key and the decrypted vault live only in storage.session: memory, gone when the browser closes,
//    and not readable by content scripts running inside web pages. A sign-in without a vault key is "locked".

const SESSION_KEY = 'session';
const VAULT_KEY = 'vaultKey'; // the raw vault key, base64
const CACHE_KEY = 'vault';

/** The saved sign-in, or null if there is none or it has run out. */
export async function getSession() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) {
    await clearSession();
    return null;
  }
  return session;
}

export async function saveSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

/** Locks: forgets the vault key and the cached vault, but stays signed in. */
export async function lockVault() {
  await chrome.storage.session.remove([VAULT_KEY, CACHE_KEY]);
}

/** Signs out: forgets the token, the vault key and the cached vault. */
export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
  await lockVault();
}

/** The vault key (base64), or null while the vault is locked. */
export async function getVaultKey() {
  const { [VAULT_KEY]: key } = await chrome.storage.session.get(VAULT_KEY);
  return key || null;
}

export async function saveVaultKey(key) {
  await chrome.storage.session.set({ [VAULT_KEY]: key });
}

/** The cached vault as { items, syncedAt }, or null if it has not been fetched in this browser session. */
export async function getCachedVault() {
  const { [CACHE_KEY]: cached } = await chrome.storage.session.get(CACHE_KEY);
  return cached || null;
}

export async function setCachedVault(items) {
  const cached = { items, syncedAt: Date.now() };
  await chrome.storage.session.set({ [CACHE_KEY]: cached });
  return cached;
}
