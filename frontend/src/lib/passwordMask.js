// The dots drawn over a hidden password. They follow the password's length in steps of 4, from 8 to 24 dots,
// so a short password looks short and a long one looks long without giving away the exact length.
// Plain logic, so the web app and the browser extension draw the same mask.

const STEP = 4;
const MIN_DOTS = 8;
const MAX_DOTS = 24;

export const maskLength = (length) => Math.min(MAX_DOTS, Math.max(MIN_DOTS, Math.ceil(length / STEP) * STEP));

export const maskFor = (password) => '•'.repeat(maskLength(password?.length ?? 0));
