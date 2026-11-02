import { ApiError } from './api.js';
import { api } from './client.js';
import { entriesForPage } from './match.js';
import { getSession, saveSession, clearSession, getCachedVault, setCachedVault } from './storage.js';

// The service worker is the only place that talks to the server or touches the token.
// The popup and the content script ask it for things with chrome.runtime.sendMessage:
//   { type: 'session' }                    -> { ok, session: { email, expiresAt } | null }
//   { type: 'login', email, password }     -> { ok, session }
//   { type: 'logout' }                     -> { ok }
//   { type: 'vault' }                      -> { ok, vault, syncedAt }   what we have now (popup only)
//   { type: 'sync' }                       -> { ok, vault, syncedAt }   fetch the latest (popup only)
//   { type: 'matches' }                    -> { ok, entries }           content script: logins for ITS page only
// A failure is { ok: false, code: 'auth' | 'network' | 'server', error }.

const SYNC_ALARM = 'sync';
const SYNC_EVERY_MINUTES = 5;

const fromExtensionPage = (sender) =>
  sender.id === chrome.runtime.id && !sender.tab && !!sender.url?.startsWith(chrome.runtime.getURL(''));

const fromContentScript = (sender) => sender.id === chrome.runtime.id && !!sender.tab && !!sender.url;

const publicSession = (session) => (session ? { email: session.email, expiresAt: session.expiresAt } : null);

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
      const { token, expiresAt } = await api.login(String(message.email || '').trim(), String(message.password || ''));
      const me = await api.getMe(token).catch(() => null);
      const session = { token, expiresAt, email: me?.email || String(message.email).trim() };
      await saveSession(session);
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

    case 'matches': {
      if (!fromContentScript(sender)) break;
      if (!(await getSession())) return { ok: true, entries: [] };
      const { items } = await loadVault();
      // only what the page needs to fill in, and only for the page that asked
      const entries = entriesForPage(items, sender.url).map(({ username, password }) => ({ username, password }));
      return { ok: true, entries };
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
