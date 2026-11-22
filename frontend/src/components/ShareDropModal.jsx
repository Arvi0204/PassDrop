import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Link2, Share2, X } from 'lucide-react';
import useEscapeKey from '../lib/useEscapeKey';
import { ErrorLine } from './common/FormError';
import { createDrop } from '../lib/dropApi';
import { TIMER_CHOICES, VIEW_CHOICES, describeRule } from '../lib/drop';
import { getToken, getUserId, getVaultKey } from '../lib/session';

const choice = (active) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
        active ? 'bg-[#112838] text-white border-[#112838]' : 'bg-white/70 text-[#3a5566] border-white/80 hover:bg-white'
    }`;

/**
 * Shares one login by a link that ends after a number of views or a time (never both). The link is shown once: it holds the
 * key, which the server never has, so it cannot be shown again later (the sender revokes and makes a new one instead).
 */
export default function ShareDropModal({ item, onClose, onMade }) {
    const host = import.meta.env.VITE_BACKEND;
    const [mode, setMode] = useState('views');
    const [views, setViews] = useState(1);
    const [ttl, setTtl] = useState(3600);
    const [name, setName] = useState('');
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [made, setMade] = useState(null); // { link, mode, viewsLeft, expiresAt }
    const [copied, setCopied] = useState(false);
    const [everCopied, setEverCopied] = useState(false); // the link cannot be shown again, so closing before copying asks first
    const [askClose, setAskClose] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    // closing a second time (Escape again, or "Close anyway") really closes
    const requestClose = () => {
        if (made && !everCopied && !askClose) setAskClose(true);
        else onClose();
    };
    useEscapeKey(true, requestClose);

    const title = item.title?.trim() || item.url || 'this login';

    const create = async () => {
        setWorking(true);
        setError('');
        try {
            const vaultKey = await getVaultKey();
            if (!vaultKey) { setError('Unlock your vault first.'); return; }
            const rule = mode === 'views' ? { mode, views } : { mode, ttl };
            const result = await createDrop(host, getToken(), { item, rule, name, vaultKey, userId: getUserId() });
            if (result.ok) { setMade(result); onMade?.(); } else setError(result.error);
        } catch {
            setError('Cannot connect to the server. Try again.');
        } finally {
            setWorking(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(made.link);
        } catch {
            setCopyFailed(true); // not copied: it only counts once it really is (the box also notices a manual copy)
            return;
        }
        setCopyFailed(false);
        setEverCopied(true);
        setAskClose(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={requestClose} className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm" />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-drop-title"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md bg-[#e1eef5]/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-2xl p-6"
            >
                <button type="button" onClick={requestClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                    <span className="sr-only">Close</span>
                </button>

                <div className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                    {made ? <Link2 className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                </div>
                <h3 id="share-drop-title" className="text-lg font-bold text-[#0c1820]">{made ? 'Your drop link' : `Share ${title}`}</h3>

                {made ? (
                    <div className="mt-3 space-y-3">
                        <p className="text-sm text-[#3a5566] leading-relaxed">
                            Send this link to the person. It ends after {made.mode === 'views' ? `${made.viewsLeft} ${made.viewsLeft === 1 ? 'view' : 'views'}` : describeRule(made).replace('ends in ', '')}.
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                readOnly
                                aria-label="Drop link"
                                value={made.link}
                                onFocus={(e) => e.target.select()}
                                onCopy={() => { setEverCopied(true); setAskClose(false); }}
                                className="flex-1 min-w-0 px-3 py-2.5 text-xs font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] shadow-xs"
                            />
                            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] rounded-xl shadow-md cursor-pointer">
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copied' : 'Copy link'}
                            </button>
                        </div>
                        {copyFailed && <p role="alert" className="text-xs text-rose-700">Your browser would not copy it. Select the link above and copy it yourself.</p>}
                        <p className="text-xs text-[#3a5566] leading-relaxed">
                            Anyone with this link can see this login until it ends. This link is shown only now: PassDrop never has the key, so it cannot show it again. You can revoke it any time from your Account page.
                        </p>
                        {askClose && (
                            <div role="alert" className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-[#3a5566] leading-relaxed">
                                You have not copied the link yet. It cannot be shown again, so you would have to revoke it and make a new one.
                                <div className="mt-2 flex items-center gap-2">
                                    <button type="button" onClick={copy} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] rounded-lg cursor-pointer">Copy link</button>
                                    <button type="button" onClick={onClose} className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-white/80 hover:bg-rose-50 border border-rose-200/80 rounded-lg cursor-pointer">Close anyway</button>
                                </div>
                            </div>
                        )}
                        <button type="button" onClick={requestClose} className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-white/80 bg-white/70 hover:bg-white text-[#0c1820] transition-all cursor-pointer shadow-xs">
                            Done
                        </button>
                    </div>
                ) : (
                    <div className="mt-3 space-y-4">
                        <p className="text-sm text-[#3a5566] leading-relaxed">
                            Make a link that opens this login for one person, no account needed. It destroys itself when it ends.
                        </p>

                        <div role="group" aria-label="How the link ends" className="flex gap-2">
                            <button type="button" aria-pressed={mode === 'views'} onClick={() => setMode('views')} className={choice(mode === 'views')}>After a number of views</button>
                            <button type="button" aria-pressed={mode === 'timer'} onClick={() => setMode('timer')} className={choice(mode === 'timer')}>After a time</button>
                        </div>

                        {mode === 'views' ? (
                            <div role="group" aria-label="Number of views" className="flex flex-wrap gap-2">
                                {VIEW_CHOICES.map((n) => (
                                    <button key={n} type="button" aria-pressed={views === n} onClick={() => setViews(n)} className={choice(views === n)}>
                                        {n} {n === 1 ? 'view' : 'views'}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div role="group" aria-label="How long it lasts" className="flex flex-wrap gap-2">
                                {TIMER_CHOICES.map((t) => (
                                    <button key={t.ttl} type="button" aria-pressed={ttl === t.ttl} onClick={() => setTtl(t.ttl)} className={choice(ttl === t.ttl)}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div>
                            <label htmlFor="drop-name" className="block text-xs font-semibold text-[#0c1820] mb-1.5">Name this link (optional)</label>
                            <input
                                id="drop-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={60}
                                placeholder="e.g. For Priya, or the new laptop"
                                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] placeholder-[#5c7788] focus:outline-none focus:ring-2 focus:ring-[#112838]/20 focus:border-[#112838] shadow-xs"
                            />
                            <p className="mt-1 text-xs text-[#3a5566]">Only you see this, to tell your links apart. It is encrypted like the rest.</p>
                        </div>

                        <ErrorLine>{error}</ErrorLine>

                        <div className="flex items-center gap-3">
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-white/80 bg-white/70 hover:bg-white text-[#3a5566] hover:text-[#0c1820] transition-all cursor-pointer shadow-xs">
                                Cancel
                            </button>
                            <button type="button" onClick={create} disabled={working} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] shadow-md disabled:opacity-70 cursor-pointer">
                                {working ? 'Making link...' : 'Create link'}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
