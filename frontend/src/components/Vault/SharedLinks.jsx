import { useEffect, useState } from 'react';
import { ChevronRight, Share2, Trash2 } from 'lucide-react';
import { revokeDrop } from '../../lib/dropApi';
import { describeRule, fingerprintOf } from '../../lib/drop';
import { getToken } from '../../lib/session';

const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const ENDED = { used: 'Used up', expired: 'Expired', revoked: 'Revoked' };
const opened = (n) => (n ? `opened ${n} ${n === 1 ? 'time' : 'times'}` : 'never opened');

/**
 * The links made from one login, in that login's detail panel. The live ones: what is left of each, and Revoke. Under them,
 * folded away, the links that ended in the last 30 days (`past`): how each ended and how often it was opened. It shows
 * nothing when the login has neither. The links themselves cannot be shown again: only the sender's browser ever had the key.
 */
export default function SharedLinks({ drops, past = [], onChanged, item, heading = 'Shared links', showTitle = false }) {
    const host = import.meta.env.VITE_BACKEND;
    const [confirming, setConfirming] = useState(null); // the id waiting for "Revoke now"
    const [error, setError] = useState('');
    const [showPast, setShowPast] = useState(false);
    // what the login looks like now, to tell the links that were made before its last edit (they show the old details)
    const [currentFp, setCurrentFp] = useState(null);
    useEffect(() => {
        let current = true;
        setCurrentFp(null);
        if (item) fingerprintOf(item).then((fp) => { if (current) setCurrentFp(fp); });
        return () => { current = false; };
    }, [item]);

    if (!drops.length && !past.length) return null;

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

    return (
        <div className="space-y-1.5">
            {drops.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#3a5566] uppercase tracking-wider">
                    <Share2 className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>{heading} ({drops.length})</span>
                </div>
            )}
            <ul className="space-y-2">
                {drops.map((drop) => (
                    <li key={drop.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#f5fafc]/85 border border-white/90 shadow-xs">
                        <div className="min-w-0">
                            {drop.name
                                ? <p className="text-sm font-medium text-[#0c1820] truncate">{drop.name}</p>
                                : <p className="text-sm italic text-[#5c7788]">Unnamed link</p>}
                            <p className="text-xs text-[#3a5566]">
                                {showTitle && drop.title ? `From ${drop.title} · ` : ''}Shared {when(drop.createdAt)} · {describeRule(drop)}
                            </p>
                            {drop.fp && currentFp && drop.fp !== currentFp && (
                                <p className="text-xs font-semibold text-amber-700 mt-0.5">This login was edited after you shared this link, so the link shows the old details.</p>
                            )}
                        </div>
                        {confirming === drop.id ? (
                            <div className="flex items-center gap-2 shrink-0">
                                <button type="button" onClick={() => revoke(drop.id)} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer">
                                    Revoke now
                                </button>
                                <button type="button" onClick={() => setConfirming(null)} className="px-2.5 py-1.5 text-xs font-semibold text-[#3a5566] bg-white/80 hover:bg-white border border-white/90 rounded-lg cursor-pointer">
                                    Keep
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirming(drop.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg shrink-0 cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Revoke
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
            {past.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setShowPast(!showPast)}
                        aria-expanded={showPast}
                        className="flex items-center gap-1 text-xs font-bold text-[#3a5566] uppercase tracking-wider cursor-pointer"
                    >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPast ? 'rotate-90' : ''}`} />
                        Past links ({past.length})
                    </button>
                    {showPast && (
                        <>
                            <ul className="space-y-2 mt-1.5">
                                {past.map((entry) => (
                                    <li key={entry.id} className="p-3 rounded-xl bg-[#f5fafc]/50 border border-white/90">
                                        {entry.name
                                            ? <p className="text-sm font-medium text-[#0c1820] truncate">{entry.name}</p>
                                            : <p className="text-sm italic text-[#5c7788]">Unnamed link</p>}
                                        <p className="text-xs text-[#3a5566]">
                                            Shared {when(entry.createdAt)} · {ENDED[entry.reason] || 'Ended'} {when(entry.endedAt)} · {opened(entry.opens)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-[#5c7788] mt-1.5">Past links are kept for 30 days, then forgotten.</p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
