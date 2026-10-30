import React from 'react';
import { motion } from 'framer-motion';
import { LENGTH_RANGE } from '../../lib/passwordGen';

const PRESETS = [12, 16, 20, 24];

const OPTIONS = [
    { key: 'includeNumbers', label: 'Include Numbers (0-9)' },
    { key: 'includeSpecialChars', label: 'Include Symbols (!@#$...)' }
];

/**
 * The generator's controls: length presets and slider, and the two character options.
 * Used by both the Generator and the edit dialog, so the two always look and behave alike.
 *
 * `onLength(n)` is called as the length changes. `onToggle(key, boxEl)` is called when an option
 * is clicked; `boxEl` is the check box, which the caller can fly a drop out of.
 */
export default function GeneratorOptions({ settings, onLength, onToggle }) {
    const { min, max } = LENGTH_RANGE;
    const fill = ((settings.length - min) / (max - min)) * 100;

    return (
        <>
            <div className="mb-5 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-semibold text-[#0c1820]">
                    <span>Password Length</span>
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => onLength(preset)}
                                    className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                                        settings.length === preset
                                            ? 'bg-gradient-to-r from-[#0284c7] to-[#0077b6] text-white shadow-xs'
                                            : 'bg-white/80 text-[#3a5566] hover:text-[#0c1820] border border-white/80'
                                    }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md bg-[#e0f2fe] text-[#0284c7] font-mono font-bold text-xs border border-[#bae6fd] shadow-xs">
                            {settings.length}
                        </span>
                    </div>
                </div>

                <div className="relative py-1">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        value={settings.length}
                        onChange={(e) => onLength(Number(e.target.value))}
                        style={{
                            background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${fill}%, #b9d1df ${fill}%, #b9d1df 100%)`
                        }}
                        className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-[#0284c7] border border-white/90 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                    />
                    <div className="flex justify-between items-center text-[10px] font-mono text-[#4a697e] mt-1 px-0.5 font-medium">
                        <span>{min} chars</span>
                        <span>{max} chars</span>
                    </div>
                </div>
            </div>

            {/* The check mark draws itself in */}
            <div className="space-y-3">
                {OPTIONS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked={settings[key]}
                        onClick={(e) => onToggle(key, e.currentTarget.querySelector('[data-box]'))}
                        className="flex w-full items-center gap-3 p-2.5 rounded-xl border border-white/80 bg-white/50 hover:bg-white/80 cursor-pointer transition-colors shadow-xs text-left"
                    >
                        <span
                            data-box
                            className={`w-[21px] h-[21px] shrink-0 rounded-[7px] border-2 grid place-items-center transition-colors duration-200 ${
                                settings[key]
                                    ? 'bg-gradient-to-br from-[#0284c7] to-[#0077b6] border-[#0284c7]'
                                    : 'bg-white border-slate-300'
                            }`}
                        >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                <motion.path
                                    d="M5 12.5l4.5 4.5L19 7.5"
                                    initial={false}
                                    animate={{ pathLength: settings[key] ? 1 : 0, opacity: settings[key] ? 1 : 0 }}
                                    transition={{ duration: 0.24, delay: settings[key] ? 0.06 : 0 }}
                                />
                            </svg>
                        </span>
                        <span className="text-xs font-semibold text-[#0c1820]">{label}</span>
                    </button>
                ))}
            </div>
        </>
    );
}
