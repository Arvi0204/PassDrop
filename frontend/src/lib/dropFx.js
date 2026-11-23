// The drop animation of the Drop dialog, drawn on one canvas above it.
//   1. the logo's two drops condense in the air above the button and hang there until the link exists
//   2. the first lets go, the second a beat later; each stretches as it speeds up
//   3. each lands on the button's edge: it flattens, throws up a crown of beads, sends out two rings, the button dips and
//      flashes, and `onHit` says where, so the page can start a ripple in the grid behind the dialog
// If the link cannot be made, the drops just fade away. Reduced motion, or no Path2D (a test browser): nothing is played.
import { DROP_PATHS, LOGO_COLORS } from './logo';
import { dropIsInstant } from './dropIn';

const DROP = {
    size: 1.05,      // logo units to pixels
    gravity: 2600,   // px/s²
    formMs: 320,     // how long the logo takes to condense
    releaseMs: 440,  // earliest moment the first drop lets go (later if the link is not ready yet)
    gapMs: 140       // the second lets go this much later
};

/** True when the animation will play: not with reduced motion, and only where the canvas can draw it. */
export const canPlayDrop = () => typeof Path2D !== 'undefined' && !dropIsInstant();

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.9 * Math.pow(t - 1, 3) + 1.9 * Math.pow(t - 1, 2);

// the logo's two drops in its own 60 x 60 box; each is drawn about its own base point
const shapes = () => [
    { path: new Path2D(DROP_PATHS.primary), cx: 22, base: 48, r: 18, box: [7.6, 2, 36.4, 48], colors: LOGO_COLORS.primary, alpha: 1, rgb: '2,132,199', bead: '#0284c7', crown: 7, reach: 150, strength: 1.5 },
    { path: new Path2D(DROP_PATHS.secondary), cx: 40, base: 56, r: 16, box: [27.2, 16, 52.8, 56], colors: LOGO_COLORS.secondary, alpha: 0.92, rgb: '0,168,204', bead: '#00a8cc', crown: 4, reach: 105, strength: 0.9 }
];

/**
 * Plays it. `to` is the button the drops land on. `released` is a promise: true when the link exists (the drops let go), false
 * when it could not be made (they fade). `onHit({ x, y })` fires for each landing, `onLand()` at the first, and `onEnd(aborted)`
 * when everything has finished. Returns { stop() }, which cancels it without any callback.
 */
