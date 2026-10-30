import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring, duration, ease } from '../../lib/motion';

export const calculateStrength = (password) => {
    if (!password) {
        return {
            score: 0,
            label: 'Empty',
            barClass: 'bg-white/60',
            badgeClass: 'bg-white/60 text-[#3a5566] border-white/80'
        };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 14) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (password.length < 8) {
        return {
            score: 1,
            label: 'Weak (Too Short)',
            barClass: 'bg-gradient-to-r from-rose-500 to-rose-400 shadow-xs shadow-rose-500/20',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }

    if (score <= 2) {
        return {
            score: 2,
            label: 'Weak',
            barClass: 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-xs shadow-amber-500/20',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }
    if (score <= 4) {
        return {
            score: 3,
            label: 'Good',
            barClass: 'bg-gradient-to-r from-[#112838] to-[#285d77] shadow-xs shadow-[#112838]/20',
            badgeClass: 'bg-[#d0e4ee] text-[#0e293a] border-[#b8d6e5]'
        };
    }
    return {
        score: 4,
        label: 'Strong',
        barClass: 'bg-gradient-to-r from-emerald-600 to-teal-500 shadow-xs shadow-emerald-500/20',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
};

/** What is wrong with a password, in plain words. */
export const describeProblems = (password) => {
    const problems = [];
    if (password.length < 8) problems.push('too short');
    else if (password.length < 14) problems.push('short');
    if (!/[^A-Za-z0-9]/.test(password)) problems.push('no symbols');
    if (!/[0-9]/.test(password)) problems.push('no numbers');
    if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) problems.push('one letter case');
    return problems;
};

/** The single most useful next step, as a sentence. Empty when nothing is left to fix. */
export const nextStep = (password) => {
    if (password.length < 8) return 'Make it at least 8 characters.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol.';
    if (!/[0-9]/.test(password)) return 'Add a number.';
    if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) return 'Mix upper and lower case.';
    if (password.length < 14) return 'Make it 14 characters or more.';
    return '';
};

/**
 * Strength meter. `mode` decides what is said under the bar:
 *   'saved'  a saved password that cannot be edited here: names the problem and offers `onChange`
 *   'typing' a password being typed: names the single most useful next step
 *   'none'   nothing (the generator, which builds the password for you)
 */
export default function PasswordStrength({ password, showLabel = true, mode = 'none', onChange }) {
    const { score, label, barClass, badgeClass } = calculateStrength(password);
    const hasPassword = Boolean(password);
    const weak = hasPassword && score <= 2;
    const hint = hasPassword && score < 4 ? nextStep(password) : '';

    // a tint frames the meter when the password is weak, so the problem is noticed at a glance
    let tint = '';
    if (hasPassword && score === 1) tint = 'bg-rose-500/[0.07] ring-1 ring-inset ring-rose-500/20';
    if (hasPassword && score === 2) tint = 'bg-amber-500/[0.09] ring-1 ring-inset ring-amber-500/30';

    return (
        <div className="w-full">
            <div className={`space-y-2 rounded-xl px-2 py-1.5 -mx-2 transition-colors duration-300 ${tint}`}>
                <div className="flex gap-1.5 h-1.5 w-full">
                    {[1, 2, 3, 4].map((segment) => (
                        <div
                            key={segment}
                            className="relative h-full flex-1 rounded-full overflow-hidden bg-white/50 border border-white/60"
                        >
                            {/* the fill grows from the left; segments fill one after another as the score rises */}
                            <motion.div
                                className={`absolute inset-0 rounded-full ${barClass}`}
                                style={{ originX: 0 }}
                                initial={false}
                                animate={{ scaleX: score >= segment ? 1 : 0 }}
                                transition={{ ...spring.soft, delay: score >= segment ? (segment - 1) * 0.05 : 0 }}
                            />
                            {/* the next segment breathes, showing where the password is heading */}
                            {hasPassword && score >= 1 && score < 4 && segment === score + 1 && (
                                <motion.div
                                    className="absolute inset-0 rounded-full bg-[#0284c7]/40"
                                    style={{ originX: 0 }}
                                    animate={{ scaleX: [0.18, 0.7, 0.18], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                                />
                            )}
                        </div>
                    ))}
                </div>
                {showLabel && hasPassword && (
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[#3a5566] font-semibold text-[11px] uppercase tracking-wider">
                            Security
                        </span>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={label}
                                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.9 }}
                                transition={{ duration: duration.fast, ease: ease.out }}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${badgeClass}`}
                            >
                                {label}
                                {score === 4 && (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                        <motion.path
                                            d="M5 12.5l4.5 4.5L19 7.5"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.35, delay: 0.1 }}
                                        />
                                    </svg>
                                )}
                            </motion.span>
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {mode === 'saved' && weak && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: ease.out }}
                    className="mt-3 flex flex-wrap items-center gap-2.5 text-[13px] font-semibold text-rose-800"
                >
                    <span>{`Easy to guess: ${describeProblems(password).join(', ')}.`}</span>
                    {onChange && (
                        <button
                            type="button"
                            onClick={onChange}
                            className="relative px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0077b6] bg-[#48cae4]/20 border border-[#0284c7]/35 hover:bg-[#48cae4]/35 transition-colors cursor-pointer"
                        >
                            Change it
                            {/* one ripple when it first appears, to draw the eye to the way out */}
                            <motion.span
                                aria-hidden="true"
                                className="absolute -inset-px rounded-full border-2 border-[#48cae4]/90 pointer-events-none"
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                                transition={{ duration: 0.9, ease: 'easeOut' }}
                            />
                        </button>
                    )}
                </motion.div>
            )}

            {mode === 'typing' && hasPassword && (
                <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                        key={hint || 'done'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: ease.out }}
                        className="mt-3 text-[13px] font-semibold text-[#112838]"
                    >
                        {hint ? `Next: ${hint.charAt(0).toLowerCase()}${hint.slice(1)}` : 'Nothing left to fix.'}
                    </motion.p>
                </AnimatePresence>
            )}
        </div>
    );
}
