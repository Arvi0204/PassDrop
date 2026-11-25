// Offers a saved login under the login field you click, like a password manager's in-field menu.
// This script holds no passwords. It asks the service worker for the titles and usernames saved for
// this exact page, shows them in a menu the page cannot read, and fetches the password of one login
// only after a real click on that row. The service worker checks the page address every time.
//
// The menu sits in the page's own DOM, so the page can restyle or move it. Because of that, a click on a
// row is trusted only if the menu is still on screen exactly as drawn, fully visible and on top
// (see `genuine`), and a page that tampers with the menu's element gets the menu closed.
//
// shortcut: top frame only, one menu at a time, closes on scroll instead of following the field.

import { findLoginFields, fillFields, originalHints } from './fields.js';
import logoSvg from './assets/logo.svg?raw';

// The popup's look: the aqua card, ink text, sky accents. Always light, so it reads on dark pages too.
// shortcut: system fonts. The popup's own font would have to be exposed to every web page to use it here.
const STYLE = `
  :host { all: initial; }
  .menu { box-sizing: border-box; font: 14px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0c1820;
    background: linear-gradient(to top, #fff1eb 0%, #ace0f9 100%); border: 1px solid rgba(255, 255, 255, .95);
    border-radius: 18px; padding: 10px; box-shadow: 0 16px 36px -10px rgba(17, 40, 56, .45); -webkit-font-smoothing: antialiased; }
  .brand { display: flex; align-items: center; gap: 8px; padding: 6px 10px 10px; font-weight: 800; font-size: 14px; letter-spacing: -.01em; }
  .brand svg { width: 22px; height: 22px; }
  .brand b { color: #0284c7; }
  .rows { display: grid; gap: 4px; }
  button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px;
    border-radius: 13px; cursor: pointer; transition: background .15s; }
  button:hover { background: rgba(255, 255, 255, .6); }
  button:focus-visible { background: rgba(255, 255, 255, .75); outline: 2px solid #0284c7; outline-offset: -2px; }
  .avatar { flex: none; width: 36px; height: 36px; box-sizing: border-box; border-radius: 12px; display: grid; place-items: center;
    background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 14px; overflow: hidden; }
  .avatar.icon { background: #fff; border: 1px solid rgba(17, 40, 56, .1); padding: 5px; }
  .avatar img { width: 100%; height: 100%; object-fit: contain; }
  .t { min-width: 0; flex: 1; }
  strong { display: block; font-weight: 700; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span.u { display: block; margin-top: 2px; color: #3a5566; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  p { margin: 0; padding: 2px 10px 10px; color: #3a5566; font-size: 13px; }
`;

// what the menu says when the service worker has no logins to give: signed out, or signed in but locked
const HINTS = {
  auth: 'Sign in from the PassDrop toolbar icon to fill your logins here.',
  locked: 'Unlock PassDrop from the toolbar icon to fill your logins here.'
};

let current = null; // the menu on screen: { host, anchor, root, close }
let filling = false; // filling focuses the fields, which must not open the menu again
const ask = async (message) => {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return null; // the extension was reloaded or updated under this page
  }
};

// The browser's own suggestions (saved emails, passkeys) open in a window above the page, on top of this menu.
// The only thing a page can do is mark the field autocomplete="off", and only where PassDrop has something
// to offer; elsewhere the browser's list stays. Detection keeps reading the original hints.
// shortcut: this also removes the browser's passkey row on that field, and a page that builds its form
// with script can still show the browser's list on the very first click, before we know there is a login.
let known = false;
const quieted = new WeakSet();
function quiet(field) {
  if (quieted.has(field)) return;
  quieted.add(field);
  originalHints.set(field, field.getAttribute('autocomplete') ?? '');
  field.setAttribute('autocomplete', 'off');
}

// The list of logins for this page, kept for a few seconds so a page that keeps moving focus cannot make
// the extension fetch it over and over.
const LOOKUP_TTL_MS = 5000;
let lookup = null; // { at, reply }
async function logins() {
  if (lookup && Date.now() - lookup.at < LOOKUP_TTL_MS) return lookup.reply;
  const reply = await ask({ type: 'logins' });
  if (reply) lookup = { at: Date.now(), reply };
  return reply;
}

