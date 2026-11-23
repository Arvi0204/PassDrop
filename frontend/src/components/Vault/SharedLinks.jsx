import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Copy, Droplet, Trash2 } from 'lucide-react';
import { clearHistory, revokeDrop } from '../../lib/dropApi';
import { describeRule, dropLink, fingerprintOf } from '../../lib/drop';
import { duration, ease } from '../../lib/motion';
import { getToken } from '../../lib/session';

const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const ENDED = { used: 'Used up', expired: 'Expired', revoked: 'Revoked' };
const opened = (n) => (n ? `opened ${n} ${n === 1 ? 'time' : 'times'}` : 'never opened');

// Everything here grows open and folds shut instead of popping in and out (reduced motion is handled globally by MotionConfig).
// A block opens by height first and fades in a beat behind it; it closes the other way round.
const fold = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: 'auto', opacity: 1, transition: { height: { duration: duration.slow, ease: ease.out }, opacity: { duration: duration.base, delay: 0.06 }, staggerChildren: 0.05 } },
    exit: { height: 0, opacity: 0, transition: { height: { duration: duration.slow, ease: ease.inOut, delay: 0.08 }, opacity: { duration: duration.base } } }
};
// a link leaving a list: it slides aside and fades, then the gap closes; the ones after it follow one after another (`custom` is its place)
const leave = (i = 0) => ({
    opacity: 0, x: 24,
    transition: { opacity: { duration: duration.base, delay: i * 0.05 }, x: { duration: duration.base, ease: ease.inOut, delay: i * 0.05 } }
});
const liveRow = {
    hidden: { height: 0, opacity: 0, y: -6 },
    visible: { height: 'auto', opacity: 1, y: 0, transition: { height: { duration: duration.slow, ease: ease.out }, opacity: { duration: duration.base, delay: 0.06 }, y: { duration: duration.slow, ease: ease.out } } },
    exit: (i) => ({ height: 0, ...leave(i), transition: { ...leave(i).transition, height: { duration: duration.slow, ease: ease.inOut, delay: 0.12 + (i || 0) * 0.05 } } })
};
const pastRow = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
    exit: (i) => ({ opacity: 0, x: -14, transition: { duration: duration.base, ease: ease.inOut, delay: (i || 0) * 0.05 } })
};
// the two buttons that swap places (Revoke / Revoke now and Keep): a quick cross-fade
const swap = { initial: { opacity: 0, x: 6 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -6 }, transition: { duration: duration.fast } };

/**
 * The links made from one login, in that login's detail panel. The live ones: what is left of each, Copy link, and Revoke. Under
 * them, folded away, the links that ended in the last 30 days (`past`): how each ended and how often it was opened. It shows
 * nothing when the login has neither. A live link can be copied again because its key is kept in its encrypted label (only this
 * vault can read it); one made before that has no key and cannot be.
 */
