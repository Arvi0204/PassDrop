// Runs before every web app test file.
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// take the rendered components off the page between tests
afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

// jsdom has no layout engine; these are the browser features the animation library asks about
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
