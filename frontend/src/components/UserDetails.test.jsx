import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import UserDetails from './UserDetails';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// a stand-in API: the profile, and a settable answer to the destructive calls
let deleteAnswer;
beforeEach(() => {
    sessionStorage.setItem('token', 'tok-123');
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    deleteAnswer = { success: true, message: 'deleted' };
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => ({
        status: 200,
        ok: true,
        json: async () => (options.method === 'DELETE' ? deleteAnswer : { username: 'tester', email: 't@example.com', createdAt: '2026-01-01', lastLogin: '2026-02-02' })
    })));
});

const deletions = () => fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE');
const confirm = () => screen.getByRole('button', { name: /Yes, I'm sure/ });
const passwordBox = () => screen.getByPlaceholderText(/Enter your master password/);

async function openDialog(user, buttonName) {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><UserDetails /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: buttonName }));
    return passwordBox();
}

describe('deleting from the Account page', () => {
    it('Delete All Passwords sends the master password that was typed', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), 'my-master-pw');
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        const [url, options] = deletions()[0];
        expect(url).toBe('http://api.test/api/passwords');
        expect(JSON.parse(options.body)).toEqual({ currentPassword: 'my-master-pw' });
        expect(options.headers['auth-token']).toBe('tok-123');
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('Delete Account sends the master password that was typed', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete PassDrop Account/), 'another-pw');
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        const [url, options] = deletions()[0];
        expect(url).toBe('http://api.test/api/auth/me');
        expect(JSON.parse(options.body)).toEqual({ currentPassword: 'another-pw' });
    });

    // the bug this guards against: the dialog remembered the password box as it was when it OPENED (empty)
    it('sends the password as it is when the button is pressed, however it was edited after the dialog opened', async () => {
        const user = userEvent.setup();
        const box = await openDialog(user, /Delete All Passwords/);
        await user.type(box, 'wrong-guess');
        await user.clear(box);
        await user.type(box, 'right-one');
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        expect(JSON.parse(deletions()[0][1].body).currentPassword).toBe('right-one');
    });

    it("shows the server's message when the master password is refused, and keeps the dialog open", async () => {
        deleteAnswer = { success: false, error: 'Current master password is incorrect' };
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), 'nope');
        await user.click(confirm());

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Current master password is incorrect'));
        expect(passwordBox()).toBeTruthy();
    });

    it('Cancel closes the dialog and forgets the typed password', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), 'secret-typed');
        await user.click(screen.getByRole('button', { name: /^Cancel/ }));
        await waitFor(() => expect(screen.queryByPlaceholderText(/Enter your master password/)).toBeNull());

        await user.click(screen.getByRole('button', { name: /Delete All Passwords/ }));
        expect(passwordBox().value).toBe('');
        expect(deletions()).toHaveLength(0);
    });
});
