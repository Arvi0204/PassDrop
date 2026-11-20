import { ApiError } from './api.js';
import { api } from './client.js';
import { entriesForPage } from './match.js';
import { titleOf } from './popup/format.js';
import { getSession, saveSession, clearSession, saveVaultKey, getCachedVault, setCachedVault } from './storage.js';
import { KDF_MIN_ITERATIONS, deriveKeys, unwrapVaultKey, exportVaultKey } from '../../frontend/src/lib/vaultCrypto.js';

// The service worker is the only place that talks to the server or touches the token, the vault key or a
// password. It derives the keys here: the server only ever gets a proof derived from the master password, and
// the vault key it sends back is unwrapped here and kept in storage.session (see storage.js).
// The popup asks it for things with chrome.runtime.sendMessage (pages never can):
//   { type: 'session' }                    -> { ok, session: { email, expiresAt } | null }
//   { type: 'login', email, password }     -> { ok, session }           derives keys, signs in
//   { type: 'logout' }                     -> { ok }
//   { type: 'vault' }                      -> { ok, vault, syncedAt }   what we have now
//   { type: 'sync' }                       -> { ok, vault, syncedAt }   fetch the latest
// The page script (top frame only) may ask for two things, both answered for the address the browser
// says that frame is on, never for an address the page names:
//   { type: 'logins' }                     -> { ok, logins: [{ id, title, username }] }   no passwords
//   { type: 'credentials', id }            -> { ok, username, password }                  one login, after a click
// A failure is { ok: false, code: 'auth' | 'network' | 'server', error }.

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

let syncing = null; // one fetch at a time, even if the popup, a page and the alarm all ask

/** Fetches the latest vault, caches it, and returns { items, syncedAt }. */
function syncVault() {
  syncing ??= (async () => {
    const session = await getSession();
    if (!session) throw new ApiError('Please sign in.', 'auth');
    try {
      return await setCachedVault(await api.getVault(session.token));
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
  if (!(await getSession())) throw new ApiError('Please sign in.', 'auth');
  return (await getCachedVault()) || syncVault();
}

async function handle(message, sender) {
  switch (message?.type) {
    case 'session': {
      if (!fromExtensionPage(sender)) break;
      return { ok: true, session: publicSession(await getSession()) };
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
    // offline or signed out: the next alarm tries again
  }
});
