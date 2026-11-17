// Deciding which saved logins belong to the page you are on.

/**
 * The host of a saved address, lowercased and without a leading "www.". Saved addresses are typed
 * by people, so "github.com", "https://github.com/login" and "GitHub.com" all have to work.
 * Returns '' when there is nothing usable.
 */
export function hostOf(address) {
  if (!address || typeof address !== 'string') return '';
  const text = address.trim();
  if (!text) return '';

  // an address that already has a scheme is read as it is; otherwise it is "github.com/login" typed without one
  const candidate = text.includes('://') ? text : `https://${text}`;
  try {
    const { hostname } = new URL(candidate);
    return hostname ? hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

/**
 * True when the saved address is exactly the page's host (apart from a leading "www."). Subdomains
 * do not match: a login saved for "example.com" is not offered on "evil.example.com", because anyone
 * can be given a subdomain of a shared site. Ports are ignored.
 */
export function matchesHost(savedAddress, pageHost) {
  const saved = hostOf(savedAddress);
  return saved !== '' && saved === hostOf(pageHost);
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
  const pageHost = hostOf(pageUrl);
  return vault.filter((entry) => matchesHost(entry.url, pageHost));
}
