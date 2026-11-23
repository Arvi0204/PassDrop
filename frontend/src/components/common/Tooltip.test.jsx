import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
    it('is a tooltip that the control points to, so a screen reader reads it with the control', () => {
        render(
            <Tooltip title="Drop this login" text="Share it with a link.">
                {(hint) => <button type="button" {...hint}>Drop</button>}
            </Tooltip>
        );
        const tip = screen.getByRole('tooltip');
        expect(tip.textContent).toContain('Drop this login');
        expect(tip.textContent).toContain('Share it with a link.');
        expect(screen.getByRole('button', { name: 'Drop' }).getAttribute('aria-describedby')).toBe(tip.id);
    });

    it('never takes the pointer, so it cannot get in the way of what is under it', () => {
        render(<Tooltip title="t" text="x">{(hint) => <button type="button" {...hint}>Go</button>}</Tooltip>);
        expect(screen.getByRole('tooltip').className).toContain('pointer-events-none');
    });
});
