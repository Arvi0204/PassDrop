import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import Generator from './Generator';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe('copying the generated password', () => {
    it('says it copied, and closes the dialog, once the copy has worked', async () => {
        const user = userEvent.setup();
        const close = vi.fn();
        render(<Generator isOpen setIsGeneratorModalOpen={close} />);
        await user.click(screen.getByTitle('Copy password'));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied to clipboard!'));
        await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    });

    it('says so and stays open when the browser would not copy', async () => {
        const user = userEvent.setup();
        const close = vi.fn();
        render(<Generator isOpen setIsGeneratorModalOpen={close} />);
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
        await user.click(screen.getByTitle('Copy password'));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not copy')));
        await new Promise((resolve) => setTimeout(resolve, 800)); // longer than the 700 ms before it would have closed
        expect(toast.success).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
    });
});

describe('the generator dialog for a screen reader and the keyboard', () => {
    it('announces itself as a dialog named by its title, and takes focus', () => {
        render(<><button type="button">Behind the dialog</button><Generator isOpen setIsGeneratorModalOpen={() => {}} /></>);
        const dialog = screen.getByRole('dialog', { name: 'Password Generator' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('keeps Tab inside the dialog', async () => {
        const user = userEvent.setup();
        render(<><button type="button">Behind the dialog</button><Generator isOpen setIsGeneratorModalOpen={() => {}} /></>);
        const dialog = screen.getByRole('dialog');
        for (let i = 0; i < 20; i++) {
            await user.tab();
            expect(dialog.contains(document.activeElement), `Tab ${i + 1}`).toBe(true);
        }
    });
});
