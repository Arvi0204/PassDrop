// Fills a saved login into the page when the page has a login form and PassDrop has a login for it.
// The page is only asked about when it has a password field, and the service worker decides which
// saved logins belong to this page: this script never sees the rest of the vault.

(async () => {
  const userField = document.querySelector('input[type="text"], input[type="email"]');
  const passField = document.querySelector('input[type="password"]');
  if (!userField || !passField) return;

  let reply;
  try {
    reply = await chrome.runtime.sendMessage({ type: 'matches' });
  } catch {
    return; // the extension was reloaded or the worker is unavailable
  }
  if (!reply?.ok || !reply.entries?.length) return;

  const [entry] = reply.entries;
  userField.value = entry.username;
  passField.value = entry.password;
})();
