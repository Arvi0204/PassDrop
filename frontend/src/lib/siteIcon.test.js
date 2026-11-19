import { describe, expect, it } from 'vitest';
import { iconUrlForHost } from './siteIcon';

describe('the site icon address', () => {
    it('asks the favicon service about a public site name', () => {
        expect(iconUrlForHost('github.com')).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=64');
        expect(iconUrlForHost('login.bits-pilani.ac.in')).toContain('domain=login.bits-pilani.ac.in');
    });

    it('never sends localhost, intranet names, IP addresses or nothing', () => {
        for (const host of ['localhost', 'jira', 'my-nas', '192.168.1.10', '127.0.0.1', '[::1]', '', undefined, null]) {
            expect(iconUrlForHost(host), String(host)).toBe('');
        }
    });

    it('encodes what it sends', () => {
        expect(iconUrlForHost('a.com&evil=1')).toContain('domain=a.com%26evil%3D1');
    });
});
