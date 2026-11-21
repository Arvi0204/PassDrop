import { useCallback, useMemo, useRef, useState } from 'react';
import PassDropLogo from '../components/common/PassDropLogo';
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
 *   tide.rise(level)       water glides to `level` (0..1 of the screen); call it again to raise it further
 *   tide.complete()        success: floods to the top (resolves when full)
 *   tide.cancel()          failure: water recedes (~1s), resolves when empty
 *   tide.abort()           instantly resets (e.g. the user left the page mid-request)
 *
 * Logout is the vault being drained, like pulling the plug on a full tub:
 *   tide.fillIn()          the water fades in behind the logout confirmation dialog
 *   tide.fadeOut()         the user cancelled the dialog: the water fades away again
 *   tide.drain()           the user confirmed: the level falls, flat, revealing the login page
 *   tide.release()         fades the water out, revealing the page underneath
 *   tide.welcome(title, subtitle)  shows a message over the full water (used after signup) and
 *                          resolves once it has had time to be read; release() fades it with the water
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
    const logoutActive = useRef(false); // true from the dialog opening until the water has gone
    const apiRef = useRef(null);
    const entrance = useRef({ queued: false, timer: null });
    const [message, setMessage] = useState(null); // { title, subtitle, visible }

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
        rootRef.current?.classList.remove('tide-over');
        setMessage(null);
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

            // the locked vault raises the water a little with each key, so it climbs instead of jumping
            rise(level) {
                run.current += 1;
                fadeAnim.current?.cancel();
                fadeAnim.current = null;
                move(level, 700, 'cubic-bezier(.3,.6,.4,1)');
            },

            async complete() {
                await move(1, 850, 'cubic-bezier(.65,0,.25,1)');
            },

            async cancel() {
                await move(0, 1000, 'cubic-bezier(.45,.05,.35,1)');
            },

            async release() {
                setMessage((m) => (m ? { ...m, visible: false } : m)); // the message leaves with the water
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

            // Signup: once the water has flooded the screen, greet the user in the animation itself
            // instead of in a corner toast.
            async welcome(title, subtitle) {
                setMessage({ title, subtitle, visible: false });
                await wait(30); // let it mount hidden, then fade it in
                setMessage((m) => (m ? { ...m, visible: true } : m));
                await wait(prefersReducedMotion() ? 600 : 1300); // fade-in plus time to read it
            },

            abort() {
                // a logout in progress owns the water; the login page mounting must not cut it short
                if (logoutActive.current) return;
                run.current += 1;
                reset();
            },

            async fillIn() {
                const el = rootRef.current;
                if (!el) return;

                logoutActive.current = true;
                run.current += 1;
                moveAnim.current?.cancel();
                fadeAnim.current?.cancel();
                el.classList.add('tide-over'); // above the navbar and the login card, below the dialog

                // pinned at full level, then faded in while the user reads the dialog
                moveAnim.current = el.animate(
                    [{ transform: `translateY(${yForLevel(1)}px)` }],
                    { duration: 1, fill: 'forwards' }
                );
                const ms = prefersReducedMotion() ? 1 : 450;
                fadeAnim.current = el.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: ms,
                    easing: 'ease',
                    fill: 'forwards'
                });
                await wait(ms);
            },

            async fadeOut() {
                const el = rootRef.current;
                if (!el) return;

                const from = Number(getComputedStyle(el).opacity);
                const ms = prefersReducedMotion() ? 1 : 350;
                fadeAnim.current?.cancel();
                fadeAnim.current = el.animate([{ opacity: from }, { opacity: 0 }], {
                    duration: ms,
                    easing: 'ease',
                    fill: 'forwards'
                });
                await wait(ms);
                logoutActive.current = false;
                reset();
            },

            async drain() {
                // fast at first, easing out: a draining tub empties quickly, then trickles
                await move(0, 900, 'cubic-bezier(.2,.6,.55,.88)');
                logoutActive.current = false;
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
            {/* outside the aria-hidden water layer so screen readers hear it */}
            <div className={`tide-message${message?.visible ? ' show' : ''}`} role="status" aria-live="polite">
                {message && (
                    <>
                        <PassDropLogo size={56} />
                        <h2>{message.title}</h2>
                        {message.subtitle && <p>{message.subtitle}</p>}
                    </>
                )}
            </div>
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
