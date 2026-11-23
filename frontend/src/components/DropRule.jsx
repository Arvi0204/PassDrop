import { useId } from 'react';
import { DROP_PATHS, LOGO_COLORS } from '../lib/logo';

// The rule of a drop, drawn as water (the CSS is in index.css). A views drop is one drop per view left: a used view stays as an
// outline. A timer drop is one bigger drop that holds the water that is left. They are the logo's own drop shape, one at a time,
// never the two-drop mark, so a row cannot be misread as a count of two.
const BOX = '0 0 44 50';

/** `total` drops, the first `left` of them full. `pulse` makes the last full drop swell: it is the one about to be used. */
export function ViewsRow({ total, left, label, pulse = false, rowRef }) {
    const id = useId().replace(/:/g, '');
    return (
        <div ref={rowRef} className="flex flex-wrap items-center gap-1.5 min-h-[30px]">
            {Array.from({ length: total }, (_, i) => (
                <span key={i} data-drop className={`drop-glyph${i < left ? ' is-full' : ''}${pulse && i === left - 1 ? ' drop-pulse' : ''}`}>
                    <svg viewBox={BOX} fill="none" aria-hidden="true">
                        <defs>
                            <linearGradient id={`${id}-g`} x1=".1" y1="0" x2=".9" y2="1">
                                <stop offset="0" stopColor={LOGO_COLORS.primary[0]} />
                                <stop offset="1" stopColor={LOGO_COLORS.primary[1]} />
                            </linearGradient>
                        </defs>
                        <path className="ghost" d="M22 4C22 4 6 20 6 31A16 16 0 0 0 38 31C38 20 22 4 22 4Z" />
                        <path className="full" d={DROP_PATHS.primary} fill={`url(#${id}-g)`} />
                    </svg>
                </span>
            ))}
            <span className="ml-2 text-[13px] font-semibold text-[#3a5566]">{label}</span>
        </div>
    );
}

/** One bigger drop with a wave of water at `fraction` (0 to 1) of its height; `drained` lets it all run out. */
export function TimerDrop({ fraction, label, pulse = false, drained = false, dropRef }) {
    const id = useId().replace(/:/g, '');
    const level = drained ? 52 : 48 - 46 * Math.max(0, Math.min(1, fraction));
    return (
        <div className="flex items-center gap-2 min-h-[30px]">
            <span ref={dropRef} className={`timer-drop${pulse ? ' drop-pulse' : ''}`}>
                <svg viewBox={BOX} fill="none" aria-hidden="true">
                    <defs>
                        <clipPath id={`${id}-c`}><path d={DROP_PATHS.primary} /></clipPath>
                        <linearGradient id={`${id}-g`} x1=".1" y1="0" x2=".9" y2="1">
                            <stop offset="0" stopColor={LOGO_COLORS.primary[0]} />
                            <stop offset="1" stopColor={LOGO_COLORS.primary[1]} />
                        </linearGradient>
                    </defs>
                    <path d={DROP_PATHS.primary} fill="rgba(2,132,199,.1)" stroke="#7fa3b8" strokeWidth="2.5" strokeOpacity=".6" />
                    <g clipPath={`url(#${id}-c)`}>
                        <g className="timer-level" style={{ transform: `translateY(${level}px)` }}>
                            <path className="timer-wave" d="M-44 0 q11 -4 22 0 t22 0 t22 0 t22 0 t22 0 t22 0 V60 H-44Z" fill={`url(#${id}-g)`} />
                        </g>
                    </g>
                </svg>
            </span>
            <span className="text-[13px] font-semibold text-[#3a5566]">{label}</span>
        </div>
    );
}
