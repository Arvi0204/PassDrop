import { ApiError } from './api.js';
import { api } from './client.js';
import { entriesForPage } from './match.js';
import { titleOf } from './popup/format.js';
import { getSession, saveSession, clearSession, getVaultKey, saveVaultKey, getCachedVault, setCachedVault } from './storage.js';
import {
  KDF_MIN_ITERATIONS, deriveKeys, unwrapVaultKey, exportVaultKey, importVaultKey, decryptItem
} from '../../frontend/src/lib/vaultCrypto.js';

// The service worker is the only place that talks to the server or touches the token, the vault key or a
// password. It does all the cryptography: the server only ever gets keys derived from the master password and
// returns encrypted logins, which are decrypted here and cached in storage.session (see storage.js).
// The popup asks it for things with chrome.runtime.sendMessage (pages never can):
//   { type: 'session' }                    -> { ok, session: { email, expiresAt } | null, locked }
//   { type: 'login', email, password }     -> { ok, session }           derives keys, signs in, unlocks
//   { type: 'unlock', password }           -> { ok }                    signed in but locked (browser restarted)
//   { type: 'logout' }                     -> { ok }
//   { type: 'vault' }                      -> { ok, vault, syncedAt }   what we have now
//   { type: 'sync' }                       -> { ok, vault, syncedAt }   fetch and decrypt the latest
// The page script (top frame only) may ask for two things, both answered for the address the browser
// says that frame is on, never for an address the page names:
//   { type: 'logins' }                     -> { ok, logins: [{ id, title, username }] }   no passwords
//   { type: 'credentials', id }            -> { ok, username, password }                  one login, after a click
// A failure is { ok: false, code: 'auth' | 'locked' | 'network' | 'server', error }. 'locked' is a sign-in with no
// vault key: vault, sync, logins and credentials all answer it until the master password is typed again.

// A server that asked for fewer iterations would make the master password cheap to guess from what it receives.
// Only the tests' bundler sets TEST_KDF_MIN_ITERATIONS (a define; it has no VITE_ prefix, so no .env file can set it).
const MIN_ITERATIONS = Number(import.meta.env.TEST_KDF_MIN_ITERATIONS) || KDF_MIN_ITERATIONS;
const WRONG_PASSWORD = 'That is not your master password.';

const SYNC_ALARM = 'sync';
const SYNC_EVERY_MINUTES = 5;

const fromExtensionPage = (sender) =>
  sender.id === chrome.runtime.id && !sender.tab && !!sender.url?.startsWith(chrome.runtime.getURL(''));

// sender.url is set by the browser, so a page cannot claim to be another site
const fromTopFrame = (sender) => sender.id === chrome.runtime.id && !!sender.tab && sender.frameId === 0 && !!sender.url;

const publicSession = (session) => (session ? { email: session.email, expiresAt: session.expiresAt } : null);

function checkedKdf(kdf) {
  if (!kdf || kdf.name !== 'PBKDF2-SHA256' || !(kdf.iterations >= MIN_ITERATIONS) || typeof kdf.salt !== 'string') {
    throw new ApiError('The server sent unsafe key settings. Not signing in.', 'server');
  }
  return kdf;
}

/** The vault key (base64) from what the server stored: the key wrapped by the master password. */
async function unwrapWith(wrapKey, wrappedVaultKey) {
  try {
    return await exportVaultKey(await unwrapVaultKey(wrappedVaultKey, wrapKey));
  } catch {
    throw new ApiError(WRONG_PASSWORD, 'auth');
  }
}

/** The sign-in and its vault key. A sign-in without a key is locked. */
async function signedIn() {
  const session = await getSession();
  if (!session) throw new ApiError('Please sign in.', 'auth');
  const key = await getVaultKey();
  if (!key) throw new ApiError('Unlock PassDrop to see your logins.', 'locked');
  return { session, key };
}

let syncing = null; // one fetch at a time, even if the popup, a page and the alarm all ask

