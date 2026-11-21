// The frozen vault's frost. A clear patch opens around the password field and grows with every key; it never shrinks
// (clearing the field or a wrong password takes nothing back). Progress 0 is all frost, 1 is all clear.

export const KEY_STEP = 0.075;
export const TYPING_CAP = 0.66; // typing alone never clears more than this; the rest happens on unlock
export const CHECKING_CAP = 0.78; // while the password is being checked the patch opens a little further

// the next target after `keys` more characters; never lower than the current one
export const warm = (target, keys, cap = TYPING_CAP) => Math.max(target, Math.min(cap, target + Math.max(0, keys) * KEY_STEP));

// the radius that just reaches the far corner of the screen, with a little spare
const fullRadius = (center, size) => Math.hypot(Math.max(center.x, size.w - center.x), Math.max(center.y, size.h - center.y)) + 60;

// how far the clear patch reaches, in pixels
export const patchRadius = (progress, center, size) => Math.max(0, Math.min(1, progress)) * fullRadius(center, size);

// A CSS mask: frost everywhere except a soft-edged patch around `center` (in pixels, on a screen of `size`).
export function frostMask(progress, center, size) {
    if (progress >= 1) return 'linear-gradient(transparent, transparent)'; // fully clear
    const p = Math.max(0, progress), r = patchRadius(p, center, size), soft = 70 + 50 * p;
    return `radial-gradient(circle at ${center.x}px ${center.y}px, transparent ${Math.max(0, r - soft)}px, #000 ${r}px)`;
}
