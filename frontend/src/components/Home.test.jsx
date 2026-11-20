import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

describe('Home copy', () => {
    const text = () => {
        render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Home /></MemoryRouter>);
        return document.body.textContent;
    };

    it('names the real encryption and key derivation', () => {
        const page = text();
        expect(page).toContain('AES-256-GCM');
        expect(page).toContain('PBKDF2');
    });

    it('says what happens if the master password and the recovery key are both lost', () => {
        expect(text()).toMatch(/forget it and lose your\s+recovery key, nobody, including PassDrop, can recover your vault/);
    });
});
