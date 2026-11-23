import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Share2, X } from 'lucide-react';
import useEscapeKey from '../lib/useEscapeKey';
import { ErrorLine } from './common/FormError';
import Arrive from './common/Arrive';
import MorphHeight from './common/MorphHeight';
import RippleGrid from './common/RippleGrid';
import SettledLogo from './common/SettledLogo';
import { createDrop } from '../lib/dropApi';
import { canPlayDrop, playDrop } from '../lib/dropFx';
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
    const [closeIn, setCloseIn] = useState(null); // seconds until the dialog closes itself: it starts once the link is copied
    const [copyFailed, setCopyFailed] = useState(false);
    // The drop animation: drops hang above the button until the link exists, then fall onto it, and the grid behind the dialog
    // ripples out from where they land. The form fades as the first drop lands (`leaving`), the dialog eases to the size of the link
    // view, and its parts arrive as the wave reaches them (`impact` is where it started).
    const [leaving, setLeaving] = useState(false);
    const [impact, setImpact] = useState(null);
    const [gridMounted, setGridMounted] = useState(false);
    const [gridOn, setGridOn] = useState(false);
    const canvasRef = useRef(null), buttonRef = useRef(null), fxRef = useRef(null), pending = useRef(null), timers = useRef([]);
    const animated = canPlayDrop();
    useEffect(() => () => { fxRef.current?.stop(); timers.current.forEach(clearTimeout); }, []);
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    // Once the link is copied the dialog closes itself 2 seconds after. It can also be closed at any time (Escape, the X, the
    // backdrop): a live link is kept in its login's Shared links, where it can be copied again, so closing loses nothing.
    const requestClose = () => onClose();
    useEscapeKey(true, requestClose);
    useEffect(() => {
        if (closeIn === null) return undefined;
        if (closeIn === 0) { closeRef.current(); return undefined; }
        const tick = setTimeout(() => setCloseIn(closeIn - 1), 1000);
        return () => clearTimeout(tick);
    }, [closeIn]);
    const startClosing = () => setCloseIn((seconds) => seconds ?? 2);

    const title = item.title?.trim() || item.url || 'this login';

    const startDrops = (released) => {
        setGridMounted(true);
        setGridOn(true);
        fxRef.current = playDrop({
            canvas: canvasRef.current,
            to: buttonRef.current,
            released,
            // the grid ripples where a click lands, so a click sent to the spot where the drop landed starts its ripple
            onHit: ({ x, y }) => {
                setImpact((spot) => spot ?? { x, y });
                window.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y }));
            },
            onLand: () => {
                setLeaving(true);
                later(() => { setMade(pending.current); setLeaving(false); setWorking(false); }, 240);
                later(() => setGridOn(false), 2400);
            },
            onEnd: (aborted) => { if (aborted) setGridOn(false); }
        });
    };

    const create = async () => {
        setWorking(true);
        setError('');
        const animate = animated && canvasRef.current && buttonRef.current;
        let release;
        const released = new Promise((resolve) => { release = resolve; });
        if (animate) startDrops(released);
        let result = null;
        try {
            const vaultKey = await getVaultKey();
            if (!vaultKey) {
                setError('Unlock your vault first.');
            } else {
                const rule = mode === 'views' ? { mode, views } : { mode, ttl };
                const made = await createDrop(host, getToken(), { item, rule, name, vaultKey, userId: getUserId() });
                if (made.ok) result = made; else setError(made.error);
            }
        } catch {
            setError('Cannot connect to the server. Try again.');
        }
        if (!result) { release(false); setWorking(false); return; }
        onMade?.();
        if (animate) { pending.current = result; release(true); } else { setMade(result); setWorking(false); }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(made.link);
        } catch {
            setCopyFailed(true); // not copied: it only counts once it really is (the box also notices a manual copy)
            return;
        }
        setCopyFailed(false);
        startClosing();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={requestClose} className="fixed inset-0 bg-[#0c1820]/50 backdrop-blur-sm" />
            {gridMounted && (
                <motion.div
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: gridOn ? 1 : 0 }}
                    transition={{ duration: 0.6 }}
                    onAnimationComplete={() => { if (!gridOn) setGridMounted(false); }}
                >
                    <RippleGrid color="#8fd8f3" cellSize={48} rippleStrength={1.5} glow={0.5} fade={0.35} autoRipple="none" mouseInteraction={false} intro={false} />
                </motion.div>
            )}
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-drop-title"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md bg-[#e1eef5]/95 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-2xl p-6"
            >
                <button type="button" onClick={requestClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-[#5c7788] hover:text-[#0c1820] hover:bg-white/60 transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                    <span className="sr-only">Close</span>
                </button>

                <MorphHeight animated={animated} innerClassName={leaving ? 'opacity-0 blur-[3px] transition-[opacity,filter] duration-200 pointer-events-none' : ''}>
                    <div>
                        <Arrive from={made ? impact : null} className="w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4">
                            {made ? <SettledLogo size={30} /> : <Share2 className="w-5 h-5" />}
                        </Arrive>
                        <Arrive from={made ? impact : null} as="h3" id="share-drop-title" className="text-lg font-bold text-[#0c1820]">{made ? 'Your drop link' : `Share ${title}`}</Arrive>

                        {made ? (
                            <div className="mt-3 space-y-3">
                                <Arrive from={impact} as="p" className="text-sm text-[#3a5566] leading-relaxed">
                                    Send this link to the person. It ends after {made.mode === 'views' ? `${made.viewsLeft} ${made.viewsLeft === 1 ? 'view' : 'views'}` : describeRule(made).replace('ends in ', '')}.
                                </Arrive>
                                <Arrive from={impact}>
                                    <input
                                        readOnly
                                        aria-label="Drop link"
                                        value={made.link}
                                        onFocus={(e) => e.target.select()}
                                        onCopy={startClosing}
                                        className="w-full px-3 py-2.5 text-xs font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] shadow-xs"
                                    />
                                </Arrive>
                                {copyFailed && <p role="alert" className="text-xs text-rose-700">Your browser would not copy it. Select the link above and copy it yourself.</p>}
                                <Arrive from={impact} as="p" className="text-xs text-[#3a5566] leading-relaxed">
                                    Anyone with this link can see this login until it ends. You can copy it again, or revoke it, any time under Shared links on this login.
                                </Arrive>
                                <Arrive from={impact}>
                                    <button type="button" autoFocus onClick={copy} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] shadow-md cursor-pointer">
                                        {closeIn !== null ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {closeIn !== null ? `Copied. Closing in ${closeIn}` : 'Copy link and close'}
                                    </button>
                                </Arrive>
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
                                    <button type="button" onClick={requestClose} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-white/80 bg-white/70 hover:bg-white text-[#3a5566] hover:text-[#0c1820] transition-all cursor-pointer shadow-xs">
                                        Cancel
                                    </button>
                                    <button type="button" ref={buttonRef} onClick={create} disabled={working} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] shadow-md disabled:opacity-70 cursor-pointer">
                                        {working ? 'Making link...' : 'Create link'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </MorphHeight>
            </motion.div>
            <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-20 w-full h-full pointer-events-none" />
        </div>
    );
}
