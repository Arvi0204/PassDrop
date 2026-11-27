import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import FaviconImage from './FaviconImage';

describe('the site icon', () => {
    it('shows the icon of a public site, from the favicon service', () => {
        render(<FaviconImage url="https://www.github.com/login" title="GitHub" />);
        expect(screen.getByRole('img').getAttribute('src')).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=64');
    });

    it('shows a letter tile, and sends nothing, for localhost, intranet names and IP addresses', () => {
        for (const url of ['localhost:3000', 'http://jira/login', '192.168.1.10', 'http://[::1]:5173']) {
            const { container, unmount } = render(<FaviconImage url={url} title="Local app" />);
            expect(screen.queryByRole('img'), url).toBeNull();
            expect(container.textContent, url).toBe('L');
            unmount();
        }
    });

    it('keeps the letter tiles to the site\'s blues and teals, never purple, pink, red or orange', () => {
        const classes = new Set();
        for (const title of ['Netflix', 'Linkedin', 'Mail', 'Bank', 'Gym', 'Zoom', 'Steam', 'Notes', 'Router', 'Wifi', 'Kindle', 'Uber', 'Yahoo', 'Xbox', 'Quora', 'Paypal']) {
            const { container, unmount } = render(<FaviconImage url="" title={title} />);
            const tile = container.firstChild.className;
            expect(tile, title).not.toMatch(/bg-(purple|indigo|violet|fuchsia|pink|rose|red|amber|orange|yellow)/);
            classes.add(tile.match(/bg-\S+/)[0]);
            unmount();
        }
        expect(classes.size).toBeGreaterThan(2); // still varied, so neighbouring logins can be told apart
    });

    it('shows a letter tile when the login has no site', () => {
        const { container } = render(<FaviconImage url="" title="Notes" />);
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.textContent).toBe('N');
    });

    it('falls back to the letter when the icon does not load', () => {
        const { container } = render(<FaviconImage url="github.com" title="GitHub" />);
        fireEvent.error(screen.getByRole('img'));
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.textContent).toBe('G');
    });
});