export function playDrop({ canvas, to, released, onHit, onLand, onEnd, lift = 130 }) {
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * DPR);
    canvas.height = Math.round(innerHeight * DPR);

    const logo = shapes();
    const b = to.getBoundingClientRect();
    const k = DROP.size, LX = b.left + b.width / 2, impactY = b.top + 3, LY = Math.max(40, impactY - lift);
    const t0 = performance.now();
    const drops = logo.map((L, i) => ({ L, i, x: LX + (L.cx - 30) * k, y: LY + (L.base - 30) * k, vy: 0, phase: 'form', delay: i * 70, hitAt: 0 }));
    const beads = [], rings = [], flares = [], pings = [{ x: LX, y: LY, born: t0 }];
    let last = t0, hits = 0, raf = 0, stopped = false, okAt = Infinity, abortAt = 0;

    released.then((ok) => { if (ok) okAt = performance.now() - t0; else abortAt = performance.now(); });

    // a drop of water: the logo shape with a body, not a flat sticker
    function drawDrop(L, x, y, s, sx, sy, alpha) {
        const cy = L.base - L.r;
        ctx.save();
        ctx.globalAlpha = alpha * L.alpha;
        ctx.translate(x, y); ctx.scale(sx, sy);                    // stretch and squash about the base
        ctx.translate(0, -L.r * k); ctx.scale(k * s, k * s);       // grow about the middle
        ctx.translate(-L.cx, -cy);
        const g = ctx.createLinearGradient(L.box[0], L.box[1], L.box[2], L.box[3]);
        g.addColorStop(0, L.colors[0]); g.addColorStop(1, L.colors[1]);
        ctx.shadowColor = `rgba(${L.rgb},.4)`; ctx.shadowBlur = 16 * DPR; ctx.shadowOffsetY = 3 * DPR;
        ctx.fillStyle = g; ctx.fill(L.path);
        ctx.shadowColor = 'transparent';
        ctx.clip(L.path);
        // light from the upper left
        ctx.save(); ctx.translate(L.cx - L.r * 0.4, cy - L.r * 0.46); ctx.rotate(-0.5); ctx.scale(0.6, 1);
        let h = ctx.createRadialGradient(0, 0, 0, 0, 0, L.r * 0.44);
        h.addColorStop(0, 'rgba(255,255,255,.9)'); h.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = h; ctx.fillRect(-L.r, -L.r, L.r * 2, L.r * 2); ctx.restore();
        // light bent through the water, pooled low on the far side
        h = ctx.createRadialGradient(L.cx + L.r * 0.15, L.base - L.r * 0.12, 0, L.cx + L.r * 0.15, L.base - L.r * 0.12, L.r * 0.9);
        h.addColorStop(0, 'rgba(255,255,255,.36)'); h.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = h; ctx.fillRect(L.cx - L.r * 2, cy - L.r * 2, L.r * 4, L.r * 4);
        // a thin dark edge so it reads as a body
        ctx.strokeStyle = 'rgba(0,50,100,.3)'; ctx.lineWidth = 1.6; ctx.stroke(L.path);
        ctx.restore();
    }

    // a bead thrown up by the landing, stretched along its direction of travel
    function drawBead(p, a) {
        const stretch = 1 + Math.min(Math.hypot(p.vx, p.vy) / 700, 0.9);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.globalAlpha = a;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.r * stretch, p.r / Math.sqrt(stretch), 0, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(-p.r * 0.25, -p.r * 0.3, p.r * 0.3, 0, 6.2832); ctx.fill();
        ctx.restore();
    }

    const hit = (d, now) => {
        const L = d.L, small = L.crown < 6 ? 0.8 : 1; // the second drop is smaller, so its crown is
        d.phase = 'hit'; d.hitAt = now; d.y = impactY;
        for (let i = 0; i < L.crown; i++) {
            const spread = (i + 0.5) / L.crown, ang = -Math.PI * (0.2 + 0.6 * spread) + (Math.random() - 0.5) * 0.16; // a fan thrown up, not sideways
            const sp = (300 + 190 * Math.sin(Math.PI * spread)) * (0.8 + Math.random() * 0.4) * small;
            beads.push({ x: d.x + Math.cos(ang) * 6, y: impactY - 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: (1.9 + Math.random() * 1.6) * small, born: now, color: L.bead });
        }
        [0, 150].forEach((delay, j) => rings.push({ x: d.x, born: now + delay, reach: L.reach * (1 - j * 0.3), rgb: L.rgb, w: 1.8 - j * 0.6 })); // two rings: the grid carries the rest
        flares.push({ x: d.x, born: now, amp: L.strength / 1.5 });
        to.animate?.([{ transform: 'none' }, { transform: `translateY(${(2.4 * L.strength) / 1.5}px) scale(.99,.972)`, offset: 0.22 }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' });
        onHit?.({ x: d.x, y: impactY });
        if (hits++ === 0) onLand?.();
    };

    const frame = (now) => {
        raf = 0;
        if (stopped) return;
        const dt = Math.min(0.034, (now - last) / 1000); last = now;
        const t = now - t0;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
        const bb = to.isConnected ? to.getBoundingClientRect() : null;

        for (let i = flares.length - 1; i >= 0; i--) { // a flash inside the button where the drop landed
            const fl = flares[i], q = (now - fl.born) / 620;
            if (q >= 1) { flares.splice(i, 1); continue; }
            if (!bb) continue;
            const R = 20 + 110 * easeOutCubic(q), g = ctx.createRadialGradient(fl.x, impactY + 4, 0, fl.x, impactY + 4, R);
            g.addColorStop(0, `rgba(255,255,255,${0.6 * fl.amp * (1 - q)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.save(); ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bb.left, bb.top, bb.width, bb.height, 12); else ctx.rect(bb.left, bb.top, bb.width, bb.height);
            ctx.clip(); ctx.fillStyle = g; ctx.fillRect(bb.left, bb.top, bb.width, bb.height); ctx.restore();
        }
        for (let i = pings.length - 1; i >= 0; i--) { // one soft ping where the logo condenses
            const p = pings[i], q = (now - p.born) / 480;
            if (q >= 1) { pings.splice(i, 1); continue; }
            ctx.strokeStyle = `rgba(2,132,199,${0.5 * (1 - q)})`; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(p.x, p.y, 8 + 30 * easeOutCubic(q), 0, 6.2832); ctx.stroke();
        }
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i], q = (now - r.born) / 1150;
            if (q >= 1) { rings.splice(i, 1); continue; }
            if (q < 0) continue;
            ctx.strokeStyle = `rgba(${r.rgb},${0.6 * Math.pow(1 - q, 1.6)})`; ctx.lineWidth = r.w * (1 - q) + 0.5;
            ctx.beginPath(); ctx.arc(r.x, impactY, r.reach * easeOutCubic(q), 0, 6.2832); ctx.stroke();
        }
        for (let i = beads.length - 1; i >= 0; i--) {
            const p = beads[i], age = now - p.born;
            p.vy += 2000 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            if (age > 900 || (p.vy > 0 && p.y > impactY + 2)) { beads.splice(i, 1); continue; }
            drawBead(p, age < 600 ? 1 : 1 - (age - 600) / 300);
        }
        for (const d of drops) {
            if (d.phase === 'done') continue;
            const appear = clamp01((t - d.delay) / DROP.formMs);
            if (appear <= 0) continue;
            let s = easeOutBack(appear), sx = 1, sy = 1, a = clamp01(appear * 3);
            if (d.phase === 'form') {
                const release = Math.max(DROP.releaseMs, okAt) + d.i * DROP.gapMs; // never before the link exists
                if (appear >= 1) sy = 1 + 0.025 * Math.sin(t / 160 + d.i);          // hanging, breathing
                const q = clamp01((t - (release - 110)) / 110);                      // a hair of stretch before it lets go
                sy += 0.14 * q; sx = 1 - 0.06 * q;
                if (t >= release) d.phase = 'fall';
                if (abortAt) {                                                       // no link: the drop fades away
                    const f = clamp01((now - abortAt) / 240);
                    a *= 1 - f; s *= 1 - 0.15 * f;
                    if (f >= 1) d.phase = 'done';
                }
            } else if (d.phase === 'fall') {
                d.vy += DROP.gravity * dt; d.y += d.vy * dt;
                sy = 1 + Math.min(0.5, d.vy / 2200); sx = 1 / Math.sqrt(sy);        // stretched by its own speed
                if (d.y >= impactY) hit(d, now);
            }
            if (d.phase === 'hit') {                                                 // flattens into the surface
                const q = clamp01((now - d.hitAt) / 90);
                sy = 1 - 0.82 * q; sx = 1 + 0.75 * q; a = 1 - q;
                if (q >= 1) d.phase = 'done';
            }
            if (d.phase !== 'done') drawDrop(d.L, d.x, d.y, s, sx, sy, a);
        }

        const alive = drops.some((d) => d.phase !== 'done') || beads.length || rings.length || flares.length || pings.length;
        if (alive) raf = requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, innerWidth, innerHeight); onEnd?.(!hits); }
    };
    raf = requestAnimationFrame(frame);

    return { stop() { stopped = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, innerWidth, innerHeight); } };
}
