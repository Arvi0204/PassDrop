import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import passwordContext from '../context/passwordContext';
import { saveSignIn } from '../lib/session';

// the header's sign-in state comes from the session; the tide is only used by Logout, which these tests never press
vi.mock('../context/useTide', () => ({ useTide: () => ({ fillIn() {}, fadeOut() {}, drain() {} }) }));

const at = (path) => render(
    <passwordContext.Provider value={{ setPasswordArray() {} }}>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Navbar /></MemoryRouter>
    </passwordContext.Provider>
);

describe('the header', () => {
    beforeEach(() => saveSignIn({ token: 'tok-1', userId: 'user-1' }));

    it('shows the menu to someone who is signed in', () => {
        at('/');
        expect(screen.getByRole('link', { name: 'Vault' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Logout/ })).toBeTruthy();
    });

    it('on a drop page shows only the logo, to a signed-in visitor: no menu, no way out, and the logo is not a link', () => {
        at('/drop/ID-1');
        expect(screen.getByText('Drop')).toBeTruthy(); // the wordmark
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByRole('navigation')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull(); // no Lock, Logout or menu button
    });

    it('and the same for someone who is not signed in: no Log In or Sign Up either', () => {
        sessionStorage.clear(); localStorage.clear();
        at('/drop/ID-1');
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText('Sign Up')).toBeNull();
    });
});
