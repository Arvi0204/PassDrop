import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { duration, ease } from '../../lib/motion';

/**
 * Crossfades between two icons (for example eye / eye-off) with a small scale,
 * instead of snapping from one to the other.
 */
export default function IconSwap({ swapped, from: From, to: To, className = 'w-4 h-4' }) {
    const Icon = swapped ? To : From;

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={swapped ? 'to' : 'from'}
                className="inline-flex"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: duration.fast, ease: ease.out }}
            >
                <Icon className={className} />
            </motion.span>
        </AnimatePresence>
    );
}
