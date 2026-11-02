// What the extension remembers.
//  - the sign-in (token, when it ends, the email to show) lives in storage.local, so it survives a restart
//  - the vault, with its decrypted passwords, lives only in storage.session: memory, gone when the
//    browser closes, and not readable by content scripts running inside web pages

const SESSION_KEY = 'session';
const VAULT_KEY = 'vault';

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

/** Signs out: forgets the token and the cached vault. */
export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
  await chrome.storage.session.remove(VAULT_KEY);
}

/** The cached vault as { items, syncedAt }, or null if it has not been fetched in this browser session. */
export async function getCachedVault() {
  const { [VAULT_KEY]: cached } = await chrome.storage.session.get(VAULT_KEY);
  return cached || null;
}

export async function setCachedVault(items) {
  const cached = { items, syncedAt: Date.now() };
  await chrome.storage.session.set({ [VAULT_KEY]: cached });
  return cached;
}
