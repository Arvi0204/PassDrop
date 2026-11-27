import { useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While a dialog is open: moves keyboard focus into it (to the control marked data-autofocus, else the first
 * control, else the dialog itself), keeps Tab and Shift+Tab inside it, and gives focus back to what had it
 * before when the dialog closes. `ref` is the dialog's element, which needs tabIndex={-1}.
 */
export default function useDialogFocus(isOpen, ref) {
    useEffect(() => {
        const dialog = ref.current;
        if (!isOpen || !dialog) return undefined;

        const before = document.activeElement;
        const controls = () => [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
        (dialog.querySelector('[data-autofocus]') || controls()[0] || dialog).focus();

        const onKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            const items = controls();
            if (items.length === 0) {
                e.preventDefault();
                dialog.focus();
                return;
            }
            const inside = dialog.contains(document.activeElement) && document.activeElement !== dialog;
            const [first, last] = [items[0], items[items.length - 1]];
            if (e.shiftKey && (!inside || document.activeElement === first)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            if (before?.isConnected) before.focus();
        };
    }, [isOpen, ref]);
}
