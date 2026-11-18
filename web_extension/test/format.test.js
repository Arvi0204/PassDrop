import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleOf, timeAgo, openableUrl, colourIndex } from '../src/popup/format.js';
import { strengthOf, maskFor } from '../src/popup/shared.js';

test('titleOf falls back from title to site to username', () => {
  assert.equal(titleOf({ title: 'GitHub', url: 'github.com', username: 'a' }), 'GitHub');
  assert.equal(titleOf({ title: '', url: 'https://www.amazon.com/x', username: 'a' }), 'amazon.com');
  assert.equal(titleOf({ title: '', url: '', username: 'arvind' }), 'arvind');
  assert.equal(titleOf({}), 'Untitled');
});

test('timeAgo reads naturally', () => {
  const now = 1_000_000;
  assert.equal(timeAgo(now - 1000, now), 'just now');
  assert.equal(timeAgo(now - 42_000, now), '42s ago');
  assert.equal(timeAgo(now - 180_000, now), '3m ago');
  assert.equal(timeAgo(now - 2 * 3600_000, now), '2h ago');
  assert.equal(timeAgo(now + 5000, now), 'just now');
});

test('openableUrl only allows web addresses', () => {
  assert.equal(openableUrl('github.com'), 'https://github.com/');
  assert.equal(openableUrl('http://localhost:3000/x'), 'http://localhost:3000/x');
  assert.equal(openableUrl('javascript:alert(1)'), '');
  assert.equal(openableUrl('chrome://settings'), '');
  assert.equal(openableUrl(''), '');
  assert.equal(openableUrl(null), '');
});

test('colourIndex is stable and within range', () => {
  assert.equal(colourIndex('GitHub', 6), colourIndex('GitHub', 6));
  for (const name of ['a', 'Netflix', 'amazon.com', '日本']) {
    const i = colourIndex(name, 6);
    assert.ok(i >= 0 && i < 6);
  }
});

test('the shared strength scoring matches the web app', () => {
  assert.deepEqual(strengthOf(''), { score: 0, label: 'Empty' });
  assert.equal(strengthOf('abc').score, 1);
  assert.equal(strengthOf('summer2020').score, 2);
  assert.equal(strengthOf('Xk29!pQ7vLm').score, 3);
  assert.equal(strengthOf('Xk29!pQ7vLm#aB4cD').label, 'Strong');
});

test('the hidden password mask follows the length in steps, never exactly', () => {
  const dots = (length) => maskFor('x'.repeat(length)).length;
  assert.equal(dots(1), 8);
  assert.equal(dots(8), 8);
  assert.equal(dots(9), 12);
  assert.equal(dots(10), 12);
  assert.equal(dots(12), 12);
  assert.equal(dots(13), 16);
  assert.equal(dots(16), 16);
  assert.equal(dots(17), 20);
  assert.equal(dots(21), 24);
  assert.equal(dots(44), 24); // as many dots as the mask ever shows
  assert.equal(dots(500), 24);
  assert.equal(dots(0), 8);
  assert.equal(maskFor(undefined).length, 8);
  assert.equal(new Set(maskFor('hunter22')).size, 1); // only dots
  assert.equal(dots(13), dots(16)); // two nearby lengths look the same
});
