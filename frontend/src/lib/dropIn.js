// A water drop (the PassDrop mark) that flies from one element to a point, then ripples where it lands.
// Used by the generator: ticking "Include symbols" carries symbol characters into the preview.

import dropUrl from '../assets/drop.svg';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the drop animation will be skipped. */
export const dropIsInstant = prefersReducedMotion;

/**
 * Flies a drop from `fromEl` into `targetEl` (a password preview or field), landing a little
 * in from its left edge where the characters start.
 */
export function flyDropInto(fromEl, targetEl, onLand) {
    if (!targetEl) {
        onLand();
        return;
    }
    const box = targetEl.getBoundingClientRect();
    flyDrop(fromEl, { x: box.left + Math.min(box.width, 260) * 0.55, y: box.top + box.height / 2 }, onLand);
}

/**
 * Flies a drop from the centre of `fromEl` to `toPoint` ({ x, y } in viewport pixels) and calls
 * `onLand` when it arrives. With reduced motion it lands immediately, with no flight.
 */
export function flyDrop(fromEl, toPoint, onLand) {
    if (!fromEl || prefersReducedMotion()) {
        onLand();
        return;
    }

    const box = fromEl.getBoundingClientRect();
    const start = { x: box.left + box.width / 2, y: box.top + box.height / 2 };

    const fly = document.createElement('div');
    fly.className = 'pw-fly';
    const img = document.createElement('img');
    img.src = dropUrl;
    img.alt = '';
    fly.appendChild(img);
    document.body.appendChild(fly);

    const midX = (start.x + toPoint.x) / 2 + 30;
    const midY = Math.min(start.y, toPoint.y) - 30;

    const flight = fly.animate(
        [
            { transform: `translate(${start.x - 8}px, ${start.y - 10}px) scale(0.7)`, opacity: 0.9 },
            { transform: `translate(${midX - 8}px, ${midY - 10}px) scale(1.05)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${toPoint.x - 8}px, ${toPoint.y - 10}px) scale(0.6)`, opacity: 1 }
        ],
        { duration: 430, easing: 'cubic-bezier(.45,0,.55,1)' }
    );

    flight.onfinish = () => {
        fly.remove();
        onLand();

        const splash = document.createElement('div');
        splash.className = 'pw-splash';
        splash.style.left = `${toPoint.x}px`;
        splash.style.top = `${toPoint.y}px`;
        document.body.appendChild(splash);
        splash.animate(
            [
                { transform: 'scale(0.4)', opacity: 1 },
                { transform: 'scale(3.6)', opacity: 0 }
            ],
            { duration: 540, easing: 'cubic-bezier(.2,.7,.3,1)' }
        ).onfinish = () => splash.remove();
    };
}
