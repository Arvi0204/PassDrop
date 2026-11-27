import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useDialogFocus from './useDialogFocus';

function Dialog({ children, onDone }) {
    const ref = useRef(null);
    useDialogFocus(true, ref);
    return <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>{children}<button type="button" onClick={onDone}>Done</button></div>;
}

function Bare() {
    const ref = useRef(null);
    useDialogFocus(true, ref);
    return <div ref={ref} role="dialog" aria-modal="true" aria-label="Bare dialog" tabIndex={-1}>Nothing to press here</div>;
}

function Page({ withControls = true, autofocus = false }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Open</button>
            <button type="button">Behind the dialog</button>
            {open && (
                <Dialog onDone={() => setOpen(false)}>
                    {withControls && <button type="button">First</button>}
                    {withControls && <button type="button" data-autofocus={autofocus ? '' : undefined}>Second</button>}
                </Dialog>
            )}
        </>
    );
}

describe('focus in a dialog', () => {
    it('moves into the dialog when it opens, to its first control', async () => {
        const user = userEvent.setup();
        render(<Page />);
        await user.click(screen.getByRole('button', { name: 'Open' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    });

    it('goes to the control marked data-autofocus when there is one', async () => {
        const user = userEvent.setup();
        render(<Page autofocus />);
        await user.click(screen.getByRole('button', { name: 'Open' }));
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Second' }));
    });

    it('stays inside: Tab from the last control goes to the first, Shift+Tab from the first to the last', async () => {
        const user = userEvent.setup();
        render(<Page />);
        await user.click(screen.getByRole('button', { name: 'Open' }));
        await user.tab(); // Second
        await user.tab(); // Done
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
        await user.tab(); // wraps
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
        await user.tab({ shift: true }); // wraps back
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
    });

    it('pulls focus back in when it has escaped to the page behind', async () => {
        const user = userEvent.setup();
        render(<Page />);
        await user.click(screen.getByRole('button', { name: 'Open' }));
        screen.getByRole('button', { name: 'Behind the dialog' }).focus();
        await user.tab();
        expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });

    it('gives focus back to the control that opened it when it closes', async () => {
        const user = userEvent.setup();
        render(<Page />);
        const opener = screen.getByRole('button', { name: 'Open' });
        await user.click(opener);
        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
    });

    it('keeps focus on the dialog itself when it has nothing to focus', async () => {
        const user = userEvent.setup();
        render(<><button type="button">Behind</button><Bare /></>);
        const dialog = screen.getByRole('dialog');
        expect(document.activeElement).toBe(dialog);
        await user.tab();
        expect(document.activeElement).toBe(dialog);
    });
});