/** Fetches the latest vault, decrypts it, caches it, and returns { items, syncedAt }. */
function syncVault() {
  syncing ??= (async () => {
    const { session, key } = await signedIn();
    try {
      const blobs = await api.getVault(session.token);
      const vaultKey = await importVaultKey(key);
      const items = [];
      for (const { _id, blob, createdAt, updatedAt } of blobs) {
        try {
          items.push({ ...(await decryptItem(vaultKey, blob, session.userId)), _id, createdAt, updatedAt });
        } catch {
          // one corrupt or foreign blob must not hide the rest
        }
      }
      // signed out or locked while we were fetching: do not leave a decrypted copy behind
      if ((await getVaultKey()) !== key) throw new ApiError('Unlock PassDrop to see your logins.', 'locked');
      return await setCachedVault(items);
    } catch (error) {
      // a token the server no longer accepts is as good as no token
      if (error.kind === 'auth') await clearSession();
      throw error;
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** The vault we already have, fetching it only if this browser session has none yet. */
async function loadVault() {
  await signedIn();
  return (await getCachedVault()) || syncVault();
}

async function handle(message, sender) {
  switch (message?.type) {
    case 'session': {
      if (!fromExtensionPage(sender)) break;
      const session = await getSession();
      return { ok: true, session: publicSession(session), locked: !!session && !(await getVaultKey()) };
    }

    case 'login': {
      if (!fromExtensionPage(sender)) break;
      const email = String(message.email || '').trim().toLowerCase();
      const { authKey, wrapKey } = await deriveKeys(String(message.password || ''), checkedKdf(await api.prelogin(email)));
      const { token, expiresAt, userId, wrappedVaultKey } = await api.login(email, authKey);
      const key = await unwrapWith(wrapKey, wrappedVaultKey);
      // everything worked: only now replace what was stored, so a wrong password stores nothing
      const session = { token, expiresAt, email, userId };
      await clearSession();
      await saveSession(session);
      await saveVaultKey(key);
      return { ok: true, session: publicSession(session) };
    }

    case 'unlock': {
      if (!fromExtensionPage(sender)) break;
      const session = await getSession();
      if (!session) throw new ApiError('Please sign in.', 'auth');
      let me;
      try {
        me = await api.getMe(session.token);
      } catch (error) {
        if (error.kind === 'auth') await clearSession();
        throw error;
      }
      const { wrapKey } = await deriveKeys(String(message.password || ''), checkedKdf(me.kdf));
      const key = await unwrapWith(wrapKey, me.wrappedVaultKey);
      await saveSession({ ...session, userId: session.userId ?? String(me._id) });
      await saveVaultKey(key);
      return { ok: true };
    }

    case 'logout': {
      if (!fromExtensionPage(sender)) break;
      await clearSession();
      return { ok: true };
    }

    case 'vault': {
      if (!fromExtensionPage(sender)) break;
      const { items, syncedAt } = await loadVault();
      return { ok: true, vault: items, syncedAt };
    }

    case 'sync': {
      if (!fromExtensionPage(sender)) break;
      const { items, syncedAt } = await syncVault();
      return { ok: true, vault: items, syncedAt };
    }

    case 'logins': {
      if (!fromTopFrame(sender)) break;
      const { items } = await loadVault();
      const logins = entriesForPage(items, sender.url).map((e) => ({ id: e._id, title: titleOf(e), username: e.username || '' }));
      return { ok: true, logins };
    }

    case 'credentials': {
      if (!fromTopFrame(sender)) break;
      const { items } = await loadVault();
      const entry = items.find((item) => item._id === message.id);
      // the login must belong to the address this frame is on right now (https, exact host)
      if (!entry || !entriesForPage([entry], sender.url).length) {
        return { ok: false, code: 'server', error: "This login isn't saved for the page you're on." };
      }
      return { ok: true, username: entry.username, password: entry.password };
    }

    default:
      break;
  }
  return { ok: false, code: 'server', error: 'Request not allowed.' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        code: error?.kind || 'server',
        error: error?.message || 'Something went wrong.'
      });
    });
  return true; // the reply is sent after an await
});

// Keep the vault fresh without anyone asking, so autofill and the popup never show an old copy.
chrome.alarms.get(SYNC_ALARM).then((alarm) => {
  if (!alarm) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_EVERY_MINUTES });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SYNC_ALARM || !(await getSession())) return;
  try {
    await syncVault();
  } catch {
    // offline, signed out or locked: the next alarm tries again
  }
});
