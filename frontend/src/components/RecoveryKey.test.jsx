import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecoveryKey from './RecoveryKey';

const KEY = '1A2B-3C4D-5E6F-7A8B-9C0D-1E2F-3A4B-5C6D';

afterEach(() => vi.restoreAllMocks());

describe('RecoveryKey', () => {
    it('shows the key and says what is lost without it', () => {
        render(<RecoveryKey recoveryKey={KEY} onContinue={() => {}} />);
        expect(screen.getByTestId('recovery-key').textContent).toBe(KEY);
        expect(screen.getByText(/shown once/)).toBeTruthy();
        expect(screen.getByText(/cannot be recovered by anyone, including PassDrop/)).toBeTruthy();
    });

    it('keeps Continue disabled until the box is ticked', async () => {
        const user = userEvent.setup();
        const onContinue = vi.fn();
        render(<RecoveryKey recoveryKey={KEY} onContinue={onContinue} />);
        const next = screen.getByRole('button', { name: /Continue/ });
        expect(next.disabled).toBe(true);
        await user.click(screen.getByRole('checkbox', { name: 'I have saved my recovery key' }));
        expect(next.disabled).toBe(false);
        await user.click(next);
        expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('copies the key', async () => {
        const user = userEvent.setup(); // installs a stand-in clipboard
        render(<RecoveryKey recoveryKey={KEY} onContinue={() => {}} />);
        await user.click(screen.getByRole('button', { name: /Copy/ }));
        expect(await navigator.clipboard.readText()).toBe(KEY);
        await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
    });

    it('offers the key as a .txt download', async () => {
        const user = userEvent.setup();
        let blob;
        URL.createObjectURL = vi.fn((b) => { blob = b; return 'blob:x'; });
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        render(<RecoveryKey recoveryKey={KEY} onContinue={() => {}} />);
        await user.click(screen.getByRole('button', { name: /Download/ }));
        expect(click).toHaveBeenCalledTimes(1);
        expect(click.mock.contexts[0].download).toBe('passdrop-recovery-key.txt');
        expect(await blob.text()).toContain(KEY);
    });
});

describe('RecoveryKey and the keyboard', () => {
    it('takes focus when it opens and keeps Tab inside it', async () => {
        const user = userEvent.setup();
        render(<><button type="button">Behind the dialog</button><RecoveryKey recoveryKey={KEY} onContinue={() => {}} /></>);
        const dialog = screen.getByRole('dialog', { name: 'Save your recovery key' });
        expect(dialog.contains(document.activeElement)).toBe(true);
        for (let i = 0; i < 10; i++) {
            await user.tab();
            expect(dialog.contains(document.activeElement), `Tab ${i + 1}`).toBe(true);
        }
    });
});
