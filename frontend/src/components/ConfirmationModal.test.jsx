import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmationModal from './ConfirmationModal';

const open = () => render(
    <>
        <button type="button">Behind the dialog</button>
        <ConfirmationModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} message="Delete everything?" confirmText="Yes, delete" />
    </>
);

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
