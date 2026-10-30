// Password generation shared by the Generator and the edit dialog.

export const CHARACTER_SETS = {
    letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    specialChars: '!@#$%^&*()_+[]{}|;:,.<>?'
};

export const LENGTH_RANGE = { min: 6, max: 40 };

export const DEFAULT_OPTIONS = { length: 16, includeNumbers: true, includeSpecialChars: true };

const secureRandomChar = (str) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return str.charAt(array[0] % str.length);
};

const secureRandomInt = (max) => {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
};

/** Builds a password from `{ length, includeNumbers, includeSpecialChars }`. */
export function generatePassword({ length, includeNumbers, includeSpecialChars }) {
    let charset = CHARACTER_SETS.letters;
    const requiredChars = [];

    if (includeNumbers) {
        charset += CHARACTER_SETS.numbers;
        requiredChars.push(secureRandomChar(CHARACTER_SETS.numbers));
    }

    if (includeSpecialChars) {
        charset += CHARACTER_SETS.specialChars;
        requiredChars.push(secureRandomChar(CHARACTER_SETS.specialChars));
    }

    const effectiveLength = Math.max(requiredChars.length, length || 8);
    const fillLength = Math.max(0, effectiveLength - requiredChars.length);

    let password = Array.from({ length: fillLength }, () => secureRandomChar(charset)).join('');

    requiredChars.forEach((char) => {
        const randomIndex = secureRandomInt(password.length + 1);
        password = password.slice(0, randomIndex) + char + password.slice(randomIndex);
    });

    return password;
}
