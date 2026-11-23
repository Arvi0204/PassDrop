import { useLayoutEffect, useRef } from 'react';

/**
 * A piece of a view that arrives with the ripple: it appears when the wave from the landing point (`from`, in viewport pixels)
 * would reach it, so the nearest things come first. The delay goes in a CSS variable that its children can use too (the settling
 * logo). Without `from` (no animation played) it is just its content. The CSS is in index.css.
 */
export default function Arrive({ from, as: Tag = 'div', className = '', children, ...rest }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        if (!from || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const distance = Math.hypot(r.left + r.width / 2 - from.x, r.top + r.height / 2 - from.y);
        ref.current.style.setProperty('--arrive-delay', `${Math.min(0.8, 0.08 + distance / 520).toFixed(2)}s`);
    }, [from]);
    return <Tag ref={ref} className={`${from ? 'arrive' : ''} ${className}`} {...rest}>{children}</Tag>;
}
