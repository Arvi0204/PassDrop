// Small pure helpers for showing vault entries.
import { hostOf } from '../match.js';
import { iconUrlForHost } from './shared.js';

/** Where to get the icon of a saved site, or '' when it has no public one (the rule is shared with the web app). */
export const siteIconUrl = (address) => iconUrlForHost(hostOf(address));

/** What to call an entry: its title, else its site, else its username. */
export const titleOf = (entry) => entry.title || hostOf(entry.url) || entry.username || 'Untitled';

/** "just now", "42s ago", "3m ago", "2h ago". */
export function timeAgo(then, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/** A saved address as a link that is safe to open (http or https only), or '' if it is not one. */
export function openableUrl(address) {
  if (!address || typeof address !== 'string') return '';
  const text = address.trim();
  if (!text) return '';
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/** A stable number from a name, to give each entry its own avatar colour. */
export function colourIndex(name, count) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % count;
}
