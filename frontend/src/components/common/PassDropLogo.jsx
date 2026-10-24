import React from 'react';

/**
 * PassDrop Logo Icon
 * Dual-drop metaphor (Storing + Sharing)
 * Aquatic Water Palette (Clean crystalline water blue for light theme):
 * - Primary Drop: Deep clear water (#0077b6 -> #0284c7)
 * - Secondary Drop: Crystalline ripple & surface splash (#00b4d8 -> #48cae4)
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
                <linearGradient id={grad1} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0%" stopColor="#0077b6" />
                    <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id={grad2} x1="0.1" y1="0" x2="0.9" y2="1">
                    <stop offset="0%" stopColor="#00b4d8" />
                    <stop offset="100%" stopColor="#48cae4" />
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
                opacity="0.92"
            />
        </svg>
    );
}
