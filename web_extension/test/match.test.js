import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, matchesHost, isFillablePage, entriesForPage } from '../src/match.js';

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

test('a saved address matches its own host, with or without www', () => {
  assert.ok(matchesHost('example.com', 'example.com'));
  assert.ok(matchesHost('https://example.com/login', 'example.com'));
  assert.ok(matchesHost('www.example.com', 'example.com'));
  assert.ok(matchesHost('example.com', 'www.example.com'));
  assert.ok(matchesHost('EXAMPLE.com', 'example.COM'));
});

test('subdomains do not match, in either direction', () => {
  assert.equal(matchesHost('example.com', 'login.example.com'), false);
  assert.equal(matchesHost('example.com', 'a.b.example.com'), false);
  assert.equal(matchesHost('login.example.com', 'example.com'), false);
  assert.equal(matchesHost('login.example.com', 'login.example.com'), true);
});

test('look-alike hosts do not match', () => {
  assert.equal(matchesHost('example.com', 'example.com.evil.com'), false);
  assert.equal(matchesHost('example.com', 'notexample.com'), false);
  assert.equal(matchesHost('example.com', 'example.org'), false);
  assert.equal(matchesHost('example.com', 'example.com.'), false); // trailing dot
  assert.equal(matchesHost('apple.com', 'xn--pple-43d.com'), false); // Cyrillic "а" look-alike
  assert.equal(matchesHost('github.io', 'someone.github.io'), false); // a shared suffix is not a site
});

test('addresses that are IPs match only the same IP', () => {
  assert.ok(matchesHost('192.168.1.1', '192.168.1.1'));
  assert.equal(matchesHost('1.1', '192.168.1.1'), false);
  assert.equal(matchesHost('192.168.1.1', '192.168.1.10'), false);
});

test('entries without an address never match', () => {
  assert.equal(matchesHost('', 'example.com'), false);
  assert.equal(matchesHost('example.com', ''), false);
});

test('only https pages, or http on this computer, can be filled', () => {
  assert.ok(isFillablePage('https://example.com/login'));
  assert.ok(isFillablePage('http://localhost:3000/'));
  assert.ok(isFillablePage('http://127.0.0.1:8080/x'));
  assert.equal(isFillablePage('http://example.com/login'), false);
  assert.equal(isFillablePage('ftp://example.com'), false);
  assert.equal(isFillablePage('chrome://extensions'), false);
  assert.equal(isFillablePage('javascript:alert(1)'), false);
  assert.equal(isFillablePage('not a url'), false);
  assert.equal(isFillablePage(''), false);
  assert.equal(isFillablePage(undefined), false);
});

test('entriesForPage keeps only the logins for exactly that page', () => {
  const vault = [
    { url: 'https://github.com', username: 'a' },
    { url: 'example.com', username: 'b' },
    { url: 'login.example.com', username: 'c' },
    { url: '', username: 'd' }
  ];
  const names = (page) => entriesForPage(vault, page).map((e) => e.username);
  assert.deepEqual(names('https://github.com/login'), ['a']);
  assert.deepEqual(names('https://www.github.com/login'), ['a']);
  assert.deepEqual(names('https://gist.github.com/x'), []);
  assert.deepEqual(names('https://example.com:8443/'), ['b']); // the port is ignored
  assert.deepEqual(names('https://login.example.com/'), ['c']);
  assert.deepEqual(names('http://github.com/login'), []); // never over plain http
  assert.deepEqual(names('not a url'), []);
});

test('plain http is fine on this computer', () => {
  const vault = [{ url: 'localhost', username: 'dev' }];
  assert.equal(entriesForPage(vault, 'http://localhost:5173/').length, 1);
  assert.equal(entriesForPage(vault, 'http://localhost.evil.com/').length, 0);
});
