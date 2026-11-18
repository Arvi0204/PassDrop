// Deciding which saved logins belong to the page you are on.

// An address that starts with a scheme ("https://...") is read as it is; anything else is "github.com/login"
// typed without one. Checking only the start matters: "example.com/go?to=https://x" has no scheme.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

function parse(address) {
  if (!address || typeof address !== 'string') return null;
  const text = address.trim();
  if (!text) return null;
  try {
    const url = new URL(HAS_SCHEME.test(text) ? text : `https://${text}`);
    return url.hostname ? url : null;
  } catch {
    return null;
  }
}

/**
 * The host of a saved address, lowercased and without a leading "www.". Saved addresses are typed
 * by people, so "github.com", "https://github.com/login" and "GitHub.com" all have to work.
 * Returns '' when there is nothing usable.
 */
export function hostOf(address) {
  const url = parse(address);
  return url ? url.hostname.toLowerCase().replace(/^www\./, '') : '';
}

/**
 * The site an address points at: its host, plus the port when one is written. The scheme is ignored, so
 * a login saved long ago as "http://example.com" still belongs to "https://example.com". Returns ''
 * when there is nothing usable.
 */
export function siteOf(address) {
  const host = hostOf(address);
  const { port } = parse(address) ?? {}; // empty for a default port, as URL drops 443 and 80
  return host && port ? `${host}:${port}` : host;
}

/**
 * True when the saved address is exactly the page's site: the same host (apart from a leading "www.")
 * and the same port. Subdomains do not match: a login saved for "example.com" is not offered on
 * "evil.example.com", because anyone can be given a subdomain of a shared site. A different port is a
 * different service, so "example.com" is not offered on "example.com:8443", and a login saved for
 * "localhost:5173" is not offered to another app on "localhost:3000".
 */
export function matchesSite(savedAddress, pageAddress) {
  const saved = siteOf(savedAddress);
  return saved !== '' && saved === siteOf(pageAddress);
}

const THIS_COMPUTER = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Pages a password may go to: https, or plain http on this computer (for developing). */
export function isFillablePage(pageUrl) {
  try {
    const { protocol, hostname } = new URL(pageUrl);
    return protocol === 'https:' || (protocol === 'http:' && THIS_COMPUTER.has(hostname));
  } catch {
    return false;
  }
}

/** Entries from the vault that belong to the page at `pageUrl`. */
export function entriesForPage(vault, pageUrl) {
  if (!isFillablePage(pageUrl)) return [];
  return vault.filter((entry) => matchesSite(entry.url, pageUrl));
}
