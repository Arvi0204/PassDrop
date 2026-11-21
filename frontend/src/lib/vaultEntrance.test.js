import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playVaultEntrance } from './vaultEntrance';

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    Element.prototype.animate = () => ({ cancel() {} });
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete Element.prototype.animate;
    document.body.replaceChildren();
});

// the light sweep is the only fixed full-screen element the entrance adds to the body
const sweeps = () => [...document.body.children].filter((el) => el.style.position === 'fixed');

describe('playVaultEntrance', () => {
    it('plays the light sweep after the cards settle, then removes it', () => {
        const onDone = vi.fn();
        playVaultEntrance(document.createElement('div'), { onDone });
        vi.advanceTimersByTime(300);
        expect(sweeps()).toHaveLength(1);
        vi.advanceTimersByTime(2000);
        expect(sweeps()).toHaveLength(0);
        expect(onDone).toHaveBeenCalled();
    });

    it('plays no light sweep when told not to (unlocking), but still finishes', () => {
        const onDone = vi.fn();
        playVaultEntrance(document.createElement('div'), { onDone, sweep: false });
        vi.advanceTimersByTime(2000);
        expect(sweeps()).toHaveLength(0);
        expect(onDone).toHaveBeenCalled();
    });
});
