// Tiny helpers for building the popup's DOM. Text always goes in as text, never as HTML, so
// nothing from the vault can ever turn into markup.

/**
 * h('button', { class: 'p-2', onClick: fn, 'aria-label': 'x' }, 'Label', otherNode)
 * Props: `class`, `on<Event>` handlers, `value`/`disabled`/`checked`/`type` set as properties,
 * everything else as an attribute. `false`, null and undefined props and children are skipped.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (['value', 'disabled', 'checked', 'type'].includes(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }

  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Replaces everything inside `parent`. */
export function replaceChildren(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}

/** Says something to screen readers without showing it. */
export function announce(text) {
  const region = document.getElementById('announce');
  if (!region) return;
  region.textContent = '';
  // a short delay makes the same message read out again if it is repeated
  setTimeout(() => (region.textContent = text), 30);
}
