import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import LockScreen from './LockScreen';
import { useTide } from '../context/useTide';
import { CHECKING_CAP, POOL_LEVEL, frostMask, patchRadius, warm } from '../lib/frost';
import '../styles/frost.css';

const FREEZE_MS = 1100;
const THAW_MS = 1100;
const GLIDE_S = 0.45; // how quickly the frost follows its target
const WRONG_PAUSE_MS = 1200;

const animates = () =>
    typeof Element !== 'undefined' && 'animate' in Element.prototype &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => k * k * (3 - 2 * k);

/**
 * The vault while it is frozen: frost over the page, with the lock card on top.
 *
 *   mounted        frost grows in from the edges, then the card appears
 *   typing         a clear patch opens around the password field and widens with every key (never shrinks);
 *                  the tide's water rises on the first key and beads run down into it
 *   wrong password the frost pauses for a moment; the water stays where it is (water going down reads as signing out)
 *   unlocked       the water floods, the frost clears, then onGone() lets the page surface (Manager releases the water)
 */
export default function FrozenVault({ unlocked, onGone }) {
    const tide = useTide();
    const tideRef = useRef(tide);
    tideRef.current = tide;
    const paneRef = useRef(null);
    const beadsRef = useRef(null);
    const cardRef = useRef(null);
    const [cardShown, setCardShown] = useState(false);
    // progress (cur) glides toward its target (tgt); busy means a scripted tween owns it
    const eng = useRef({ cur: 1, tgt: 0, tweenId: 0, busy: false, stallUntil: 0, keys: 0, begun: false, thawing: false, timers: [] });

    const geometry = () => {
        const size = { w: window.innerWidth, h: window.innerHeight };
        const r = cardRef.current?.querySelector('input')?.getBoundingClientRect();
        const center = r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: size.w / 2, y: size.h / 2 };
        return { center, size };
    };
    const draw = () => {
        const pane = paneRef.current;
        if (!pane) return;
        const { center, size } = geometry();
        const mask = frostMask(eng.current.cur, center, size);
        pane.style.maskImage = mask;
        pane.style.webkitMaskImage = mask;
    };
    const tween = (to, ms, easing) => new Promise((resolve) => {
        const e = eng.current, id = ++e.tweenId;
        if (!animates()) { e.cur = to; e.tgt = to; e.busy = false; draw(); resolve(); return; }
        e.busy = true;
        const from = e.cur, t0 = performance.now();
        const step = (now) => {
            if (id !== e.tweenId) { resolve(); return; }
            const k = Math.min(1, (now - t0) / ms);
            e.cur = from + (to - from) * easing(k);
            draw();
            if (k < 1) requestAnimationFrame(step); else { e.tgt = to; e.busy = false; resolve(); }
        };
        requestAnimationFrame(step);
    });

    // frost grows in from the edges, then the card appears
    useLayoutEffect(() => {
        const e = eng.current;
        let alive = true;
        e.cur = 1; e.tgt = 0; draw();
        if (!animates()) { e.cur = 0; draw(); setCardShown(true); return undefined; }
        tween(0, FREEZE_MS, easeOut).then(() => { if (alive) setCardShown(true); });
        return () => { alive = false; e.tweenId += 1; e.busy = false; };
    }, []);

    useEffect(() => {
        if (!cardShown) return;
        if (animates()) cardRef.current?.animate(
            [{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }],
            { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
        cardRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, [cardShown]);

    // between scripted moves the frost glides toward its target
    useEffect(() => {
        if (!animates()) return undefined;
        let raf, last = performance.now();
        const loop = (now) => {
            const e = eng.current, dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const d = e.tgt - e.cur;
            if (!e.busy && !e.thawing && now >= e.stallUntil && Math.abs(d) > 1e-4) { e.cur += d * (1 - Math.exp(-dt / GLIDE_S)); draw(); }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    // forgets pending beads and, if the user leaves while the water is up, clears it
    useEffect(() => () => {
        const e = eng.current;
        e.timers.forEach(clearTimeout);
        beadsRef.current?.replaceChildren();
        if (e.begun && !e.thawing) tideRef.current.abort();
    }, []);

    const startWater = () => {
        const e = eng.current;
        if (!e.begun) { e.begun = true; tideRef.current.begin(); }
    };

    // a bead gathers on the rim of the clear patch and runs down in short lurches to the water
    const spawnBead = () => {
        const host = beadsRef.current;
        if (!host || host.children.length > 7) return;
        const { center, size } = geometry();
        const r = patchRadius(eng.current.cur, center, size) * 0.92, a = Math.PI * (0.1 + Math.random() * 0.8);
        const x = Math.max(16, Math.min(size.w - 16, center.x + Math.cos(a) * r * 1.5)), y = Math.max(80, center.y - Math.sin(a) * r * 0.55 + 10);
        const end = size.h - POOL_LEVEL * (size.h + 46) + 14;
        if (y > end - 24) return;
        const el = document.createElement('i'), d = end - y, s = 0.7 + Math.random() * 0.5, at = (dy, sy = s) => `translate(${x}px,${y + dy}px) scale(${s},${sy})`;
        el.className = 'frost-bead';
        host.appendChild(el);
        const anim = el.animate([
            { transform: at(0, s * 0.6), opacity: 0 }, { transform: at(0), opacity: 1, offset: 0.12 }, { transform: at(d * 0.1, s * 1.3), offset: 0.2 },
            { transform: at(d * 0.12), offset: 0.34 }, { transform: at(d * 0.55, s * 1.35), offset: 0.55 }, { transform: at(d * 0.58), offset: 0.66 },
            { transform: at(d, s * 1.4), opacity: 1 }
        ], { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
        anim.finished.then(() => el.remove(), () => el.remove());
    };

    const onTyping = (length) => {
        const e = eng.current, added = length - e.keys;
        e.keys = length;
        if (added <= 0 || e.thawing) return; // deleting takes nothing back
        startWater();
        e.tgt = warm(e.tgt, added);
        if (!animates()) { e.cur = e.tgt; draw(); return; }
        for (let i = 0; i < added; i += 1) e.timers.push(setTimeout(spawnBead, 120 + Math.random() * 500));
    };
    const onChecking = () => {
        const e = eng.current;
        startWater();
        e.tgt = Math.max(e.tgt, CHECKING_CAP); // the check takes a moment: the patch opens a little further
        if (!animates()) { e.cur = e.tgt; draw(); }
    };
    const onWrong = () => { eng.current.stallUntil = performance.now() + WRONG_PAUSE_MS; };
    // the entrance is queued before the vault key is stored, so the page behind is hidden until it surfaces
    const onBeforeUnlock = () => { startWater(); tideRef.current.queueEntrance(); };

    // unlocked: the water floods and the frost clears; then the page surfaces
    useEffect(() => {
        if (!unlocked) return undefined;
        const e = eng.current;
        let alive = true;
        e.thawing = true;
        if (animates()) cardRef.current?.animate(
            [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-30px) scale(.96)' }],
            { duration: 560, delay: 120, easing: 'ease', fill: 'forwards' }
        );
        const flood = tideRef.current.peekEntrance() ? tideRef.current.complete() : Promise.resolve();
        Promise.all([tween(1.02, THAW_MS, easeInOut), flood]).then(() => {
            if (!alive) return;
            if (!tideRef.current.peekEntrance() && e.begun) tideRef.current.release(); // nobody else will clear it
            onGone?.();
        });
        return () => { alive = false; };
    }, [unlocked]);

    return (
        <>
            <div className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true">
                <div ref={paneRef} className="frost-pane"><div className="frost-rim" /></div>
                <div ref={beadsRef} className="absolute inset-0 overflow-hidden" />
            </div>
            <div ref={cardRef} className={`fixed inset-x-0 top-16 bottom-0 z-[26] overflow-y-auto ${cardShown ? '' : 'opacity-0'}`}>
                <LockScreen onTyping={onTyping} onChecking={onChecking} onWrong={onWrong} onBeforeUnlock={onBeforeUnlock} />
            </div>
        </>
    );
}
