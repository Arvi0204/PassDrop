import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, ExternalLink, Gift, Link2Off } from 'lucide-react';
import Arrive from './common/Arrive';
import MorphHeight from './common/MorphHeight';
import RippleGrid from './common/RippleGrid';
import { TimerDrop, ViewsRow } from './DropRule';
import { openDrop, peekDrop } from '../lib/dropApi';
import { keyFromHash } from '../lib/drop';
import { canRelease, releaseDrop } from '../lib/dropFall';
import { countdown, formatLeft } from '../lib/serverClock';

const card = 'w-full max-w-md bg-[#e1eef5]/70 rounded-3xl border border-white/80 shadow-[0_14px_35px_-8px_rgba(22,44,58,0.18)] backdrop-blur-xl p-6 sm:p-10';
const copyButton = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#112838] bg-white/80 hover:bg-white border border-white/90 rounded-lg shadow-xs cursor-pointer';
const tile = 'w-11 h-11 rounded-xl bg-[#d0e4ee] border border-[#b8d6e5] text-[#112838] flex items-center justify-center shadow-xs mb-4';
const totalOf = (r) => Math.max(1, (Date.parse(r.expiresAt) - Date.parse(r.createdAt)) / 1000); // how long the timer was set for
const RECHECK_MS = 30000; // a page that was left open looks again when it is looked at, but never more often than this
const plural = (n) => `${n} ${n === 1 ? 'view' : 'views'} left`;

function Field({ label, value, secret }) {
    const [shown, setShown] = useState(false);
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    if (!value) return null;
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setFailed(true); // the browser refused: say so, and the value is on the page to select by hand
            setTimeout(() => setFailed(false), 4000);
        }
    };
    return (
        <div>
            <p className="text-xs font-semibold text-[#0c1820] mb-1.5">{label}</p>
            <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 px-3.5 py-2.5 text-sm font-mono rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] break-all">
                    {secret && !shown ? '••••••••••••' : value}
                </p>
                {secret && (
                    <button type="button" onClick={() => setShown(!shown)} className={copyButton} aria-label={shown ? `Hide ${label}` : `Show ${label}`}>
                        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                )}
                <button type="button" onClick={copy} className={copyButton} aria-label={`Copy ${label}`}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>
            <p role="status" className={failed ? 'mt-1.5 text-xs text-rose-700' : 'sr-only'}>
                {failed ? 'Your browser would not copy it. Select it and copy by hand.' : copied ? `${label} copied` : ''}
            </p>
        </div>
    );
}

// what the card says when it has ended, and when the page saw it end itself it says how
const GONE = {
    '': ['This drop is gone', 'It has ended, or the sender revoked it. Ask them for a new one.'],
    time: ['This drop is gone', 'Its time was up. Ask the sender for a new one.'],
    cleared: ['The time is up', 'This login was cleared from this page, as the sender set. Ask them for a new link if you still need it.']
};

/**
 * What the person who gets a drop link sees (/drop/:id#key). No account needed. The page first looks at what is left of the drop
 * (views or time; this takes no view), so a chat app previewing the link cannot use one up. Nothing is opened until they press
 * Reveal: then the drop that is used falls out of the card and the page ripples, and the login is decrypted here and held in
 * memory only. A timer drop counts down on the server's clock, and clears the login when its time is up.
 */
