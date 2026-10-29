import { useCallback, useMemo, useRef } from 'react';
import { TideContext } from './useTide';
import '../styles/tide.css';

const WAVE_HEIGHT = 46; // must match .tide-wave in tide.css
const ENTRANCE_FAILSAFE_MS = 5000;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Timers (not animation.finished) drive sequencing so it still resolves in throttled tabs.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Water-level transition used by the auth screens.
 *
 *   tide.begin()           water rises to ~36% behind the form while the server checks credentials
 *   tide.complete()        success: floods to the top (resolves when full)
 *   tide.cancel()          failure: water recedes (~1s), resolves when empty
 *   tide.abort()           instantly resets (e.g. the user left the page mid-request)
 *   tide.release()         fades the water out, revealing the page underneath
 *   tide.shake(el)         horizontal error shake for an element
 *   tide.leave(el)         lifts an element away as the water floods
 *
 * Hand-off to the vault after a successful login/signup:
 *   tide.queueEntrance()   called just before navigating to the vault
 *   tide.peekEntrance()    the vault checks whether it should play its entrance animation
 *   tide.finishEntrance()  the vault reports it has finished
 * While an entrance is queued the water stays up; the vault calls release() once its data is
 * ready. A failsafe releases the water if the vault never picks the entrance up.
 */
export function TideProvider({ children }) {
    const rootRef = useRef(null);
    const moveAnim = useRef(null);
    const fadeAnim = useRef(null);
    const run = useRef(0);
    const apiRef = useRef(null);
    const entrance = useRef({ queued: false, timer: null });

    const currentY = () =>
        new DOMMatrixReadOnly(getComputedStyle(rootRef.current).transform).m42;

    // level 0: parked fully below the viewport; level 1: wave just above the top edge
    const yForLevel = (level) => window.innerHeight - level * (window.innerHeight + WAVE_HEIGHT);

    // Animate from wherever the water currently is, so an early server reply never jumps.
    const move = useCallback((level, duration, easing) => {
        const el = rootRef.current;
        if (!el) return Promise.resolve();

        const from = currentY();
        const ms = prefersReducedMotion() ? 1 : duration;

        moveAnim.current?.cancel();
        moveAnim.current = el.animate(
            [
                { transform: `translateY(${from}px)` },
                { transform: `translateY(${yForLevel(level)}px)` }
            ],
            { duration: ms, easing, fill: 'forwards' }
        );
        return wait(ms);
    }, []);

    const reset = useCallback(() => {
        moveAnim.current?.cancel();
        fadeAnim.current?.cancel();
        moveAnim.current = null;
        fadeAnim.current = null;
    }, []);

    const api = useMemo(
        () => ({
            begin() {
                run.current += 1;
                fadeAnim.current?.cancel();
                fadeAnim.current = null;
                move(0.36, 650, 'cubic-bezier(.2,.7,.3,1)');
            },

            async complete() {
                await move(1, 850, 'cubic-bezier(.65,0,.25,1)');
            },

            async cancel() {
                await move(0, 1000, 'cubic-bezier(.45,.05,.35,1)');
            },

            async release() {
                const id = run.current;
                const el = rootRef.current;
                if (!el) return;

                const ms = prefersReducedMotion() ? 1 : 600;
                fadeAnim.current = el.animate([{ opacity: 1 }, { opacity: 0 }], {
                    duration: ms,
                    easing: 'ease',
                    fill: 'forwards'
                });
                await wait(ms);
                // a new begin() during the fade means the layer is in use again
                if (run.current === id) reset();
            },

            abort() {
                run.current += 1;
                reset();
            },

            queueEntrance() {
                clearTimeout(entrance.current.timer);
                entrance.current.queued = true;
                entrance.current.timer = setTimeout(() => {
                    entrance.current.queued = false;
                    apiRef.current?.release();
                }, ENTRANCE_FAILSAFE_MS);
            },

            peekEntrance() {
                return entrance.current.queued;
            },

            finishEntrance() {
                clearTimeout(entrance.current.timer);
                entrance.current.queued = false;
            },

            shake(el) {
                if (!el || prefersReducedMotion()) return;
                el.animate(
                    [
                        { transform: 'translateX(0)' },
                        { transform: 'translateX(-7px)' },
                        { transform: 'translateX(7px)' },
                        { transform: 'translateX(-7px)' },
                        { transform: 'translateX(7px)' },
                        { transform: 'translateX(0)' }
                    ],
                    { duration: 400, easing: 'ease-in-out' }
                );
            },

            leave(el) {
                if (!el || prefersReducedMotion()) return;
                el.animate(
                    [
                        { opacity: 1, transform: 'none' },
                        { opacity: 0, transform: 'translateY(-34px) scale(0.96)' }
                    ],
                    { duration: 600, delay: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
                );
            }
        }),
        [move, reset]
    );

    apiRef.current = api;

    return (
        <TideContext.Provider value={api}>
            {children}
            <div ref={rootRef} className="tide-root" aria-hidden="true">
                <div className="tide-wave">
                    <i />
                    <i className="tide-wave-back" />
                </div>
                <div className="tide-water" />
            </div>
        </TideContext.Provider>
    );
}
