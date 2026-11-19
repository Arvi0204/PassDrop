import { motion } from 'framer-motion';
import { variants, duration, ease } from '../../lib/motion';

const STAGGER = 0.07;

/**
 * Fades a block up into place. Give blocks on one page rising `index` values and they arrive one
 * after another. With `inView` the block waits until it scrolls into view (for content below the
 * fold). Reduced motion is handled globally by <MotionConfig reducedMotion="user">.
 */
export default function Reveal({ index = 0, inView = false, className, children }) {
    const trigger = inView
        ? { whileInView: 'visible', viewport: { once: true, margin: '-40px' } }
        : { animate: 'visible' };

    return (
        <motion.div
            className={className}
            variants={variants.fadeUp}
            initial="hidden"
            {...trigger}
            transition={{ duration: duration.slow, ease: ease.out, delay: index * STAGGER }}
        >
            {children}
        </motion.div>
    );
}
