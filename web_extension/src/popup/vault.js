import { h, replaceChildren } from './dom.js';
import { icon, logo } from './icons.js';
import { ask } from './bridge.js';
import { plainField, secretField } from './controls.js';
import { createGenerator } from './generator.js';
import { titleOf, timeAgo, openableUrl, colourIndex, siteIconUrl } from './format.js';
import { WEB_APP_URL } from '../config.js';
import { entriesForPage, hostOf } from '../match.js';

const AVATARS = [
  'bg-sky-100 text-sky-700', 'bg-cyan-100 text-cyan-700', 'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700', 'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700'
];
const RESYNC_EVERY_MS = 30_000;

const loadedIcons = new Set(); // icons the browser already has, so redrawing the list does not flash the letter first

/** The letter tile for a login, swapped for the site's icon once that has loaded. The letter stays if it never does. */
function avatar(entry) {
  const name = titleOf(entry);
  const tile = h('span', { class: `avatar ${AVATARS[colourIndex(name, AVATARS.length)]}`, 'aria-hidden': 'true' },
    name.charAt(0).toUpperCase());
  const url = siteIconUrl(entry.url);
  if (!url) return tile;

  const img = new Image();
  img.alt = '';
  const show = () => {
    loadedIcons.add(url);
    tile.classList.add('icon');
    tile.replaceChildren(img);
  };
  if (loadedIcons.has(url)) {
    img.src = url; // already in the browser's cache
    show();
  } else {
    img.addEventListener('load', show, { once: true });
    img.src = url;
  }
  return tile;
}

const link = (href, ...children) => h('a', { class: 'linkrow', href, target: '_blank', rel: 'noreferrer' }, ...children);

/**
 * The signed-in popup: a home screen (search, this site's login, everything else) and a detail
 * screen for one login. `onSignedOut()` after sign out; `onExpired()` when the server ends the sign-in;
 * `onLocked()` if the vault key is gone (the popup then asks for the master password).
 */
