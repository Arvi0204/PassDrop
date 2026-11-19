import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { duration, ease } from '../../lib/motion';

const swap = {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.6 },
    transition: { duration: duration.fast, ease: ease.out }
};

/**
 * An icon that turns into a green check once its action has happened, fading and scaling
 * instead of snapping. This is the visual confirmation for a copy, so it replaces the toast.
 */
export default function CopyIcon({ copied, icon: Icon, className = 'w-4 h-4' }) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            {copied ? (
                <motion.span key="done" className="inline-flex" {...swap}>
                    <Check className={`${className} text-emerald-600`} />
                </motion.span>
            ) : (
                <motion.span key="icon" className="inline-flex" {...swap}>
                    <Icon className={className} />
                </motion.span>
            )}
        </AnimatePresence>
    );
}
