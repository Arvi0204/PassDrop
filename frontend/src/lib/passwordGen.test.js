import { describe, expect, it } from 'vitest';
import { CHARACTER_SETS, DEFAULT_OPTIONS, LENGTH_RANGE, generatePassword } from './passwordGen';

const onlyFrom = (text, set) => [...text].every((character) => set.includes(character));

describe('the password generator', () => {
    it('makes a password of the length asked for', () => {
        for (const length of [LENGTH_RANGE.min, 16, LENGTH_RANGE.max]) {
            expect(generatePassword({ ...DEFAULT_OPTIONS, length })).toHaveLength(length);
        }
    });

    it('with numbers and symbols on, always includes at least one of each', () => {
        for (let i = 0; i < 200; i++) {
            const password = generatePassword({ length: 8, includeNumbers: true, includeSpecialChars: true });
            expect(password).toMatch(/[0-9]/);
            expect(password).toMatch(/[!@#$%^&*()_+[\]{}|;:,.<>?]/);
        }
    });

    it('with both off, uses letters only', () => {
        for (let i = 0; i < 50; i++) {
            expect(onlyFrom(generatePassword({ length: 20, includeNumbers: false, includeSpecialChars: false }), CHARACTER_SETS.letters)).toBe(true);
        }
    });

    it('with only numbers on, has no symbols', () => {
        for (let i = 0; i < 50; i++) {
            expect(onlyFrom(generatePassword({ length: 20, includeNumbers: true, includeSpecialChars: false }), CHARACTER_SETS.letters + CHARACTER_SETS.numbers)).toBe(true);
        }
    });

    it('does not repeat itself', () => {
        const seen = new Set(Array.from({ length: 100 }, () => generatePassword(DEFAULT_OPTIONS)));
        expect(seen.size).toBe(100);
    });

    it('falls back to 8 characters when no length is given', () => {
        expect(generatePassword({ includeNumbers: false, includeSpecialChars: false })).toHaveLength(8);
    });
});
