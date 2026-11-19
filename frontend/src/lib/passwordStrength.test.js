import { describe, expect, it } from 'vitest';
import { strengthOf } from './passwordStrength';

describe('password strength', () => {
    it('says Empty for nothing', () => {
        expect(strengthOf('')).toEqual({ score: 0, label: 'Empty' });
        expect(strengthOf(undefined)).toEqual({ score: 0, label: 'Empty' });
    });

    it('calls anything under 8 characters too short, however mixed', () => {
        expect(strengthOf('aB3$xyz')).toEqual({ score: 1, label: 'Weak (Too Short)' });
    });

    it('scores longer and more varied passwords higher', () => {
        expect(strengthOf('abcdefgh').label).toBe('Weak');
        expect(strengthOf('abcdefgh1').label).toBe('Weak');
        expect(strengthOf('Abcdefgh1').label).toBe('Good');
        expect(strengthOf('Abcdefgh1!').label).toBe('Good');
        expect(strengthOf('Abcdefghijklm1!x')).toEqual({ score: 4, label: 'Strong' });
    });

    it('rewards length: 14 characters of one kind beat 8 of one kind', () => {
        expect(strengthOf('abcdefghijklmn').score).toBeGreaterThanOrEqual(strengthOf('abcdefgh').score);
    });
});
