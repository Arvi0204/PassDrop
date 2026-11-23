import { describe, expect, it } from 'vitest';
import { countdown, formatLeft } from './serverClock';

// clocks we can move by hand
const clocks = () => { const c = { perf: 1000, wall: 5_000_000 }; return { c, opts: { perf: () => c.perf, wall: () => c.wall } }; };

describe('countdown', () => {
    const serverNow = '2026-01-01T12:00:00Z', expiresAt = '2026-01-01T12:10:00Z'; // 600 s left, on the server's clock

    it('starts from the server\'s time, whatever the visitor\'s clock says', () => {
        const { c, opts } = clocks();
        c.wall = 99; // a visitor whose clock is nowhere near the server's
        expect(countdown(expiresAt, serverNow, opts)()).toBe(600);
    });

    it('counts down with the page\'s own stopwatch', () => {
        const { c, opts } = clocks();
        const left = countdown(expiresAt, serverNow, opts);
        c.perf += 90_000; c.wall += 90_000;
        expect(left()).toBe(510);
    });

    it('still counts the time a sleeping laptop lost: the system clock moved on although the stopwatch did not', () => {
        const { c, opts } = clocks();
        const left = countdown(expiresAt, serverNow, opts);
        c.wall += 700_000; // asleep for 700 s
        expect(left()).toBe(0);
    });

    it('gains nothing from the system clock being set back', () => {
        const { c, opts } = clocks();
        const left = countdown(expiresAt, serverNow, opts);
        c.perf += 100_000; c.wall -= 3_600_000;
        expect(left()).toBe(500);
    });

    it('never goes below zero', () => {
        const { c, opts } = clocks();
        const left = countdown(expiresAt, serverNow, opts);
        c.perf += 9_999_999;
        expect(left()).toBe(0);
    });
});

describe('formatLeft', () => {
    it('writes the time left, and never "0 min"', () => {
        expect(formatLeft(3 * 3600 + 20 * 60)).toBe('3 h 20 min');
        expect(formatLeft(2 * 3600)).toBe('2 h');
        expect(formatLeft(42 * 60 + 10)).toBe('43 min');
        expect(formatLeft(3599)).toBe('1 h'); // not "60 min"
        expect(formatLeft(6 * 60 + 5)).toBe('6 min 05 s');
        expect(formatLeft(59)).toBe('59 s');
        expect(formatLeft(0.2)).toBe('1 s');
    });
});
