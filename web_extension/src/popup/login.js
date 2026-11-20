import { h } from './dom.js';
import { ask } from './bridge.js';
import { card, passwordField, errorLine, submitButton, LABEL, FIELD } from './authForm.js';
import { WEB_APP_URL } from '../config.js';

/**
 * The sign-in screen. `notice` is shown above the form (for example "your session ended").
 * `onSignedIn()` is called once the service worker has accepted the login and unlocked the vault.
 */
export function renderLogin({ notice, onSignedIn }) {
  const email = h('input', {
    id: 'email', type: 'email', required: true, autocomplete: 'username',
    placeholder: 'name@example.com', class: FIELD
  });
  const password = passwordField();
  const error = errorLine(password.box);
  const submit = submitButton('Unlock Vault', 'Unlocking...');

  const form = h('form', {
    class: 'space-y-3',
    novalidate: true,
    onSubmit: async (event) => {
      event.preventDefault();
      if (!email.value.trim()) { error.show('Enter your email address.'); email.focus(); return; }
      if (!password.input.value) { error.show('Enter your master password.'); password.input.focus(); return; }

      error.clear();
      submit.setBusy(true);
      const reply = await ask({ type: 'login', email: email.value, password: password.input.value });
      if (reply.ok) { onSignedIn(); return; }

      submit.setBusy(false);
      error.show(reply.error);
      password.input.focus();
      password.input.select();
    }
  },
    h('div', null, h('label', { for: 'email', class: LABEL }, 'Email address'), email),
    password.wrap,
    error.slot,
    submit.button
  );

  return card(
    h('h1', { class: 'text-lg font-bold text-[#0c1820]' }, 'Welcome back'),
    h('p', { class: 'text-xs text-[#3a5566] mt-0.5 mb-4' }, 'Sign in to open your vault'),
    notice && h('p', { role: 'status', class: 'rise mb-3 rounded-xl bg-amber-50/90 border border-amber-200/80 px-3 py-2 text-xs font-medium text-amber-900' }, notice),
    form,
    h('p', { class: 'mt-4 pt-3 border-t border-white/60 text-center text-xs text-[#3a5566]' },
      'New to PassDrop? ',
      h('a', { href: `${WEB_APP_URL}/signup`, target: '_blank', rel: 'noreferrer', class: 'font-bold text-[#0284c7] hover:underline' }, 'Create an account')
    )
  );
}
