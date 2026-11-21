import { describe, expect, it } from 'vitest';
import { CHECKING_CAP, KEY_STEP, POOL_MAX, TYPING_CAP, frostMask, patchRadius, poolLevel, warm } from './frost';

const size = { w: 1000, h: 800 }, center = { x: 500, y: 400 };

describe('warm', () => {
    it('each key opens the frost a little more, up to the typing cap', () => {
        expect(warm(0, 1)).toBeCloseTo(KEY_STEP);
        expect(warm(0, 3)).toBeCloseTo(3 * KEY_STEP);
        expect(warm(0, 100)).toBe(TYPING_CAP);
    });

    it('never goes backwards: no keys, deleted keys or a lower cap leave the target where it was', () => {
        expect(warm(0.3, 0)).toBe(0.3);
        expect(warm(0.3, -5)).toBe(0.3);
        expect(warm(CHECKING_CAP, 4)).toBe(CHECKING_CAP); // typing again after the check never pulls it below the check's level
    });
});

describe('poolLevel', () => {
    it('starts at nothing, climbs with the frost target in small steps, and stops at the cap', () => {
        expect(poolLevel(0)).toBe(0);
        expect(poolLevel(KEY_STEP)).toBeGreaterThan(0);
        expect(poolLevel(KEY_STEP)).toBeLessThan(POOL_MAX / 4);
        expect(poolLevel(2 * KEY_STEP)).toBeGreaterThan(poolLevel(KEY_STEP));
        expect(poolLevel(TYPING_CAP)).toBe(POOL_MAX);
        expect(poolLevel(CHECKING_CAP)).toBe(POOL_MAX);
    });
});

describe('frostMask', () => {
    it('is solid frost at 0 and fully clear from 1', () => {
        expect(frostMask(0, center, size)).toContain('transparent 0px, #000 0px');
        expect(frostMask(1, center, size)).toBe('linear-gradient(transparent, transparent)');
        expect(frostMask(1.02, center, size)).toBe('linear-gradient(transparent, transparent)');
    });

    it('opens a patch around the given point that widens with progress', () => {
        expect(frostMask(0.5, center, size)).toContain('circle at 500px 400px');
        expect(patchRadius(0.6, center, size)).toBeGreaterThan(patchRadius(0.3, center, size));
        expect(patchRadius(1, center, size)).toBeGreaterThan(Math.hypot(500, 400)); // reaches the corners
    });
});
