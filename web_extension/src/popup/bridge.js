// The popup's only way to the rest of the extension: a message to the service worker.
// It always answers with { ok: true, ... } or { ok: false, code, error }, never throws.

export async function ask(message) {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    if (reply) return reply;
  } catch {
    // fall through to the message below
  }
  return { ok: false, code: 'network', error: 'PassDrop is not responding. Try reloading the extension.' };
}
