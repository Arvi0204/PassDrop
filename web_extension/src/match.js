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
 * True when the saved address is the page's host, or a parent of it ("example.com" matches
 * "login.example.com"). "example.com" does not match "example.com.evil.com" or "notexample.com".
 */
export function matchesHost(savedAddress, pageHost) {
  const saved = hostOf(savedAddress);
  const page = hostOf(pageHost);
  if (!saved || !page) return false;
  return page === saved || page.endsWith(`.${saved}`);
}

/** Entries from the vault that belong to the page at `pageUrl`. */
export function entriesForPage(vault, pageUrl) {
  const pageHost = hostOf(pageUrl);
  if (!pageHost) return [];
  return vault.filter((entry) => matchesHost(entry.url, pageHost));
}
