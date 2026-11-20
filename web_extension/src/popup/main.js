import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './popup.css';
import { replaceChildren } from './dom.js';
import { ask } from './bridge.js';
import { renderLogin } from './login.js';
import { renderUnlock } from './unlock.js';
import { renderVault } from './vault.js';

const app = document.getElementById('app');

function showLogin(notice) {
  replaceChildren(app, renderLogin({ notice, onSignedIn: start }));
  app.querySelector('input')?.focus();
}

// signed out -> sign in; signed in but locked -> unlock; otherwise the vault
async function start() {
  const reply = await ask({ type: 'session' });
  if (!reply.ok || !reply.session) return showLogin();
  const expired = () => showLogin('Your session has ended. Please sign in again.');
  if (reply.locked) {
    replaceChildren(app, renderUnlock({ session: reply.session, onUnlocked: start, onSignedOut: () => showLogin(), onExpired: expired }));
    app.querySelector('input')?.focus();
    return;
  }
  replaceChildren(app, renderVault({ session: reply.session, onSignedOut: () => showLogin(), onExpired: expired, onLocked: start }));
}

start();