export default function Drop() {
    const host = import.meta.env.VITE_BACKEND;
    const { id } = useParams();
    const linkKey = keyFromHash(useLocation().hash);
    const animated = canRelease();

    const [peek, setPeek] = useState(null); // what the lookup said, once it has: { mode, viewsLeft } or { mode, expiresAt, createdAt, now }
    const [state, setState] = useState({ status: 'ready' }); // ready | opening | open | gone | error
    const [why, setWhy] = useState('');     // how the page saw it end: '', 'time' or 'cleared'
    const [used, setUsed] = useState(false); // the view that was just used
    const [dry, setDry] = useState(false);   // the rule has run out: the drops dry up, the water drains
    const [leaving, setLeaving] = useState(false);
    const [impact, setImpact] = useState(null); // where the last drop landed: the parts of the next view arrive from there
    const [gridMounted, setGridMounted] = useState(false);
    const [gridOn, setGridOn] = useState(false);
    const [secs, setSecs] = useState(null); // seconds left, on a timer drop
    // a link without its key can never be opened, so it does not even offer to try
    const status = linkKey ? state.status : 'broken';

    const cardRef = useRef(null), rowRef = useRef(null), dropRef = useRef(null), buttonRef = useRef(null);
    const clock = useRef(null), statusRef = useRef(status), lastLook = useRef(0), timers = useRef([]);
    const endRef = useRef(null), finishRef = useRef(null);
    statusRef.current = status;
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    // The drop has run out as far as this page can tell: it dries up, then the card says so.
    const finish = (reason) => {
        if (statusRef.current === 'gone') return;
        setWhy(reason);
        setDry(true);
        const spot = () => { const r = (rowRef.current || dropRef.current || buttonRef.current)?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
        if (!animated || !(rowRef.current || dropRef.current)) { setState({ status: 'gone' }); return; } // nothing shown to dry up
        later(() => setLeaving(true), 800);
        later(() => { setImpact(spot()); setState({ status: 'gone' }); setLeaving(false); }, 1000);
    };
    finishRef.current = finish;
    endRef.current = () => {
        const s = statusRef.current;
        if (s === 'open') finish('cleared');
        else if (s === 'ready' || s === 'error') finish('time');
    };

    // look at what is left, once, on arrival: this needs no key and takes no view
    useEffect(() => {
        if (!linkKey) return undefined;
        let alive = true;
        peekDrop(host, id).then((r) => {
            if (!alive) return;
            lastLook.current = Date.now();
            if (r.gone) setState({ status: 'gone' }); // arrived after it ended: there is nothing to animate
            else if (r.ok) setPeek(r);
        }).catch(() => { /* the rule is just left out, and Reveal still works */ });
        return () => { alive = false; };
    }, [host, id, linkKey]);

    // A page that was left open looks again when it is looked at (never more than every 30 seconds, and never on a timer):
    // someone else may have used the last view or the sender may have revoked it in the meantime.
    useEffect(() => {
        if (!linkKey) return undefined;
        const look = () => {
            if (document.visibilityState !== 'visible' || statusRef.current !== 'ready' || Date.now() - lastLook.current < RECHECK_MS) return;
            lastLook.current = Date.now();
            peekDrop(host, id).then((r) => {
                if (statusRef.current !== 'ready') return;
                if (r.gone) finishRef.current(''); else if (r.ok) setPeek(r);
            }).catch(() => {});
        };
        window.addEventListener('focus', look);
        document.addEventListener('visibilitychange', look);
        return () => { window.removeEventListener('focus', look); document.removeEventListener('visibilitychange', look); };
    }, [host, id, linkKey]);

    // A timer counts down on the server's clock (it said what time it is), locally, with no more requests.
    const live = status === 'ready' || status === 'opening' || status === 'open' || status === 'error';
    const timerRule = live ? (status === 'open' ? state : peek) : null;
    useEffect(() => {
        if (!timerRule || timerRule.mode !== 'timer') { clock.current = null; return undefined; }
        clock.current = countdown(timerRule.expiresAt, timerRule.now);
        setSecs(clock.current());
        const tick = setInterval(() => {
            const left = clock.current();
            setSecs(left);
            if (left <= 0) { clearInterval(tick); endRef.current(); }
        }, 1000);
        return () => clearInterval(tick);
    }, [timerRule]);

    // the drop that is used leaves its row, falls out of the card and the page ripples where it lands; then the card changes
    const show = async (result) => {
        if (!animated) { setState({ status: 'open', ...result }); return; }
        let from = null;
        if (result.mode === 'views' && rowRef.current) {
            const full = rowRef.current.querySelectorAll('.is-full'), last = full[full.length - 1];
            if (last) { const r = last.getBoundingClientRect(); from = { x: r.left + r.width / 2, bottom: r.bottom }; }
        } else if (result.mode === 'timer' && dropRef.current) {
            const r = dropRef.current.getBoundingClientRect();
            from = { x: r.left + r.width / 2, bottom: r.bottom - 6, grow: true };
        }
        let spot = null;
        if (from) {
            setUsed(true);
            setGridMounted(true);
            setGridOn(true);
            spot = await releaseDrop({ ...from, floorY: cardRef.current.getBoundingClientRect().bottom + 24 });
            window.dispatchEvent(new PointerEvent('pointerdown', { clientX: spot.x, clientY: spot.y })); // the grid ripples where a click lands
            later(() => setGridOn(false), 2400);
        } else {
            const b = buttonRef.current?.getBoundingClientRect();
            spot = b ? { x: b.left + b.width / 2, y: b.top } : null;
        }
        setLeaving(true);
        await new Promise((resolve) => later(resolve, from ? 260 : 200));
        setImpact(spot);
        setLeaving(false);
        setState({ status: 'open', ...result });
    };

    const reveal = async () => {
        setState({ status: 'opening' });
        try {
            const result = await openDrop(host, id, linkKey);
            if (result.ok) {
                // the view is already used, so whatever the animation does (fails, or never finishes), the login is shown
                await Promise.race([show(result).catch(() => {}), new Promise((resolve) => later(resolve, 4000))]);
                setLeaving(false);
                setState((s) => (s.status === 'open' ? s : { status: 'open', ...result }));
            } else if (result.gone) finish('');
            else setState({ status: 'error', error: result.error });
        } catch {
            setState({ status: 'error', error: 'Cannot connect to the server. Try again.' });
        }
    };

    const opening = status === 'opening';
    const secondsLeft = secs ?? (peek?.mode === 'timer' ? Math.max(0, (Date.parse(peek.expiresAt) - Date.parse(peek.now)) / 1000) : 0);
    const timerRow = (rule, drained) => (
        <TimerDrop
            dropRef={dropRef}
            fraction={secondsLeft / totalOf(rule)}
            pulse={opening}
            drained={drained}
            label={drained ? 'The time is up' : `Ends in ${formatLeft(secondsLeft)}`}
        />
    );
    // what is left of the drop, before it is opened (only once the lookup has said)
    const ruleRow = peek && (peek.mode === 'views'
        ? <ViewsRow rowRef={rowRef} total={peek.viewsLeft} left={dry ? 0 : peek.viewsLeft - (used ? 1 : 0)} pulse={opening} label={dry || peek.viewsLeft - (used ? 1 : 0) === 0 ? 'No views left' : plural(peek.viewsLeft - (used ? 1 : 0))} />
        : timerRow(peek, dry));

    let body;
    if (status === 'open') {
        const left = state.viewsLeft;
        body = (
            <div className="space-y-4">
                <Arrive from={impact}>
                    <h1 className="text-2xl font-bold text-[#0c1820] break-words">{state.item.title || state.item.url || 'Dropped login'}</h1>
                    {state.item.url && (
                        <a href={/^https?:\/\//.test(state.item.url) ? state.item.url : `https://${state.item.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#0284c7] hover:underline mt-1 font-medium break-all">
                            {state.item.url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                    )}
                </Arrive>
                {state.item.username && <Arrive from={impact}><Field label="Username" value={state.item.username} /></Arrive>}
                {state.item.password && <Arrive from={impact}><Field label="Password" value={state.item.password} secret /></Arrive>}
                {state.item.notes && (
                    <Arrive from={impact}>
                        <p className="text-xs font-semibold text-[#0c1820] mb-1.5">Notes</p>
                        <p className="px-3.5 py-2.5 text-sm rounded-xl bg-[#f5fafc]/85 border border-white/90 text-[#0c1820] whitespace-pre-wrap break-words">{state.item.notes}</p>
                    </Arrive>
                )}
                <Arrive from={impact}>
                    {state.mode === 'views'
                        ? <ViewsRow total={left + 1} left={left} label={left ? `${plural(left)}. That one was used.` : 'That was the last view.'} />
                        : timerRow(state, dry)}
                </Arrive>
                <Arrive from={impact} as="p" className="text-xs text-[#3a5566] leading-relaxed">
                    {state.mode === 'timer' && 'Opening this link again costs nothing until it ends. '}This page keeps the login in memory only: it is gone when you leave, so copy what you need now.
                </Arrive>
            </div>
        );
    } else if (status === 'gone' || status === 'broken') {
        const [title, text] = status === 'gone' ? GONE[why] : ['This link is incomplete', 'The part after the # is missing or was changed. Ask the sender to send the whole link again.'];
        body = (
            <div className="text-center">
                <Arrive from={impact} className={`${tile} mx-auto`}><Link2Off className="w-6 h-6" /></Arrive>
                <Arrive from={impact} as="h1" className="text-2xl font-bold text-[#0c1820]">{title}</Arrive>
                <Arrive from={impact} as="p" className="text-sm text-[#3a5566] mt-2">{text}</Arrive>
            </div>
        );
    } else {
        body = (
            <div>
                <div className={tile}><Gift className="w-6 h-6" /></div>
                <h1 className="text-2xl font-bold text-[#0c1820]">Someone dropped a login for you</h1>
                <p className="text-sm text-[#3a5566] mt-1.5">
                    It is encrypted, and only this link can open it. If the sender limited its views, revealing it uses one, so press Reveal when you are ready to copy what you need.
                </p>
                {ruleRow && <div className="mt-4">{ruleRow}</div>}
                {status === 'error' && <p role="alert" className="mt-3 text-sm text-rose-700">{state.error}</p>}
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={reveal}
                    disabled={opening}
                    className="mt-6 w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#0284c7] to-[#0077b6] hover:from-[#0369a1] hover:to-[#005f92] rounded-xl shadow-md shadow-[#0284c7]/25 disabled:opacity-70 cursor-pointer"
                >
                    {opening ? 'Opening...' : 'Reveal login'}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {gridMounted && (
                <motion.div
                    aria-hidden="true"
                    className="fixed inset-0 z-0 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: gridOn ? 1 : 0 }}
                    transition={{ duration: 0.6 }}
                    onAnimationComplete={() => { if (!gridOn) setGridMounted(false); }}
                >
                    <RippleGrid color="#0284c7" lightMode cellSize={44} rippleStrength={1.5} glow={0.6} fade={0.35} autoRipple="none" mouseInteraction={false} intro={false} />
                </motion.div>
            )}
            <div ref={cardRef} className={`${card} relative z-10`}>
                <MorphHeight animated={animated} innerClassName={leaving ? 'opacity-0 blur-[3px] transition-[opacity,filter] duration-200 pointer-events-none' : ''}>
                    {body}
                </MorphHeight>
            </div>
        </div>
    );
}
