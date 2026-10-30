import { useEffect, useRef } from 'react';

// Open modals, oldest first. Esc closes only the newest one, so a dialog opened on top of another
// closes first.
const openModals = [];

/**
 * Calls `onClose` when Escape is pressed while the modal is open. Does the same thing as
 * clicking the backdrop, so pass the same close function.
 */
export default function useEscapeKey(isOpen, onClose) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!isOpen) return undefined;

        const token = {};
        openModals.push(token);

        const onKeyDown = (e) => {
            if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
            if (openModals[openModals.length - 1] !== token) return;
            closeRef.current?.();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            const at = openModals.indexOf(token);
            if (at !== -1) openModals.splice(at, 1);
        };
    }, [isOpen]);
}
