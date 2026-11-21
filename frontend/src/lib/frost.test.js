import { describe, expect, it } from 'vitest';
import { CHECKING_CAP, KEY_STEP, TYPING_CAP, frostMask, patchRadius, warm } from './frost';

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
