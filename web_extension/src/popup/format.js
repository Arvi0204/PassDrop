// Small pure helpers for showing vault entries.
import { hostOf } from '../match.js';

/**
 * Where to get the icon of a saved site: the same favicon service the web app uses. The browser keeps each
 * icon for a week (about half a kilobyte each), so this is one small download per site, not one per view.
 * The service is told the site's name. Names without a dot (intranet hosts such as "jira") and IP
 * addresses are never sent: they have no public icon and are nobody else's business. Returns '' for those.
 */
export function siteIconUrl(address) {
  const host = hostOf(address);
  if (!host.includes('.') || /^[\d.]+$/.test(host)) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

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
