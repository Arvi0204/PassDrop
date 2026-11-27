import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaultModal from './VaultModal';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const open = (initialData = null) => render(
    <>
        <button type="button">Behind the dialog</button>
        <VaultModal isOpen onClose={vi.fn()} onSave={vi.fn()} initialData={initialData} />
    </>
);

describe('VaultModal for a screen reader and the keyboard', () => {
    it('announces itself as a dialog named by its title', () => {
        open();
        expect(screen.getByRole('dialog', { name: 'New Vault Item' }).getAttribute('aria-modal')).toBe('true');
    });

    it('is named Edit Account when it edits a login', () => {
        open({ _id: 'a', title: 'GitHub', url: 'github.com', username: 'me', password: 'pw', notes: '' });
        expect(screen.getByRole('dialog', { name: 'Edit Account' })).toBeTruthy();
    });

    it('moves focus into the dialog, and keeps Tab inside it', async () => {
        const user = userEvent.setup();
        open();
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
        for (let i = 0; i < 25; i++) {
            await user.tab();
            expect(dialog.contains(document.activeElement), `Tab ${i + 1}`).toBe(true);
        }
    });
});
