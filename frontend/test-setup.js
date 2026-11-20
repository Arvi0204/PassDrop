// Runs before every web app test file.
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const inBrowser = typeof window !== 'undefined'; // a few files (the crypto module) run in plain Node instead

// newer Node versions define their own localStorage global that is empty unless a file is configured, which hides
// jsdom's; fall back to a small in-memory one that behaves like the browser's
if (inBrowser && !globalThis.localStorage) {
    const data = new Map();
    const memory = {
        getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
        setItem: (k, v) => void data.set(String(k), String(v)),
        removeItem: (k) => void data.delete(String(k)),
        clear: () => data.clear(),
        key: (i) => [...data.keys()][i] ?? null,
        get length() { return data.size; }
    };
    Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
    Object.defineProperty(window, 'localStorage', { value: memory, configurable: true });
}

// take the rendered components off the page between tests
afterEach(() => {
    if (inBrowser) {
        cleanup();
        sessionStorage.clear();
        localStorage.clear();
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

// jsdom has no layout engine; these are the browser features the animation library asks about
if (inBrowser) {
    globalThis.IntersectionObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    window.matchMedia ??= (query) => ({
        matches: false, media: query, onchange: null,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false
    });
    Element.prototype.scrollIntoView ??= () => {};
}
