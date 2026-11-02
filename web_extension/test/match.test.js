import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, matchesHost, entriesForPage } from '../src/match.js';

test('hostOf reads typed addresses in any form', () => {
  assert.equal(hostOf('github.com'), 'github.com');
  assert.equal(hostOf('https://github.com/login'), 'github.com');
  assert.equal(hostOf('  GitHub.com  '), 'github.com');
  assert.equal(hostOf('https://www.github.com'), 'github.com');
  assert.equal(hostOf('http://localhost:5173/x'), 'localhost');
});

test('hostOf gives nothing for empty or unusable input', () => {
  for (const bad of ['', '   ', null, undefined, 42, 'http://']) assert.equal(hostOf(bad), '');
});

test('a saved address matches its own host and its subdomains', () => {
  assert.ok(matchesHost('example.com', 'example.com'));
  assert.ok(matchesHost('https://example.com/login', 'login.example.com'));
  assert.ok(matchesHost('example.com', 'a.b.example.com'));
  assert.ok(matchesHost('www.example.com', 'example.com'));
});

test('look-alike hosts do not match', () => {
  assert.equal(matchesHost('example.com', 'example.com.evil.com'), false);
  assert.equal(matchesHost('example.com', 'notexample.com'), false);
  assert.equal(matchesHost('login.example.com', 'example.com'), false);
  assert.equal(matchesHost('example.com', 'example.org'), false);
});

test('entries without an address never match', () => {
  assert.equal(matchesHost('', 'example.com'), false);
  assert.equal(matchesHost('example.com', ''), false);
});

test('entriesForPage keeps only the logins for that page', () => {
  const vault = [
    { url: 'https://github.com', username: 'a' },
    { url: 'example.com', username: 'b' },
    { url: '', username: 'c' }
  ];
  assert.deepEqual(entriesForPage(vault, 'https://gist.github.com/x').map((e) => e.username), ['a']);
  assert.deepEqual(entriesForPage(vault, 'https://github.com/login').map((e) => e.username), ['a']);
  assert.deepEqual(entriesForPage(vault, 'https://login.example.com/').map((e) => e.username), ['b']);
  assert.deepEqual(entriesForPage(vault, 'not a url'), []);
});
