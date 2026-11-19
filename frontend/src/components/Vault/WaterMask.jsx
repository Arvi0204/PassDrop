import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { maskFor } from '../../lib/passwordMask';
import '../../styles/water.css';

// Drain: a gentle start, a steady fall, then it slows as the last water leaves.
const DRAIN = { duration: 0.6, ease: [0.25, 0.25, 0.5, 0.9] };
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
 * The water is opaque, so the real text is never visible until the surface has passed it. The dots on it
 * follow the length of `password` in steps (see passwordMask), so they never give the exact length away.
 */
export default function WaterMask({ revealed, password }) {
    const transition = revealed ? DRAIN : FILL;
    return (
        <div className="pw-water" aria-hidden="true">
            <motion.div
                className="pw-sheet"
                initial={false}
                animate={{ y: revealed ? '100%' : '0%' }}
                transition={transition}
            >
                <div className="pw-surf">
                    <i />
                    <i className="pw-surf-back" />
                </div>
                <div className="pw-body">
                    {/* the dots move up by exactly what the water moves down, so they stay put and the
                        falling surface uncovers them instead of carrying them along like a slide */}
                    <motion.div
                        className="pw-dots font-mono text-sm tracking-wider"
                        initial={false}
                        animate={{ y: revealed ? '-100%' : '0%' }}
                        transition={transition}
                    >
                        {maskFor(password)}
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
