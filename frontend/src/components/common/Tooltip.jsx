import { useId } from 'react';
import { Droplet } from 'lucide-react';

/**
 * A small hint under a control, in the app's own look instead of the browser's plain `title` box. It shows when the control
 * is hovered (after a short pause, so passing the mouse over does not flash it) or reached with the keyboard, and never
 * takes the pointer. `children` is a function that gets `{ 'aria-describedby' }` to spread on the control, so the hint is
 * also read out by screen readers. It sits under the control, lined up with its right edge, so it cannot run off a narrow screen.
 */
export default function Tooltip({ title, text, children }) {
    const id = useId();
    return (
        <span className="relative inline-flex group/tip">
            {children({ 'aria-describedby': id })}
            <span
                id={id}
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-30 mt-2.5 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-[#0c1820]/95 px-3 py-2.5 text-left shadow-lg shadow-[#0c1820]/20 ring-1 ring-white/10 backdrop-blur-md
                    opacity-0 translate-y-1 transition duration-150 ease-out motion-reduce:transition-none motion-reduce:translate-y-0
                    group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:delay-300
                    group-has-[:focus-visible]/tip:opacity-100 group-has-[:focus-visible]/tip:translate-y-0"
            >
                <span aria-hidden="true" className="absolute -top-1 right-5 h-2 w-2 rotate-45 rounded-[2px] bg-[#0c1820]/95" />
                <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Droplet className="h-3 w-3 text-[#38bdf8]" aria-hidden="true" />
                    {title}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-[#c3dbe8]">{text}</span>
            </span>
        </span>
    );
}
