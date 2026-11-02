// Small reusable pieces of the popup: copy buttons and the fields that show a login's details.
import { h, announce } from './dom.js';
import { icon } from './icons.js';

const MASK = '•'.repeat(16);

/** An icon button that copies `text`, then shows a check for a moment instead of raising a toast. */
export function copyButton({ label, text, name = 'copy', className = 'icon-btn' }) {
  const button = h('button', { type: 'button', title: label, 'aria-label': label, class: className }, icon(name));
  let timer;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
    } catch {
      announce('Could not copy');
      return;
    }
    announce(`${label}: done`);
    clearTimeout(timer);
    button.classList.add('done');
    button.replaceChildren(icon('check', 'w-4 h-4 pop'));
    timer = setTimeout(() => {
      button.classList.remove('done');
      button.replaceChildren(icon(name));
    }, 1300);
  });
  return button;
}

/** A labelled value you can copy (the username). */
export function plainField(label, value) {
  return h('div', { class: 'field' },
    h('span', { class: 'lbl' }, label),
    h('span', { class: 'val', title: value }, value || 'Not set'),
    value && h('span', { class: 'acts' }, copyButton({ label: `Copy ${label.toLowerCase()}`, text: value }))
  );
}

/**
 * The password: hidden it shows 16 dots whatever the real length, and the eye shows the real text.
 * The real text is only in the page while it is shown.
 */
export function secretField(label, secret) {
  const value = h('span', { class: 'val mono mask' }, MASK);
  const eye = h('button', {
    type: 'button', class: 'icon-btn', title: 'Show password', 'aria-label': 'Show password', 'aria-pressed': 'false'
  }, icon('eye'));

  const field = h('div', { class: 'field' },
    h('span', { class: 'lbl' }, label),
    value,
    h('span', { class: 'acts' }, eye, copyButton({ label: `Copy ${label.toLowerCase()}`, text: secret }))
  );

  let shown = false;
  eye.addEventListener('click', () => {
    shown = !shown;
    value.textContent = shown ? secret : MASK;
    value.classList.toggle('mask', !shown);
    eye.setAttribute('aria-pressed', String(shown));
    eye.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    eye.title = shown ? 'Hide password' : 'Show password';
    eye.replaceChildren(icon(shown ? 'eye-off' : 'eye', 'w-4 h-4 pop'));
  });
  return field;
}
