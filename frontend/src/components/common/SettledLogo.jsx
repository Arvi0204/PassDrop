import React from 'react';
import { DROP_PATHS, LOGO_COLORS } from '../../lib/logo';

/**
 * The flat logo, arriving: its two drops land one after the other, lit like water, and the shine fades until only the
 * real mark is left (the CSS is in index.css). Shown when a share link has been made. With reduced motion it is just the logo.
 */
export default function SettledLogo({ size = 32 }) {
    const id = React.useId().replace(/:/g, '');
    return (
        <svg width={size} height={size} viewBox="0 0 60 60" fill="none" aria-hidden="true" className="settled-logo shrink-0">
            <defs>
                <linearGradient id={`${id}-g1`} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor={LOGO_COLORS.primary[0]} />
                    <stop offset="1" stopColor={LOGO_COLORS.primary[1]} />
                </linearGradient>
                <linearGradient id={`${id}-g2`} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor={LOGO_COLORS.secondary[0]} />
                    <stop offset="1" stopColor={LOGO_COLORS.secondary[1]} />
                </linearGradient>
                <clipPath id={`${id}-c1`}><path d={DROP_PATHS.primary} /></clipPath>
                <clipPath id={`${id}-c2`}><path d={DROP_PATHS.secondary} /></clipPath>
            </defs>
            <g className="settled-d1">
                <path d={DROP_PATHS.primary} fill={`url(#${id}-g1)`} />
                <g clipPath={`url(#${id}-c1)`}><ellipse className="settled-gloss" cx="15" cy="22" rx="4.5" ry="9" transform="rotate(-28 15 22)" fill="#fff" /></g>
            </g>
            <g className="settled-d2" opacity="0.92">
                <path d={DROP_PATHS.secondary} fill={`url(#${id}-g2)`} />
                <g clipPath={`url(#${id}-c2)`}><ellipse className="settled-gloss" cx="34" cy="34" rx="4" ry="8" transform="rotate(-28 34 34)" fill="#fff" /></g>
            </g>
        </svg>
    );
}