export function renderVault({ session, onSignedOut: signedOut, onExpired: expired, onLocked: locked }) {
  const state = {
    items: [], syncedAt: 0, hasData: false, loading: true, syncing: false, offline: false,
    error: '', query: '', chosen: 0, pageUrl: '', view: 'home', detailId: null
  };
  const root = h('div', { class: 'screen' });
  const generator = createGenerator();
  let menuOpen = false;
  const timers = [];
  // leaving this screen also stops its timers, so a screen that is gone never syncs again
  const leave = (next) => () => { timers.forEach(clearInterval); next(); };
  const onSignedOut = leave(signedOut);
  const onExpired = leave(expired);
  const onLocked = leave(locked);

  // ---------------------------------------------------------------- sync
  const syncText = h('span', null, '');
  const syncBox = h('div', { class: 'sync', role: 'status' }, h('span', { class: 'dot' }), syncText);

  function paintSync() {
    syncBox.classList.toggle('busy', state.syncing);
    syncBox.classList.toggle('off', state.offline);
    syncText.textContent = state.offline
      ? 'Offline'
      : state.syncing
        ? 'Syncing…'
        : state.hasData ? `Synced ${timeAgo(state.syncedAt)}` : '';
  }

  function adopt(reply) {
    const changed = JSON.stringify(reply.vault) !== JSON.stringify(state.items);
    state.items = reply.vault;
    state.syncedAt = reply.syncedAt;
    state.hasData = true;
    state.loading = false;
    return changed;
  }

  async function sync() {
    if (state.syncing) return;
    state.syncing = true;
    paintSync();
    const reply = await ask({ type: 'sync' });
    state.syncing = false;
    if (reply.ok) {
      state.offline = false;
      const changed = adopt(reply);
      drawBanner(); // the banner goes even when nothing else changed
      if (changed) redraw();
    } else if (reply.code === 'auth') {
      onExpired();
      return;
    } else if (reply.code === 'locked') {
      onLocked();
      return;
    } else {
      state.offline = true;
      state.error = reply.error;
      if (!state.hasData) state.loading = false;
      redraw();
    }
    paintSync();
  }

  // ---------------------------------------------------------------- home
  const search = h('input', {
    type: 'search', class: 'input', placeholder: 'Search your vault', 'aria-label': 'Search your vault', autocomplete: 'off',
    onInput: () => { state.query = search.value; drawSite(); drawList(); }
  });
  const banner = h('div', { class: 'banner', hidden: true });
  const siteSlot = h('div');
  const sectionTitle = h('span');
  const sectionCount = h('span');
  const list = h('div', { class: 'list' });

  const menuButton = h('button', {
    type: 'button', class: 'icon-btn', 'aria-label': 'Account', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    onClick: (event) => { event.stopPropagation(); toggleMenu(); }
  }, icon('user', 'w-[18px] h-[18px]'));
  const menu = h('div', { class: 'menu', role: 'menu', hidden: true },
    h('div', { class: 'who' }, session.email),
    h('button', { type: 'button', role: 'menuitem', onClick: lock }, icon('lock', 'w-4 h-4'), 'Lock'),
    h('button', { type: 'button', role: 'menuitem', onClick: signOut }, icon('log-out', 'w-4 h-4'), 'Sign out')
  );

  function toggleMenu(force) {
    menuOpen = force ?? !menuOpen;
    menu.hidden = !menuOpen;
    menuButton.setAttribute('aria-expanded', String(menuOpen));
  }

  async function lock() {
    await ask({ type: 'lock' }); // forgets the vault key; the popup then asks for the master password
    onLocked();
  }

  async function signOut() {
    await ask({ type: 'logout' });
    onSignedOut();
  }

  const home = h('div', { class: 'home' },
    h('div', { class: 'head' },
      h('div', { class: 'brand' }, logo(26), h('span', null, 'Pass', h('b', null, 'Drop'))),
      syncBox,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Password generator', onClick: () => generator.open() },
        icon('sparkles', 'w-[18px] h-[18px]')),
      menuButton
    ),
    menu,
    banner,
    h('div', { class: 'search' }, icon('search', 'w-4 h-4'), search),
    siteSlot,
    h('div', { class: 'section' }, sectionTitle, sectionCount),
    list
  );

  const matchesHere = () => (state.pageUrl ? entriesForPage(state.items, state.pageUrl) : []);

  function drawBanner() {
    banner.hidden = !state.offline;
    banner.replaceChildren(icon('wifi', 'w-3.5 h-3.5'), state.hasData
      ? "Can't reach PassDrop. Showing your saved copy."
      : "Can't reach PassDrop. Check your connection.");
  }

  function drawSite() {
    const here = state.query.trim() || !state.hasData ? [] : matchesHere();
    if (!here.length) return replaceChildren(siteSlot);
    const entry = here[Math.min(state.chosen, here.length - 1)];
    replaceChildren(siteSlot,
      h('div', { class: 'site' },
        here.length > 1 && h('div', { class: 'pills', role: 'group', 'aria-label': 'Logins for this site' },
          here.map((e, i) => h('button', {
            type: 'button', class: 'chip', 'aria-pressed': String(i === state.chosen),
            onClick: () => { state.chosen = i; drawSite(); }
          }, titleOf(e)))),
        h('div', { class: 'site-top' }, avatar(entry),
          h('div', { class: 't' }, h('strong', null, titleOf(entry)), h('span', null, `Saved for ${hostOf(state.pageUrl)}`))),
        plainField('Username', entry.username),
        secretField('Password', entry.password)
      )
    );
  }

  function row(entry) {
    return h('button', { type: 'button', class: 'row', onClick: () => showDetail(entry) },
      avatar(entry),
      h('span', { class: 't' },
        h('strong', null, titleOf(entry), entry.isFavorite && icon('star', 'w-3 h-3 star')),
        h('span', null, entry.username || 'No username')),
      icon('chevron-right', 'w-4 h-4 chev')
    );
  }

  function drawList() {
    const query = state.query.trim().toLowerCase();
    const here = query ? [] : matchesHere();
    const rest = state.items.filter((e) =>
      !here.includes(e) && (!query || [e.title, e.username, e.url].some((v) => (v || '').toLowerCase().includes(query))));

    sectionTitle.textContent = here.length && !query ? 'Everything else' : 'All logins';
    sectionCount.textContent = state.hasData ? String(rest.length) : '';

    if (state.loading) {
      return replaceChildren(list, h('div', { class: 'skeletons', 'aria-hidden': 'true' },
        [0, 1, 2].map((i) => h('div', { class: 'skeleton', style: `opacity:${1 - i * 0.25}` }))));
    }
    if (!state.hasData) {
      return replaceChildren(list, h('div', { class: 'empty' },
        h('strong', null, "Couldn't load your vault"), state.error,
        h('br'), h('button', { type: 'button', class: 'btn primary mt', onClick: () => { state.loading = true; drawList(); sync(); } }, 'Try again')));
    }
    if (!state.items.length) {
      return replaceChildren(list, h('div', { class: 'empty' },
        h('strong', null, 'Your vault is empty'), 'Add your first login in the PassDrop web app.',
        h('br'), h('a', { class: 'btn primary mt', href: WEB_APP_URL, target: '_blank', rel: 'noreferrer' }, 'Open PassDrop', icon('external-link', 'w-3.5 h-3.5'))));
    }
    if (!rest.length) {
      return replaceChildren(list, h('div', { class: 'empty' },
        h('strong', null, query ? 'No matches' : 'Nothing else here'),
        query ? `Nothing in your vault matches "${state.query.trim()}".` : 'This site has the only login you saved.'));
    }
    replaceChildren(list, ...rest.map(row));
  }

  function redraw() {
    drawBanner();
    drawSite();
    drawList();
    paintSync();
    if (state.view === 'detail') {
      const entry = state.items.find((e) => e._id === state.detailId);
      if (!entry) showHome(); // it was deleted in the web app
    }
  }

  // ---------------------------------------------------------------- detail
  function showDetail(entry) {
    state.view = 'detail';
    state.detailId = entry._id;
    toggleMenu(false);
    const href = openableUrl(entry.url);
    replaceChildren(root,
      h('div', { class: 'detail slide' },
        h('div', { class: 'head' },
          h('button', { type: 'button', class: 'back', onClick: showHome }, icon('chevron-left', 'w-[18px] h-[18px]'), titleOf(entry)),
          entry.isFavorite && h('span', { class: 'fav', title: 'Favourite' }, icon('star', 'w-4 h-4 star'))),
        h('div', { class: 'card' },
          h('div', { class: 'site-top' }, avatar(entry),
            h('div', { class: 't' }, h('strong', null, titleOf(entry)), h('span', null, hostOf(entry.url) || 'No website'))),
          plainField('Username', entry.username),
          secretField('Password', entry.password)),
        href && link(href, `Open ${hostOf(entry.url)}`, icon('external-link', 'w-4 h-4')),
        entry.notes && h('div', { class: 'meta' }, h('b', null, 'Notes'), h('p', null, entry.notes)),
        h('div', { class: 'foot' }, link(WEB_APP_URL, 'Edit in PassDrop', icon('external-link', 'w-4 h-4')))
      )
    );
    root.querySelector('.back').focus();
  }

  function showHome() {
    state.view = 'home';
    state.detailId = null;
    home.classList.add('slide');
    replaceChildren(root, home);
    search.value = state.query;
    redraw();
    setTimeout(() => home.classList.remove('slide'), 400);
  }

  // ---------------------------------------------------------------- keyboard and menus
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (generator.isOpen()) generator.close();
    else if (menuOpen) { toggleMenu(false); menuButton.focus(); }
    else if (state.view === 'detail') showHome();
  });
  document.addEventListener('click', (event) => {
    if (menuOpen && !menu.contains(event.target)) toggleMenu(false);
  });

  // ---------------------------------------------------------------- start
  (async () => {
    try {
      // the address of the tab the popup was opened on (activeTab lets us read it): that site's logins go first
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (/^https?:/.test(tab?.url || '')) state.pageUrl = tab.url;
    } catch {
      // no tab address: there is simply no "this site" card
    }

    // show what we already have at once, then bring it up to date
    const reply = await ask({ type: 'vault' });
    if (reply.ok) {
      adopt(reply);
      redraw();
    } else if (reply.code === 'auth') {
      onExpired();
      return;
    } else if (reply.code === 'locked') {
      onLocked();
      return;
    } else {
      state.loading = false;
      state.offline = true;
      state.error = reply.error;
      redraw();
    }
    sync();
  })();

  timers.push(setInterval(paintSync, 1000), setInterval(sync, RESYNC_EVERY_MS));

  showHome();
  return root;
}
