import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VaultItemCard from './VaultItemCard';

const item = { _id: 'a', title: 'GitHub', url: 'github.com', username: 'me', password: 'pw-1' };
const show = (props = {}) => {
    const handlers = { onSelect: vi.fn(), onCopyUsername: vi.fn(), onCopyPassword: vi.fn() };
    render(<VaultItemCard item={item} {...handlers} {...props} />);
    return handlers;
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
