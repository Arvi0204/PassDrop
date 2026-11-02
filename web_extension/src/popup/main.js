import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import './popup.css';
import { replaceChildren } from './dom.js';
import { ask } from './bridge.js';
import { renderLogin } from './login.js';
import { renderVault } from './vault.js';

const app = document.getElementById('app');

function showLogin(notice) {
  replaceChildren(app, renderLogin({ notice, onSignedIn: showVault }));
  app.querySelector('input')?.focus();
}

async function showVault() {
  const reply = await ask({ type: 'session' });
  if (!reply.ok || !reply.session) return showLogin();
  replaceChildren(app, renderVault({
    session: reply.session,
    onSignedOut: () => showLogin(),
    onExpired: () => showLogin('Your session has ended. Please sign in again.')
  }));
}

showVault();
