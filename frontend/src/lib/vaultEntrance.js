// Entrance animation for the vault after login / signup: "Surfacing".
//
//  - Elements marked [data-entrance] sharpen out of a blur, staggered by their distance from the
//    top-centre of the screen (so any layout, desktop grid or phone column, gets a natural wave).
//  - One soft light sweep and a tiny haptic tap mark the moment it settles.
//
// Played after sign-in and sign-up only. Unlocking a frozen vault has its own frost animation (components/FrozenVault).
//
// Only elements inside the current screen animate; anything off-screen just appears.

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isOnScreen = (el) => {
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

/**
 * Plays the entrance inside `root`. Returns a cancel function that restores everything.
 * `root` is expected to carry the `entrance-pending` class (hides targets until play starts).
 */
export function playVaultEntrance(root, { onDone } = {}) {
    if (!root) return () => {};

    const timers = [];
    const animations = [];
    let glint = null;
    let finished = false;

    const later = (fn, ms) => {
        const t = setTimeout(fn, ms);
        timers.push(t);
        return t;
    };

    const cancel = () => {
        timers.forEach((t) => clearTimeout(t));
        animations.forEach((a) => a.cancel());
        glint?.remove();
        root.classList.remove('entrance-pending');
    };

    const complete = () => {
        if (finished) return;
        finished = true;
        // keeping `fill: both` forever would leave filter/transform on every card
        animations.forEach((a) => a.cancel());
        glint?.remove();
        onDone?.();
    };

    const targets = [...root.querySelectorAll('[data-entrance]')];
    const visible = targets.filter(isOnScreen);

    // Reduced motion: a quick plain fade, no blur.
    if (prefersReducedMotion()) {
        visible.forEach((el) => {
            animations.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' }));
        });
        root.classList.remove('entrance-pending');
        later(complete, 220);
        return cancel;
    }

    const originX = window.innerWidth / 2;
    let last = 0;

    visible.forEach((el) => {
        const r = el.getBoundingClientRect();
        const dist = Math.hypot(r.left + r.width / 2 - originX, (r.top + r.height / 2) * 1.35);
        const delay = 140 + dist * 0.36;
        const duration = 700;
        last = Math.max(last, delay + duration);

        animations.push(
            el.animate(
                [
                    { opacity: 0, filter: 'blur(12px)', transform: 'translateY(16px) scale(0.96)' },
                    { opacity: 1, filter: 'blur(0)', transform: 'none' }
                ],
                { duration, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
            )
        );
    });

    // Animations now exist (fill: both holds the hidden state), so the pending class can go.
    root.classList.remove('entrance-pending');

    // One soft light sweep + haptic tap once the cards have settled.
    later(() => {
        glint = document.createElement('div');
        glint.setAttribute('aria-hidden', 'true');
        Object.assign(glint.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '40',
            pointerEvents: 'none',
            opacity: '0',
            background: 'linear-gradient(115deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%)',
            backgroundSize: '250% 100%'
        });
        document.body.appendChild(glint);
        glint.animate(
            [
                { opacity: 0, backgroundPosition: '120% 0' },
                { opacity: 0.7, offset: 0.35 },
                { opacity: 0, backgroundPosition: '-20% 0' }
            ],
            { duration: 900, easing: 'ease-in-out' }
        );
        // browsers block vibrate() until the user has interacted with the page
        if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(10);
    }, Math.max(0, last - 300));

    later(complete, last + 950);

    return cancel;
}
