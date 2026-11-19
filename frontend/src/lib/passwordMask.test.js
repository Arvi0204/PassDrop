import { describe, expect, it } from 'vitest';
import { maskFor, maskLength } from './passwordMask';

describe('the hidden password mask', () => {
    it('follows the length in steps of 4, from 8 to 24 dots', () => {
        const steps = [[0, 8], [1, 8], [8, 8], [9, 12], [12, 12], [13, 16], [16, 16], [17, 20], [20, 20], [21, 24], [24, 24], [44, 24], [500, 24]];
        for (const [length, dots] of steps) expect(maskLength(length), `${length} characters`).toBe(dots);
    });

    it('is only dots, and two nearby lengths look the same', () => {
        expect(maskFor('hunter22')).toMatch(/^•+$/);
        expect(maskFor('x'.repeat(13))).toBe(maskFor('x'.repeat(16)));
        expect(maskFor('x'.repeat(8))).not.toBe(maskFor('x'.repeat(30)));
    });

    it('copes with a missing password', () => {
        expect(maskFor(undefined)).toHaveLength(8);
        expect(maskFor(null)).toHaveLength(8);
    });
});
