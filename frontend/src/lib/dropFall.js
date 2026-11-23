// A full blue drop leaves the rule of a drop (a drop of the views row, or the bigger timer drop), falls out of the card and rings
// spread where it lands: the receiver's version of the moment a drop is used. It is plain DOM animation (the ripple across the page
// is the RippleGrid, started by the caller). Where animation is not wanted or not there (reduced motion, a test browser) nothing plays.
import { DROP_PATHS } from './logo';
import { dropIsInstant } from './dropIn';

/** True when the release will play. */
export const canRelease = () => typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function' && !dropIsInstant();

const ring = (x, y) => {
    const el = document.createElement('div');
    el.className = 'fall-ring';
    el.style.cssText = `left:${x}px;top:${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
};

/**
 * `x` is the middle of where the drop leaves and `bottom` the lowest point of the drop that leaves; `grow` makes it come out
 * of a bigger drop (it starts small). `floorY` is where it lands. Resolves with { x, y } at the landing, as the rings start.
 */
export function releaseDrop({ x, bottom, floorY, grow = false }) {
    return new Promise((resolve) => {
        const drop = document.createElement('div');
        drop.className = 'fall-drop';
        drop.style.cssText = `left:${x - 10}px;top:${bottom - 24}px`;
        drop.innerHTML = `<svg viewBox="0 0 44 50" width="20" height="24" style="overflow:visible"><defs><linearGradient id="fall-g" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#0077b6"/><stop offset="1" stop-color="#0284c7"/></linearGradient></defs><path d="${DROP_PATHS.primary}" fill="url(#fall-g)"/></svg>`;
        document.body.appendChild(drop);
        const spot = { x, y: floorY - 14 }, dist = floorY - bottom, fall = Math.sqrt((2 * Math.max(dist, 1)) / 2600) * 1000;
        drop.animate([
            { transform: `translateY(0) scale(${grow ? '.45,.45' : '1,1'})` },
            { transform: 'translateY(-4px) scale(.92,1.16)', offset: 0.2 },
            { transform: `translateY(${dist}px) scale(.82,1.45)` }
        ], { duration: 220 + fall, easing: 'cubic-bezier(.4,0,.85,.45)', fill: 'forwards' }).onfinish = () => {
            drop.remove();
            for (const delay of [0, 140]) setTimeout(() => ring(spot.x, spot.y), delay);
            resolve(spot);
        };
    });
}
