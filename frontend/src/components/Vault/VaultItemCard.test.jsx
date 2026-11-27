import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaultItemCard from './VaultItemCard';

const item = { _id: 'a', title: 'GitHub', url: 'github.com', username: 'me', password: 'pw-1' };
const show = (props = {}) => {
    const handlers = { onSelect: vi.fn(), onCopyUsername: vi.fn(), onCopyPassword: vi.fn() };
    const { container } = render(<VaultItemCard item={item} {...handlers} {...props} />);
    return { ...handlers, container };
};

describe('VaultItemCard from the keyboard', () => {
    it('can be reached by Tab, is named after the login, and opens with Enter or Space', async () => {
        const user = userEvent.setup();
        const { onSelect } = show();
        await user.tab();
        const card = screen.getByRole('button', { name: 'Open GitHub' });
        expect(document.activeElement).toBe(card);
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        expect(onSelect).toHaveBeenCalledTimes(2);
        expect(onSelect).toHaveBeenCalledWith(item);
    });

    it('Enter on a copy button copies and does not open the login', async () => {
        const user = userEvent.setup();
        const { onSelect, onCopyPassword } = show();
        await user.tab();
        await user.tab(); // username button
        await user.tab(); // password button
        expect(document.activeElement.title).toBe('Copy Password');
        await user.keyboard('{Enter}');
        expect(onCopyPassword).toHaveBeenCalledWith('pw-1');
        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe('VaultItemCard copy confirmation', () => {
    it('shows the check once the copy has worked', async () => {
        const user = userEvent.setup();
        const { container } = show({ onCopyPassword: vi.fn().mockResolvedValue(true) });
        await user.click(screen.getByTitle('Copy Password'));
        await waitFor(() => expect(container.querySelector('.lucide-check')).not.toBeNull());
    });

    it('shows no check when the browser would not copy', async () => {
        const user = userEvent.setup();
        const onCopyPassword = vi.fn().mockResolvedValue(false);
        const { container } = show({ onCopyPassword });
        await user.click(screen.getByTitle('Copy Password'));
        await waitFor(() => expect(onCopyPassword).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 600)); // longer than the icon swap, so a wrong check would be on screen by now
        expect(container.querySelector('.lucide-check')).toBeNull();
    });
});
