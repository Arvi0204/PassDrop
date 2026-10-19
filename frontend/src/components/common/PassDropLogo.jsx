import React from 'react';

/**
 * PassDrop Logo Icon
 * Option E: Dual-drop metaphor (Storing + Sharing)
 * Gradient: Deep Blue (#1d4ed8) to Vibrant Cyan/Teal (#00b4d8 / #0096c7)
 */
export default function PassDropLogo({ size = 32, className = '' }) {
    const idPrefix = React.useId().replace(/:/g, '');
    const grad1 = `${idPrefix}-g1`;
    const grad2 = `${idPrefix}-g2`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 60 60"
            fill="none"
            className={`shrink-0 ${className}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={grad1} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id={grad2} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0096c7" />
                    <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
            {/* Primary Drop (Storage / Security Anchor) */}
            <path
                d="M22 2C22 2 4 18 4 30A18 18 0 0 0 40 30C40 18 22 2 22 2Z"
                fill={`url(#${grad1})`}
            />
            {/* Secondary Intersecting Drop (Sharing / Ephemeral Drop) */}
            <path
                d="M40 16C40 16 24 30 24 40A16 16 0 0 0 56 40C56 30 40 16 40 16Z"
                fill={`url(#${grad2})`}
                opacity="0.94"
            />
        </svg>
    );
}
