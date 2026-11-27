import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmationModal from './ConfirmationModal';

const open = () => render(
    <>
        <button type="button">Behind the dialog</button>
        <ConfirmationModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} message="Delete everything?" confirmText="Yes, delete" />
    </>
);

describe('ConfirmationModal confirming', () => {
    it('disables Confirm while an async confirm runs, and enables it again after', async () => {
        const user = userEvent.setup();
        let finish;
        const onConfirm = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
        render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={onConfirm} message="Make a new key?" confirmText="Go" />);
        const go = screen.getByRole('button', { name: 'Go' });
        await user.click(go);
        await user.click(go);
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(go.disabled).toBe(true);
        await act(async () => finish());
        expect(go.disabled).toBe(false);
    });

    it('enables Confirm again when the confirm rejects', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn().mockRejectedValue(new Error('no'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={onConfirm} message="Make a new key?" confirmText="Go" />);
        await user.click(screen.getByRole('button', { name: 'Go' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Go' }).disabled).toBe(false));
        vi.restoreAllMocks();
    });

    it('works with a sync confirm, and Enter in a password field confirms', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmationModal isOpen onClose={vi.fn()} onConfirm={onConfirm} message="Sure?" confirmText="Go"><input type="password" aria-label="pw" /></ConfirmationModal>);
        await user.click(screen.getByRole('button', { name: 'Go' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        await user.type(screen.getByLabelText('pw'), 'x{Enter}');
        expect(onConfirm).toHaveBeenCalledTimes(2);
    });
});

describe('ConfirmationModal for a screen reader and the keyboard', () => {
    it('announces itself as a dialog named by its title', () => {
        open();
        const dialog = screen.getByRole('dialog', { name: 'Confirm Deletion' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('puts focus on Cancel, the safe choice, when it opens', () => {
        open();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });

    it('keeps Tab inside the dialog', async () => {
        const user = userEvent.setup();
        open();
        const dialog = screen.getByRole('dialog');
        for (let i = 0; i < 6; i++) {
            await user.tab();
            expect(dialog.contains(document.activeElement), `Tab ${i + 1}`).toBe(true);
        }
    });
});