let asking = null; // the field whose list is being fetched
let ticket = 0; // a late answer from the service worker for a menu that is already gone is dropped

const closeMenu = () => {
  ticket++;
  current?.close();
};

// The page's own icon (no third party is told which sites you use). A page's security policy may refuse
// it; then the letter stays.
const siteIcon = () =>
  [...document.querySelectorAll('link[href]')].find((link) => /(^|\s)icon(\s|$)/i.test(link.rel))?.href || `${location.origin}/favicon.ico`;

function showSiteIcon(avatar, url) {
  const img = new Image();
  img.alt = '';
  img.addEventListener('load', () => {
    avatar.classList.add('icon');
    avatar.replaceChildren(img);
  }, { once: true });
  img.src = url;
}

function showMenu(anchor, logins, hint) {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' }); // the page cannot reach into this
  const style = document.createElement('style');
  style.textContent = STYLE;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  const brand = document.createElement('div');
  brand.className = 'brand';
  const mark = new DOMParser().parseFromString(logoSvg, 'image/svg+xml').documentElement;
  const name = document.createElement('span');
  const bold = document.createElement('b');
  bold.textContent = 'Drop';
  name.append('Pass', bold);
  brand.append(document.importNode(mark, true), name);
  menu.append(brand);

  if (!logins) {
    const note = document.createElement('p');
    note.textContent = hint;
    menu.append(note);
  } else {
    const rows = document.createElement('div');
    rows.className = 'rows';
    menu.append(rows);
    const iconUrl = siteIcon();
    for (const login of logins) {
      const row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('role', 'menuitem');
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = login.title.charAt(0).toUpperCase();
      showSiteIcon(avatar, iconUrl); // swaps the letter for the site's icon once it has loaded
      const text = document.createElement('span');
      text.className = 't';
      const title = document.createElement('strong');
      title.textContent = login.title;
      const user = document.createElement('span');
      user.className = 'u';
      user.textContent = login.username || 'No username';
      text.append(title, user);
      row.append(avatar, text);
      row.addEventListener('click', async (event) => {
        if (!event.isTrusted) return; // a script on the page cannot press a row
        const menu = current;
        if (!menu || !genuine(menu, event) || !(await reallyVisible(menu.host)) || current !== menu) {
          closeMenu();
          return;
        }
        choose(login.id);
      });
      rows.append(row);
    }
  }
  root.append(style, menu);

  const rect = anchor.getBoundingClientRect();
  Object.assign(host.style, { position: 'absolute', zIndex: '2147483647', minWidth: `${Math.max(rect.width, 280)}px`, maxWidth: '380px' });
  document.documentElement.append(host);
  const { width, height } = host.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom >= height + 8 || rect.top < height + 8; // above only when below does not fit
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  host.style.left = `${left + window.scrollX}px`;
  host.style.top = `${(below ? rect.bottom + 8 : rect.top - height - 8) + window.scrollY}px`;
  // anything the page does to the menu's own element (style, class, ...) closes it; changes by CSS rules
  // that match the element are caught by `genuine` at click time instead
  const watch = new MutationObserver(closeMenu);
  watch.observe(host, { attributes: true });
  current = {
    host, anchor, root, rect: host.getBoundingClientRect(), shownAt: Date.now(),
    close: () => { watch.disconnect(); host.remove(); current = null; }
  };
}

const TOO_SOON_MS = 300; // a click this soon after the menu appears was aimed at something else

/**
 * Is the menu really what the user is clicking? A page could fade it out, move it, or put a decoy over it
 * so that one click on a "Play" button presses a row. So: nothing on the menu or the root element may
 * hide or transform it, it must still be where it was drawn, and at the click point it must be on top.
 * A click made with the keyboard has no point, so it skips only that last check; `reallyVisible` covers it.
 */
