// Finding the login fields on a page, and filling them the way a person typing would.
// These are plain functions of a document, so they can be tested without a browser.
//
// shortcut: top frame only, no shadow DOM, and no check for a field covered by another element.
// Upgrade when a site we care about puts its login in an iframe or a web component.

const TEXT_TYPES = ['text', 'email', 'tel'];

// What a field's autocomplete said before the content script set it to "off" (see content.js).
export const originalHints = new WeakMap();

const tokens = (el) => (originalHints.get(el) ?? el.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/);
const asksFor = (el, word) => tokens(el).includes(word);

/**
 * Is this field something a person could see and type in? Honeypots are fields that are hidden, clipped
 * away or pushed off the page so that only a script fills them in, so those must stay empty.
 *
 * shortcut: a field pushed far below the fold looks like one on a long page, and a field covered by
 * another element still counts. Upgrade when a site we care about uses either against us.
 */
export function isVisibleInPage(el) {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const rect = el.getBoundingClientRect();
  let shown = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }; // what no ancestor clips away

  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number(style.opacity) === 0) return false;
    if ((style.clipPath && style.clipPath !== 'none') || (style.clip && style.clip !== 'auto')) return false;
    // an ancestor that hides its overflow cuts the field down to the part inside it (the page itself scrolls)
    const clips = [style.overflowX, style.overflowY].some((value) => value && value !== 'visible');
    if (clips && node !== el && node !== doc.documentElement && node !== doc.body) {
      const box = node.getBoundingClientRect();
      shown = {
        left: Math.max(shown.left, box.left), top: Math.max(shown.top, box.top),
        right: Math.min(shown.right, box.right), bottom: Math.min(shown.bottom, box.bottom)
      };
    }
  }
  if (shown.right - shown.left < 4 || shown.bottom - shown.top < 4) return false; // 1px fields, and fields clipped to nothing
  if (rect.right + win.scrollX <= 0 || rect.bottom + win.scrollY <= 0) return false; // pushed off the top or left edge
  if (rect.left >= win.innerWidth) return false; // pushed off the right edge (a login form never needs a sideways scroll)
  return true;
}

const looksLikeSearch = (el) =>
  el.getAttribute('role') === 'searchbox' ||
  /search/i.test(`${el.name} ${el.id} ${el.placeholder} ${el.getAttribute('aria-label') || ''}`);

function pickUsername(candidates) {
  const hinted = candidates.filter((el) => asksFor(el, 'username') || asksFor(el, 'email'));
  const pool = hinted.length ? hinted : candidates;
  return pool.at(-1) ?? null; // the nearest one above the password
}

/**
 * Looks for a login form in `doc`; with `around` (a field), only the form that field belongs to. Returns:
 *   { status: 'ok', username, password }  at least one of the two is an element (the other may be null:
 *                                         login pages that ask for the username first, then the password)
 *   { status: 'signup' }                  the only password fields belong to a sign-up or change-password form
 *   { status: 'none' }                    nothing to fill
 */
export function findLoginFields(doc, { isVisible = isVisibleInPage, around = null } = {}) {
  const FOLLOWING = doc.defaultView.Node.DOCUMENT_POSITION_FOLLOWING;
  const usable = (el) => !el.disabled && !el.readOnly && isVisible(el);

  const inputs = [...doc.querySelectorAll('input')];
  const passwords = inputs.filter((el) => el.type === 'password' && usable(el));
  const texts = inputs.filter((el) => TEXT_TYPES.includes(el.type) && usable(el) && !looksLikeSearch(el));

  // password fields grouped by the form they are in (null: not in a form)
  const groups = new Map();
  for (const el of passwords) groups.set(el.form, [...(groups.get(el.form) || []), el]);

  const forms = []; // one { status: 'ok', username, password } per login form
  let sawSignup = false;
  for (const [form, fields] of groups) {
    // two password fields ("confirm it") or a new-password hint: this form makes a password, it does not use one
    if (fields.length > 1 || fields.some((el) => asksFor(el, 'new-password'))) {
      sawSignup = true;
      continue;
    }
    const [password] = fields;
    const above = texts.filter((el) => el.form === form && el.compareDocumentPosition(password) & FOLLOWING);
    forms.push({ status: 'ok', username: pickUsername(above), password });
  }
  if (forms.length) {
    return around ? forms.find((f) => f.username === around || f.password === around) ?? { status: 'none' } : forms[0];
  }
  if (sawSignup) return { status: 'signup' };

  // no password field yet: a first step that only asks for the username, which must say so
  const firstStep = texts.filter((el) => asksFor(el, 'username') || asksFor(el, 'email'));
  if (firstStep.length === 1 && (!around || firstStep[0] === around)) {
    return { status: 'ok', username: firstStep[0], password: null };
  }
  return { status: 'none' };
}

/**
 * Puts `value` in a field so the page notices. Pages built with React or Vue keep their own copy of
 * what an input holds and ignore a plain `el.value = ...`, so this uses the browser's own setter and
 * then sends the events a keyboard would.
 */
export function setValue(el, value) {
  const win = el.ownerDocument.defaultView;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}

/** Fills what was found; returns which of 'username' and 'password' were filled. */
export function fillFields(found, { username, password }) {
  const filled = [];
  if (found.username && username) {
    setValue(found.username, username);
    filled.push('username');
  }
  if (found.password && password) {
    setValue(found.password, password);
    filled.push('password');
  }
  (found.password || found.username)?.focus();
  return filled;
}
