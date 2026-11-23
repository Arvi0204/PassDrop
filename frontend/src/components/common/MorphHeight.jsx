import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/** Eases to the height of what it holds, so a card or dialog grows or shrinks when its content is replaced instead of jumping. */
export default function MorphHeight({ animated = true, innerClassName = '', children }) {
    const innerRef = useRef(null);
    const [height, setHeight] = useState(null);
    useLayoutEffect(() => {
        const el = innerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
        observer.observe(el);
        setHeight(el.offsetHeight);
        return () => observer.disconnect();
    }, []);
    return (
        <motion.div
            initial={false}
            animate={height === null ? {} : { height }}
            transition={{ duration: animated ? 0.55 : 0, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden -m-1"
        >
            <div ref={innerRef} className={`p-1 ${innerClassName}`}>{children}</div>
        </motion.div>
    );
}
