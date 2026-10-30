import { useAnimationControls, AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import React from 'react';
import { duration, ease } from '../../lib/motion';

/**
 * A sideways shake for a field that needs the user's attention. Put `controls` on a motion
 * element (`animate={controls}`) and call `shake()` when the problem is found.
 */
export function useShake() {
    const controls = useAnimationControls();
    const shake = () => controls.start({ x: [0, -8, 8, -6, 6, -3, 0], transition: { duration: 0.4 } });
    return { controls, shake };
}

/** An error message that slides in under a field and slides away when cleared. */
export function ErrorLine({ children }) {
    return (
        <AnimatePresence initial={false}>
            {children && (
                <motion.p
                    key="error"
                    role="alert"
                    className="overflow-hidden flex items-center gap-1.5 text-xs font-semibold text-rose-500"
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: duration.base, ease: ease.out }}
                >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{children}</span>
                </motion.p>
            )}
        </AnimatePresence>
    );
}
