// The pieces the sign-in and unlock screens have in common: the card, the master password box with its
// eye button, the error line that shakes the box, and the submit button with its spinner.
import { h, replaceChildren } from './dom.js';
import { icon, logo } from './icons.js';

export const LABEL = 'block text-[11px] font-bold text-[#0c1820] uppercase tracking-wider mb-1';
export const FIELD =
  'w-full h-10 px-3.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] ' +
  'shadow-xs focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] transition-all';

/** The aqua card with the PassDrop name on top. */
export function card(...children) {
  return h('div', { class: 'p-3' },
    h('div', { class: 'rise rounded-2xl bg-[#e1eef5]/70 border border-white/80 backdrop-blur-xl p-5 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)]' },
      h('div', { class: 'flex items-center gap-2 mb-4' },
        logo(30),
        h('span', { class: 'font-extrabold text-lg tracking-tight' },
          h('span', { class: 'text-[#112838]' }, 'Pass'), h('span', { class: 'text-[#0284c7]' }, 'Drop'))
      ),
      ...children
    )
  );
}

/** The master password input with an eye button that shows or hides what you typed. */
export function passwordField() {
  const input = h('input', {
    id: 'password', type: 'password', required: true, autocomplete: 'current-password',
    placeholder: 'Enter master password', class: `${FIELD} pr-10 font-mono`
  });
  const eye = h('button', {
    type: 'button', 'aria-label': 'Show password', 'aria-pressed': 'false',
    class: 'absolute inset-y-0 right-0 pr-3 flex items-center text-[#5c7788] hover:text-[#0c1820] cursor-pointer',
    onClick: () => {
      const showing = input.type === 'password';
      input.type = showing ? 'text' : 'password';
      eye.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
      eye.setAttribute('aria-pressed', String(showing));
      replaceChildren(eye, icon(showing ? 'eye-off' : 'eye').cloneNode(true));
      eye.firstChild.classList.add('pop');
    }
  }, icon('eye'));
  const box = h('div', { class: 'relative' }, input, eye);
  const wrap = h('div', null, h('label', { for: 'password', class: LABEL }, 'Master password'), box);
  return { input, box, wrap };
}

/** A line for what went wrong; showing it also shakes `box`. */
export function errorLine(box) {
  const slot = h('div', { 'aria-live': 'assertive' });
  return {
    slot,
    clear: () => replaceChildren(slot),
    show(message) {
      replaceChildren(
        slot,
        h('p', { role: 'alert', class: 'slide-in flex items-start gap-1.5 text-xs font-semibold text-rose-500' },
          icon('alert-circle', 'w-3.5 h-3.5 mt-px shrink-0'), h('span', null, message))
      );
      box.classList.remove('shake');
      void box.offsetWidth; // restart the animation if it is already there
      box.classList.add('shake');
    }
  };
}

/** The wide blue submit button; `setBusy(true)` swaps its label for `busyText` and a spinner. */
export function submitButton(text, busyText) {
  const label = h('span', null, text);
  const spinner = h('span', { class: 'hidden w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin' });
  const button = h('button', {
    type: 'submit',
    class: 'w-full h-10 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] ' +
      'hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 transition-all ' +
      'flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait cursor-pointer'
  }, spinner, label);
  return {
    button,
    setBusy(busy) {
      button.disabled = busy;
      spinner.classList.toggle('hidden', !busy);
      label.textContent = busy ? busyText : text;
    }
  };
}
