import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import WaterMask from './WaterMask';

const dots = (password) => render(<WaterMask revealed={false} password={password} />).container.querySelector('.pw-dots').textContent;

describe('the water mask over a hidden password', () => {
    it('shows dots that follow the password length in steps, never the real text', () => {
        expect(dots('x'.repeat(45))).toHaveLength(24);
        expect(dots('x'.repeat(10))).toHaveLength(12);
        expect(dots('x'.repeat(14))).toHaveLength(16);
        expect(dots('short')).toHaveLength(8);
        expect(dots('my-real-secret')).toMatch(/^•+$/);
    });

    it('is hidden from screen readers, since it only decorates the field', () => {
        const { container } = render(<WaterMask revealed={false} password="abc" />);
        expect(container.querySelector('.pw-water').getAttribute('aria-hidden')).toBe('true');
    });
});