export default function SharedLinks({ drops, past = [], onChanged, item, heading = 'Drops', showTitle = false }) {
    const host = import.meta.env.VITE_BACKEND;
    const [confirming, setConfirming] = useState(null); // the id waiting for "Revoke now"
    const [error, setError] = useState('');
    const [showPast, setShowPast] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [clearing, setClearing] = useState(false); // waiting for "Clear now"
    // what the login looks like now, to tell the links that were made before its last edit (they show the old details)
    const [currentFp, setCurrentFp] = useState(null);
    useEffect(() => {
        let current = true;
        setCurrentFp(null);
        if (item) fingerprintOf(item).then((fp) => { if (current) setCurrentFp(fp); });
        return () => { current = false; };
    }, [item]);

    const revoke = async (id) => {
        setConfirming(null);
        try {
            const result = await revokeDrop(host, getToken(), id);
            setError(result.ok ? '' : result.error);
        } catch {
            setError('Cannot connect to the server. Try again.');
        }
        onChanged();
    };

    // the past links of this login go now, instead of at 30 days (the live ones are not touched)
    const clearPast = async () => {
        setClearing(false);
        if (!past[0]?.login) return;
        try {
            const result = await clearHistory(host, getToken(), past[0].login);
            setError(result.ok ? '' : result.error);
        } catch {
            setError('Cannot connect to the server. Try again.');
        }
        onChanged(true);
    };

    const copyLink = async (drop) => {
        try {
            await navigator.clipboard.writeText(dropLink(window.location.origin, drop.id, drop.key));
            setError('');
            setCopiedId(drop.id);
            setTimeout(() => setCopiedId((id) => (id === drop.id ? null : id)), 2000);
        } catch {
            setError('Your browser would not copy the link. Try again.');
        }
    };

    return (
        <AnimatePresence initial={false}>
            {(drops.length > 0 || past.length > 0) && (
                <motion.div key="links" variants={fold} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                    <div className="space-y-1.5">
                        <AnimatePresence initial={false}>
                            {drops.length > 0 && (
                                <motion.div key="heading" variants={fold} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                                        <Droplet className="w-3.5 h-3.5 text-[#0284c7]" />
                                        <span>{heading} ({drops.length})</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <ul className="-mb-2">
                            <AnimatePresence initial={false}>
                                {drops.map((drop, i) => (
                                    <motion.li key={drop.id} custom={i} variants={liveRow} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                                        <div className="pb-2">
                                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#f5fafc]/85 border border-white/90 shadow-xs">
                                                <div className="min-w-0" id={`drop-info-${drop.id}`}>
                                                    {drop.name
                                                        ? <p className="text-sm font-medium text-[#0c1820] truncate">{drop.name}</p>
                                                        : <p className="text-sm italic text-[#5c7788]">Unnamed drop</p>}
                                                    <p className="text-xs text-[#3a5566]">
                                                        {showTitle && drop.title ? `From ${drop.title} · ` : ''}Dropped {when(drop.createdAt)} · {describeRule(drop)}
                                                    </p>
                                                    {!drop.key && <p className="text-xs text-[#5c7788] mt-0.5">Made before a link could be copied again, so this one cannot be.</p>}
                                                    {drop.fp && currentFp && drop.fp !== currentFp && (
                                                        <p className="text-xs font-semibold text-amber-700 mt-0.5">This login was edited after you made this drop, so it shows the old details.</p>
                                                    )}
                                                </div>
                                                <AnimatePresence mode="wait" initial={false}>
                                                    {confirming === drop.id ? (
                                                        <motion.div key="confirm" {...swap} className="flex items-center gap-2 shrink-0">
                                                            <button type="button" onClick={() => revoke(drop.id)} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer">
                                                                Revoke now
                                                            </button>
                                                            <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1.5 text-xs font-semibold text-[#3a5566] bg-white/80 hover:bg-white border border-white/90 rounded-lg cursor-pointer">
                                                                Keep
                                                            </button>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div key="actions" {...swap} className="flex items-center gap-2 shrink-0">
                                                            {drop.key && (
                                                                <button
                                                                    type="button"
                                                                    aria-describedby={`drop-info-${drop.id}`}
                                                                    onClick={() => copyLink(drop)}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-lg cursor-pointer"
                                                                >
                                                                    {copiedId === drop.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                                    {copiedId === drop.id ? 'Copied' : 'Copy link'}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                aria-describedby={`drop-info-${drop.id}`}
                                                                onClick={() => setConfirming(drop.id)}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                Revoke
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
                        <p role="status" className="sr-only">{copiedId ? 'Link copied' : ''}</p>
                        <AnimatePresence initial={false}>
                            {past.length > 0 && (
                                <motion.div key="past" variants={fold} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowPast(!showPast)}
                                        aria-expanded={showPast}
                                        className="flex items-center gap-1 text-xs font-bold text-[#3a5566] uppercase tracking-wider cursor-pointer"
                                    >
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showPast ? 'rotate-90' : ''}`} />
                                        Past drops ({past.length})
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {showPast && (
                                            <motion.div key="list" variants={fold} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                                                <ul className="space-y-2 mt-1.5">
                                                    {past.map((entry, i) => (
                                                        <motion.li key={entry.id} custom={i} variants={pastRow} className="p-3 rounded-xl bg-[#f5fafc]/50 border border-white/90">
                                                            {entry.name
                                                                ? <p className="text-sm font-medium text-[#0c1820] truncate">{entry.name}</p>
                                                                : <p className="text-sm italic text-[#5c7788]">Unnamed drop</p>}
                                                            <p className="text-xs text-[#3a5566]">
                                                                Dropped {when(entry.createdAt)} · {ENDED[entry.reason] || 'Ended'} {when(entry.endedAt)} · {opened(entry.opens)}
                                                            </p>
                                                        </motion.li>
                                                    ))}
                                                </ul>
                                                <div className="flex items-center justify-between gap-3 mt-1.5">
                                                    <p className="text-xs text-[#5c7788]">Past drops are kept for 30 days, then forgotten.</p>
                                                    <AnimatePresence mode="wait" initial={false}>
                                                        {clearing ? (
                                                            <motion.div key="confirm" {...swap} className="flex items-center gap-2 shrink-0">
                                                                <button type="button" onClick={clearPast} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer">Clear now</button>
                                                                <button type="button" onClick={() => setClearing(false)} className="px-2.5 py-1.5 text-xs font-semibold text-[#3a5566] bg-white/80 hover:bg-white border border-white/90 rounded-lg cursor-pointer">Keep</button>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div key="clear" {...swap} className="shrink-0">
                                                                <button type="button" onClick={() => setClearing(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#3a5566] bg-white/80 hover:bg-white border border-white/90 rounded-lg cursor-pointer">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    Clear past drops
                                                                </button>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
