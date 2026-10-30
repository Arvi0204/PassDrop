// Shared motion tokens so every animation in the app feels like it belongs to the same family.
// Used with framer-motion; reduced motion is handled globally by <MotionConfig reducedMotion="user">.

export const duration = {
    fast: 0.12,
    base: 0.2,
    slow: 0.35
};

export const ease = {
    // decelerating, for things arriving on screen
    out: [0.22, 1, 0.36, 1],
    // symmetric, for things moving from A to B
    inOut: [0.65, 0, 0.25, 1]
};

export const spring = {
    // gentle settle: list items finding their new place
    soft: { type: 'spring', stiffness: 380, damping: 34 },
    // quick and tight: small controls, selection indicator
    snappy: { type: 'spring', stiffness: 520, damping: 38 }
};

export const variants = {
    // an account row appearing or leaving the vault list
    listItem: {
        hidden: { opacity: 0, scale: 0.96, y: -6 },
        visible: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96 }
    },

    // the detail pane swapping between accounts
    pane: {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 }
    },

    // empty states and other one-off blocks
    fadeUp: {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 }
    }
};
