import { h, replaceChildren } from './dom.js';
import { icon, logo } from './icons.js';
import { ask } from './bridge.js';
import { WEB_APP_URL } from '../config.js';

const FIELD =
  'w-full h-10 px-3.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] ' +
  'shadow-xs focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all';

/**
 * The sign-in screen. `notice` is shown above the form (for example "your session ended").
 * `onSignedIn()` is called once the service worker has accepted the login.
 */
export function renderLogin({ notice, onSignedIn }) {
  const email = h('input', {
    id: 'email', type: 'email', required: true, autocomplete: 'username',
    placeholder: 'name@example.com', class: FIELD
  });
  const password = h('input', {
    id: 'password', type: 'password', required: true, autocomplete: 'current-password',
    placeholder: 'Enter master password', class: `${FIELD} pr-10 font-mono`
  });

  // eye button: shows or hides what you typed
  const eye = h('button', {
    type: 'button', 'aria-label': 'Show password', 'aria-pressed': 'false',
    class: 'absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] cursor-pointer',
    onClick: () => {
      const showing = password.type === 'password';
      password.type = showing ? 'text' : 'password';
      eye.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
      eye.setAttribute('aria-pressed', String(showing));
      replaceChildren(eye, icon(showing ? 'eye-off' : 'eye').cloneNode(true));
      eye.firstChild.classList.add('pop');
    }
  }, icon('eye'));

  const passwordBox = h('div', { class: 'relative' }, password, eye);
  const passwordWrap = h('div', null,
    h('label', { for: 'password', class: 'block text-[11px] font-bold text-[#0c1820] uppercase tracking-wider mb-1' }, 'Master password'),
    passwordBox
  );

  const errorSlot = h('div', { 'aria-live': 'assertive' });
  const showError = (message) => {
    replaceChildren(
      errorSlot,
      h('p', { role: 'alert', class: 'slide-in flex items-start gap-1.5 text-xs font-semibold text-rose-500' },
        icon('alert-circle', 'w-3.5 h-3.5 mt-px shrink-0'), h('span', null, message))
    );
    passwordBox.classList.remove('shake');
    void passwordBox.offsetWidth; // restart the animation if it is already there
    passwordBox.classList.add('shake');
  };

  const label = h('span', null, 'Unlock Vault');
  const spinner = h('span', { class: 'hidden w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin' });
  const submit = h('button', {
    type: 'submit',
    class: 'w-full h-10 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] ' +
      'hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all ' +
      'flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait cursor-pointer'
  }, spinner, label);

  const setBusy = (busy) => {
    submit.disabled = busy;
    spinner.classList.toggle('hidden', !busy);
    label.textContent = busy ? 'Unlocking...' : 'Unlock Vault';
  };

  const form = h('form', {
    class: 'space-y-3',
    novalidate: true,
    onSubmit: async (event) => {
      event.preventDefault();
      if (!email.value.trim()) { showError('Enter your email address.'); email.focus(); return; }
      if (!password.value) { showError('Enter your master password.'); password.focus(); return; }

      replaceChildren(errorSlot);
      setBusy(true);
      const reply = await ask({ type: 'login', email: email.value, password: password.value });
      if (reply.ok) { onSignedIn(); return; }

      setBusy(false);
      showError(reply.error);
      password.focus();
      password.select();
    }
  },
    h('div', null,
      h('label', { for: 'email', class: 'block text-[11px] font-bold text-[#0c1820] uppercase tracking-wider mb-1' }, 'Email address'),
      email
    ),
    passwordWrap,
    errorSlot,
    submit
  );

  return h('div', { class: 'p-3' },
    h('div', { class: 'rise rounded-2xl bg-[#e1eef5]/70 border border-white/80 backdrop-blur-xl p-5 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)]' },
      h('div', { class: 'flex items-center gap-2 mb-4' },
        logo(30),
        h('span', { class: 'font-extrabold text-lg tracking-tight' },
          h('span', { class: 'text-[#112838]' }, 'Pass'), h('span', { class: 'text-[#0284c7]' }, 'Drop'))
      ),
      h('h1', { class: 'text-lg font-bold text-[#0c1820]' }, 'Welcome back'),
      h('p', { class: 'text-xs text-[#3a5566] mt-0.5 mb-4' }, 'Sign in to open your vault'),
      notice && h('p', { role: 'status', class: 'rise mb-3 rounded-xl bg-amber-50/90 border border-amber-200/80 px-3 py-2 text-xs font-medium text-amber-900' }, notice),
      form,
      h('p', { class: 'mt-4 pt-3 border-t border-white/60 text-center text-xs text-[#3a5566]' },
        'New to PassDrop? ',
        h('a', { href: `${WEB_APP_URL}/signup`, target: '_blank', rel: 'noreferrer', class: 'font-bold text-[#0284c7] hover:underline' }, 'Create an account')
      )
    )
  );
}