function genuine(menu, event) {
  if (Date.now() - menu.shownAt < TOO_SOON_MS) return false;
  for (const node of [menu.host, document.documentElement]) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || (style.visibility && style.visibility !== 'visible')) return false;
    if (Number(style.opacity) < 0.99) return false;
    if (style.filter && style.filter !== 'none') return false;
    if (style.transform && style.transform !== 'none') return false;
    if (style.clipPath && style.clipPath !== 'none') return false;
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') return false;
  }
  const now = menu.host.getBoundingClientRect();
  const moved = ['left', 'top', 'width', 'height'].some((side) => Math.abs(now[side] - menu.rect[side]) > 2);
  if (moved) return false;
  const byKeyboard = event.detail === 0 && event.clientX === 0 && event.clientY === 0;
  return byKeyboard || document.elementsFromPoint(event.clientX, event.clientY)[0] === menu.host;
}

/**
 * Chrome's own occlusion check: is the menu fully painted with nothing over it, even an overlay that has
 * pointer-events: none (which elementsFromPoint skips) and for keyboard picks, which have no click point?
 * shortcut: Chrome-only (trackVisibility), and a menu that does not report within 500 ms counts as hidden.
 */
function reallyVisible(host) {
  return new Promise((resolve) => {
    let watcher;
    const done = (ok) => { clearTimeout(timer); watcher.disconnect(); resolve(ok); };
    const timer = setTimeout(() => done(false), 500);
    watcher = new IntersectionObserver(
      ([entry]) => done(entry.isVisible === true && entry.intersectionRatio >= 0.99),
      { threshold: 1.0, trackVisibility: true, delay: 100 }
    );
    watcher.observe(host);
  });
}

async function choose(id) {
  const anchor = current?.anchor;
  if (!anchor) return;
  const mine = ++ticket;
  const reply = await ask({ type: 'credentials', id });
  if (mine !== ticket || !reply?.ok) return;
  closeMenu();
  // fill the form of the field the user clicked in, not whichever login form the page has by now
  const found = anchor.isConnected ? findLoginFields(document, { around: anchor }) : { status: 'none' };
  if (found.status !== 'ok') return;
  filling = true;
  try {
    fillFields(found, reply);
  } finally {
    filling = false;
  }
}

async function onField(event) {
  const target = event.target;
  if (!event.isTrusted || filling || current?.anchor === target) return; // a page's own click() or dispatchEvent opens nothing
  closeMenu();
  if (!(target instanceof HTMLInputElement)) return;
  if (findLoginFields(document, { around: target }).status !== 'ok') return; // not a login field
  if (known) quiet(target); // before the browser opens its own list

  if (asking === target) return; // focus and click on the same field arrive together
  asking = target;
  const mine = ticket;
  const reply = await logins();
  if (asking === target) asking = null;
  if (mine !== ticket || !reply) return;
  known = reply.ok ? reply.logins.length > 0 : reply.code in HINTS;
  if (!known) return;
  quiet(target);
  showMenu(target, reply.ok ? reply.logins : null, HINTS[reply.code]);
}

// learn at load whether this page's login form has anything to offer, so the first click is already quiet
(async () => {
  if (findLoginFields(document).status !== 'ok') return;
  const reply = await logins();
  known = !!reply && (reply.ok ? reply.logins.length > 0 : reply.code in HINTS);
})();

const insideMenu = (event) => !!current && event.composedPath().includes(current.host);

document.addEventListener('focusin', (event) => {
  if (insideMenu(event)) return;
  onField(event);
}, true);
document.addEventListener('click', (event) => {
  if (!insideMenu(event)) onField(event);
}, true);
document.addEventListener('mousedown', (event) => {
  if (current && !insideMenu(event) && event.target !== current.anchor) closeMenu();
}, true);
document.addEventListener('keydown', (event) => {
  if (!current) return;
  if (event.key === 'Escape') {
    const anchor = current.anchor;
    closeMenu();
    anchor.focus();
  } else if (event.key === 'ArrowDown' && event.target === current.anchor) {
    event.preventDefault();
    current.root.querySelector('button')?.focus();
  }
}, true);
window.addEventListener('scroll', closeMenu, { passive: true });
window.addEventListener('resize', closeMenu);
