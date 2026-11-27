import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';

// The site's toasts: a frosted pane with a drop that lands in it and a line of water that drains as the toast runs out.
// Every toast.success / toast.error / toast.loading in the app comes through here, so one place sets how they look and where.

const NAVBAR = 64; // px: the sticky navbar's height (h-16), so a toast sits just under it and not over it
const WIDE = '(min-width: 640px)';

// a phone gets the toast centred at the top, where the thumb is not; a wider screen gets it at the top right
const useWide = () => {
    const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches);
    useEffect(() => {
        const query = window.matchMedia(WIDE);
        const update = () => setWide(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return wide;
};

const DROP = 'M12 2.5C12 2.5 5.5 10 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Z';

function Drop({ type }) {
    const kind = type === 'error' ? 'wt-error' : type === 'loading' ? 'wt-loading' : 'wt-success';
    return (
        <span className={`wt-drop ${kind}`} aria-hidden="true">
            <i className="wt-ring" />
            <svg viewBox="0 0 24 24"><path d={DROP} /></svg>
        </span>
    );
}

function WaterToast({ t }) {
    const timed = t.type !== 'loading' && Number.isFinite(t.duration);
    return (
        <div
            {...t.ariaProps}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`wt ${t.visible ? 'wt-in' : 'wt-out'} ${t.type === 'error' ? 'wt-is-error' : ''}`}
        >
            <Drop type={t.type} />
            <span className="wt-text">{resolveValue(t.message, t)}</span>
            {timed && <i className="wt-level" style={{ animationDuration: `${t.duration}ms` }} />}
        </div>
    );
}

export default function WaterToaster() {
    const wide = useWide();
    return (
        <Toaster
            position={wide ? 'top-right' : 'top-center'}
            gutter={10}
            containerStyle={{ top: NAVBAR + 8 }}
            toastOptions={{ duration: 4000, success: { duration: 3000 }, error: { duration: 4500 } }}
        >
            {(t) => <WaterToast t={t} />}
        </Toaster>
    );
}
