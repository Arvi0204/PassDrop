// The password generator: a sheet that slides over the popup, like the web app's generator modal.
// The password itself comes from the web app's generator (shared.js), so both always agree.
import { h, announce } from './dom.js';
import { icon, dropMark } from './icons.js';
import { copyButton } from './controls.js';
import { generatePassword, strengthOf, LENGTH_RANGE, DEFAULT_OPTIONS } from './shared.js';

const PRESETS = [12, 16, 20, 24];
const ROLL_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const randomChar = () => {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return ROLL_CHARS[n[0] % ROLL_CHARS.length];
};

const BADGE = {
  1: { text: 'Weak', cls: 'weak' },
  2: { text: 'Weak', cls: 'weak' },
  3: { text: 'Good', cls: 'fair' },
  4: { text: 'Strong', cls: '' }
};

/** Creates the sheet and adds it to the page. Returns { open, close, isOpen }. */
export function createGenerator() {
  const settings = { ...DEFAULT_OPTIONS };
  let password = '';
  let opener = null;
  let rolling = null;

  // ----- pieces
  const preview = h('span', { class: 'pv mono', 'aria-live': 'polite' });
  const copy = copyButton({ label: 'Copy password', text: () => password });
  const segments = [0, 1, 2, 3].map(() => h('i'));
  const meter = h('div', { class: 'meter', 'aria-hidden': 'true' }, segments);
  const badge = h('span', { class: 'badge' });
  const lengthValue = h('span', { class: 'mono' }, String(settings.length));
  const slider = h('input', {
    type: 'range', min: LENGTH_RANGE.min, max: LENGTH_RANGE.max, value: settings.length, 'aria-label': 'Password length'
  });
  const presetButtons = PRESETS.map((n) =>
    h('button', { type: 'button', 'data-n': n, onClick: () => setLength(n) }, String(n))
  );

  const checkMark = () => {
    const svg = icon('check', 'w-3.5 h-3.5');
    svg.setAttribute('stroke-width', '3.2');
    svg.setAttribute('stroke', '#fff');
    return svg;
  };
  const option = (key, label) => {
    const el = h('button', { type: 'button', class: 'opt', role: 'checkbox', 'aria-checked': 'true' },
      h('span', { class: 'box' }, checkMark()),
      label
    );
    el.addEventListener('click', () => toggle(key, el));
    return el;
  };
  const numbers = option('includeNumbers', 'Include numbers (0-9)');
  const symbols = option('includeSpecialChars', 'Include symbols (!@#$)');

  const closeButton = h('button', { type: 'button', class: 'icon-btn ml-auto', 'aria-label': 'Close generator', onClick: close }, icon('x', 'w-[18px] h-[18px]'));
  const regenerateButton = h('button', { type: 'button', class: 'btn ghost', onClick: regenerate }, icon('refresh-cw', 'w-4 h-4'), 'Regenerate');
  const copyCloseButton = h('button', {
    type: 'button', class: 'btn primary',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(password);
      } catch {
        copyError.hidden = false;
        announce('Could not copy');
        return;
      }
      close();
    }
  }, icon('copy', 'w-4 h-4'), 'Copy & close');
  const copyError = h('p', { class: 'copy-error', role: 'alert', hidden: true }, 'Could not copy. Copy the password above instead.');

  const sheet = h('div', { class: 'sheetmodal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Password generator', hidden: true },
    h('div', { class: 'gh' }, icon('sparkles', 'w-[18px] h-[18px]'), 'Password generator', closeButton),
    h('div', { class: 'preview' }, preview, copy),
    meter,
    badge,
    h('div', { class: 'lenrow' }, h('span', null, 'Length ', lengthValue), h('div', { class: 'presets' }, presetButtons)),
    slider,
    numbers,
    symbols,
    h('div', { class: 'gfoot' }, regenerateButton, copyCloseButton),
    copyError
  );
  const scrim = h('div', { class: 'scrim', hidden: true, onClick: close });
  document.body.append(scrim, sheet);

  // ----- behaviour
  function paint(text, highlight) {
    preview.replaceChildren(...[...text].map((ch) => {
      const span = h('span', null, ch);
      const added = highlight === 'symbols' ? /[^A-Za-z0-9]/.test(ch) : highlight === 'numbers' ? /[0-9]/.test(ch) : false;
      if (added) span.className = 'flash';
      return span;
    }));

    const { score } = strengthOf(text);
    segments.forEach((seg, i) => seg.classList.toggle('on', i < score));
    meter.dataset.score = String(score);
    const look = BADGE[Math.max(1, score)];
    badge.className = `badge ${look.cls}`.trim();
    badge.replaceChildren(look.text, score === 4 ? icon('check', 'w-3 h-3 pop') : '');
  }

  function roll() {
    clearInterval(rolling);
    if (reduceMotion()) return paint(password);
    const target = password;
    const start = performance.now();
    rolling = setInterval(() => {
      const settled = Math.floor((performance.now() - start - 120) / 22);
      if (settled >= target.length) {
        clearInterval(rolling);
        paint(target);
        return;
      }
      preview.textContent = [...target].map((ch, i) => (i < settled ? ch : randomChar())).join('');
    }, 45);
  }

  function regenerate() {
    password = generatePassword(settings);
    roll();
  }

  function setLength(n) {
    settings.length = n;
    slider.value = n;
    lengthValue.textContent = String(n);
    presetButtons.forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === n));
    password = generatePassword(settings);
    paint(password);
  }

  // Ticking an option sends a drop from the box into the password; the new password appears where it lands.
  function toggle(key, el) {
    const on = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(on));
    settings[key] = on;
    const highlight = key === 'includeSpecialChars' ? 'symbols' : 'numbers';
    if (!on || reduceMotion()) {
      password = generatePassword(settings);
      paint(password);
      return;
    }
    flyDrop(el.querySelector('.box'), preview, () => {
      password = generatePassword(settings);
      paint(password, highlight);
    });
  }

  function flyDrop(fromEl, toEl, onLand) {
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const end = { x: to.left + Math.min(to.width, 200) * 0.55, y: to.top + to.height / 2 };

    const drop = h('div', { class: 'drop' }, dropMark());
    document.body.append(drop);
    const flight = drop.animate(
      [
        { transform: `translate(${start.x - 8}px, ${start.y - 10}px) scale(0.7)` },
        { transform: `translate(${(start.x + end.x) / 2 + 24}px, ${Math.min(start.y, end.y) - 26}px) scale(1.05)`, offset: 0.5 },
        { transform: `translate(${end.x - 8}px, ${end.y - 10}px) scale(0.6)` }
      ],
      { duration: 430, easing: 'cubic-bezier(.45,0,.55,1)' }
    );
    flight.onfinish = () => {
      drop.remove();
      onLand();
      const splash = h('div', { class: 'splash', style: `left:${end.x}px;top:${end.y}px` });
      document.body.append(splash);
      splash.animate(
        [{ transform: 'scale(0.4)', opacity: 1 }, { transform: 'scale(3.6)', opacity: 0 }],
        { duration: 540, easing: 'cubic-bezier(.2,.7,.3,1)' }
      ).onfinish = () => splash.remove();
    };
  }

  function open() {
    opener = document.activeElement;
    copyError.hidden = true;
    document.body.classList.add('gen-open');
    scrim.hidden = false;
    sheet.hidden = false;
    void sheet.offsetWidth; // settle the closed position first, so the sheet slides in
    document.body.classList.add('gen-shown');
    presetButtons.forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === settings.length));
    regenerate();
    closeButton.focus();
  }

  function close() {
    if (sheet.hidden) return;
    clearInterval(rolling);
    document.body.classList.remove('gen-shown');
    setTimeout(() => {
      if (document.body.classList.contains('gen-shown')) return; // reopened meanwhile
      sheet.hidden = true;
      scrim.hidden = true;
      document.body.classList.remove('gen-open');
    }, 340);
    opener?.focus?.();
  }

  slider.addEventListener('input', () => setLength(Number(slider.value)));
  sheet.addEventListener('keydown', (event) => {
    // keep Tab inside the sheet while it is open
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button, input')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  return { open, close, isOpen: () => !sheet.hidden };
}
