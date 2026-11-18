import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, siteOf, matchesSite, isFillablePage, entriesForPage } from '../src/match.js';

test('hostOf reads typed addresses in any form', () => {
  assert.equal(hostOf('github.com'), 'github.com');
  assert.equal(hostOf('https://github.com/login'), 'github.com');
  assert.equal(hostOf('  GitHub.com  '), 'github.com');
  assert.equal(hostOf('https://www.github.com'), 'github.com');
  assert.equal(hostOf('http://localhost:5173/x'), 'localhost');
});

test('an address with :// in its path or query is still read as a bare host', () => {
  assert.equal(hostOf('example.com/go?to=https://other.test'), 'example.com');
  assert.equal(hostOf('example.com/redirect/http://x'), 'example.com');
  assert.equal(hostOf('HTTPS://Example.com'), 'example.com');
});

test('siteOf is the host plus an explicit port, and ignores the scheme', () => {
  assert.equal(siteOf('github.com'), 'github.com');
  assert.equal(siteOf('http://github.com'), 'github.com');
  assert.equal(siteOf('https://github.com:443/x'), 'github.com'); // 443 is the default
  assert.equal(siteOf('bank.example:8443'), 'bank.example:8443');
  assert.equal(siteOf('http://localhost:5173/login'), 'localhost:5173');
  assert.equal(siteOf(''), '');
});

test('hostOf gives nothing for empty or unusable input', () => {
  for (const bad of ['', '   ', null, undefined, 42, 'http://']) assert.equal(hostOf(bad), '');
});

test('a saved address matches its own host, with or without www', () => {
  assert.ok(matchesSite('example.com', 'example.com'));
  assert.ok(matchesSite('https://example.com/login', 'example.com'));
  assert.ok(matchesSite('www.example.com', 'example.com'));
  assert.ok(matchesSite('example.com', 'www.example.com'));
  assert.ok(matchesSite('EXAMPLE.com', 'example.COM'));
});

test('subdomains do not match, in either direction', () => {
  assert.equal(matchesSite('example.com', 'login.example.com'), false);
  assert.equal(matchesSite('example.com', 'a.b.example.com'), false);
  assert.equal(matchesSite('login.example.com', 'example.com'), false);
  assert.equal(matchesSite('login.example.com', 'login.example.com'), true);
});

test('look-alike hosts do not match', () => {
  assert.equal(matchesSite('example.com', 'example.com.evil.com'), false);
  assert.equal(matchesSite('example.com', 'notexample.com'), false);
  assert.equal(matchesSite('example.com', 'example.org'), false);
  assert.equal(matchesSite('example.com', 'example.com.'), false); // trailing dot
  assert.equal(matchesSite('apple.com', 'xn--pple-43d.com'), false); // Cyrillic "а" look-alike
  assert.equal(matchesSite('github.io', 'someone.github.io'), false); // a shared suffix is not a site
});

test('addresses that are IPs match only the same IP', () => {
  assert.ok(matchesSite('192.168.1.1', '192.168.1.1'));
  assert.equal(matchesSite('1.1', '192.168.1.1'), false);
  assert.equal(matchesSite('192.168.1.1', '192.168.1.10'), false);
});

test('a different port is a different site', () => {
  assert.equal(matchesSite('bank.example', 'bank.example:8443'), false);
  assert.equal(matchesSite('bank.example:8443', 'bank.example'), false);
  assert.equal(matchesSite('bank.example:8443', 'bank.example:9443'), false);
  assert.ok(matchesSite('bank.example:8443', 'https://bank.example:8443/login'));
  assert.ok(matchesSite('https://bank.example', 'https://bank.example:443/login')); // 443 is the default
  assert.ok(matchesSite('http://example.com', 'https://example.com/login')); // an old http:// entry still belongs here
});

test('entries without an address never match', () => {
  assert.equal(matchesSite('', 'example.com'), false);
  assert.equal(matchesSite('example.com', ''), false);
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
  assert.deepEqual(names('https://example.com:8443/'), []); // another port is another service
  assert.deepEqual(names('https://example.com:443/'), ['b']);
  assert.deepEqual(names('https://login.example.com/'), ['c']);
  assert.deepEqual(names('http://github.com/login'), []); // never over plain http
  assert.deepEqual(names('not a url'), []);
});

test('plain http is fine on this computer, and a local app is told apart by its port', () => {
  const vault = [{ url: 'localhost:5173', username: 'dev' }, { url: 'localhost:3000', username: 'other' }];
  assert.deepEqual(entriesForPage(vault, 'http://localhost:5173/').map((e) => e.username), ['dev']);
  assert.deepEqual(entriesForPage(vault, 'http://localhost:3000/').map((e) => e.username), ['other']);
  assert.equal(entriesForPage(vault, 'http://localhost:8080/').length, 0);
  assert.equal(entriesForPage(vault, 'http://localhost.evil.com:5173/').length, 0);
});
