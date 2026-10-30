import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import '../../styles/water.css';

const DOTS = '•'.repeat(16); // always 16, so a hidden field never gives away the password length

// Drain: fast first, then easing out (the same curve as the logout drain).
const DRAIN = { duration: 0.3, ease: [0.2, 0.6, 0.55, 0.88] };
const FILL = { duration: 0.34, ease: [0.25, 0.8, 0.35, 1] };

/**
 * Keeps something mounted while `active`, and for `lingerMs` after it turns off, so an exit
 * animation can finish before the thing is removed.
 */
export function useLingering(active, lingerMs) {
    const [mounted, setMounted] = useState(active);

    useEffect(() => {
        if (active) {
            setMounted(true);
            return undefined;
        }
        const timer = setTimeout(() => setMounted(false), lingerMs);
        return () => clearTimeout(timer);
    }, [active, lingerMs]);

    return active || mounted;
}

/**
 * Water over a password field. Place it inside a `relative overflow-hidden` row; it covers the
 * row while the password is hidden, and drains away to uncover it when `revealed` turns true.
 * The water is opaque, so the real text is never visible until the surface has passed it.
 */
export default function WaterMask({ revealed }) {
    return (
        <div className="pw-water" aria-hidden="true">
            <motion.div
                className="pw-sheet"
                initial={false}
                animate={{ y: revealed ? '100%' : '0%' }}
                transition={revealed ? DRAIN : FILL}
            >
                <div className="pw-surf">
                    <i />
                    <i className="pw-surf-back" />
                </div>
                <div className="pw-body font-mono text-sm tracking-wider">{DOTS}</div>
            </motion.div>
        </div>
    );
}
