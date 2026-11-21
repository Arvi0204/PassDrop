import { h } from './dom.js';
import { ask } from './bridge.js';
import { card, passwordField, errorLine, submitButton } from './authForm.js';

/**
 * Shown when you are signed in but the vault is locked (the browser was closed, which forgets the vault key).
 * Only the master password is needed. `onUnlocked()` once the service worker has the key again; `onSignedOut()`
 * after the sign out link; `onExpired()` if the server no longer accepts the sign-in.
 */
export function renderUnlock({ session, onUnlocked, onSignedOut, onExpired }) {
  const password = passwordField();
  const error = errorLine(password.box);
  const submit = submitButton('Unlock Vault', 'Unlocking...');

  const form = h('form', {
    class: 'space-y-3',
    novalidate: true,
    onSubmit: async (event) => {
      event.preventDefault();
      if (!password.input.value) { error.show('Enter your master password.'); password.input.focus(); return; }

      error.clear();
      submit.setBusy(true);
      const reply = await ask({ type: 'unlock', password: password.input.value });
      if (reply.ok) { onUnlocked(); return; }

      // a wrong password also answers 'auth'; the sign-in itself is gone only if the worker has dropped it
      if (reply.code === 'auth' && !(await ask({ type: 'session' })).session) { onExpired(); return; }

      submit.setBusy(false);
      error.show(reply.error);
      password.input.focus();
      password.input.select();
    }
  },
    password.wrap,
    error.slot,
    submit.button
  );

  return card(
    h('h1', { class: 'text-lg font-bold text-[#0c1820]' }, 'Vault frozen'),
    h('p', { class: 'text-xs text-[#3a5566] mt-0.5 mb-4 break-all' }, `Signed in as ${session.email}`),
    form,
    h('p', { class: 'mt-3 text-center text-xs text-[#3a5566]' }, 'Your passwords are encrypted. Enter your master password to unlock them.'),
    h('p', { class: 'mt-4 pt-3 border-t border-white/60 text-center text-xs text-[#3a5566]' },
      h('button', {
        type: 'button',
        class: 'font-bold text-[#0284c7] hover:underline cursor-pointer',
        onClick: async () => { await ask({ type: 'logout' }); onSignedOut(); }
      }, 'Sign out')
    )
  );
}
