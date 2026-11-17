import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { findLoginFields, fillFields, setValue } from '../src/fields.js';

// jsdom has no layout, so "visible" is stood in for by attributes: hidden / data-off (pushed off the page).
const isVisible = (el) => !el.closest('[hidden], [data-off]');
const page = (html) => new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
const find = (html) => findLoginFields(page(html), { isVisible });

test('a plain login form gives the username and password fields', () => {
  const r = find('<form><input id="u" type="text"><input id="p" type="password"><button>Go</button></form>');
  assert.equal(r.status, 'ok');
  assert.equal(r.username.id, 'u');
  assert.equal(r.password.id, 'p');
});

test('an email field counts as the username', () => {
  const r = find('<form><input id="e" type="email"><input id="p" type="password"></form>');
  assert.equal(r.username.id, 'e');
});

test('the username is the nearest field above the password, not the first on the page', () => {
  const r = find(`<form>
    <input id="nick" type="text"><input id="u" type="text"><input id="p" type="password"></form>`);
  assert.equal(r.username.id, 'u');
});

test('a field that says it is the username wins over a nearer one that does not say', () => {
  const r = find(`<form><input id="u" type="text" autocomplete="username">
    <input id="other" type="text"><input id="p" type="password"></form>`);
  assert.equal(r.username.id, 'u');
});

test('hidden and off-page decoy fields are never chosen', () => {
  const r = find(`<form>
    <input id="decoy1" type="text" hidden>
    <input id="decoy2" type="text" data-off>
    <input id="decoyp" type="password" data-off>
    <input id="u" type="text"><input id="p" type="password"></form>`);
  assert.equal(r.username.id, 'u');
  assert.equal(r.password.id, 'p');
});

test('disabled and read-only fields are skipped', () => {
  const r = find(`<form><input id="d" type="text" disabled><input id="r" type="text" readonly>
    <input id="u" type="text"><input id="p" type="password"></form>`);
  assert.equal(r.username.id, 'u');
});

test('a search box is not mistaken for the username', () => {
  const r = find(`<input id="s" type="text" placeholder="Search"><input id="q" name="site-search" type="text">
    <input id="p" type="password">`);
  assert.equal(r.status, 'ok');
  assert.equal(r.username, null);
  assert.equal(r.password.id, 'p');
});

test('a sign-up form (two password fields) is refused', () => {
  const r = find(`<form><input type="text"><input type="password"><input type="password"></form>`);
  assert.deepEqual(r, { status: 'signup' });
});

test('a new-password field is refused even when alone', () => {
  const r = find(`<form><input type="text"><input type="password" autocomplete="new-password"></form>`);
  assert.deepEqual(r, { status: 'signup' });
});

test('with a login form and a sign-up form side by side, the login form is used', () => {
  const r = find(`
    <form id="reg"><input id="ru" type="text"><input type="password"><input type="password"></form>
    <form id="log"><input id="lu" type="text"><input id="lp" type="password"></form>`);
  assert.equal(r.status, 'ok');
  assert.equal(r.username.id, 'lu');
  assert.equal(r.password.id, 'lp');
});

test('a first step that only asks for the username is filled when it says so', () => {
  const r = find('<form><input id="u" type="email" autocomplete="username"></form>');
  assert.equal(r.status, 'ok');
  assert.equal(r.username.id, 'u');
  assert.equal(r.password, null);
});

test('a lone text field that does not say it is a username is left alone', () => {
  assert.deepEqual(find('<form><input type="text" name="newsletter"></form>'), { status: 'none' });
});

test('a second step that only asks for the password fills just the password', () => {
  const r = find('<form><input id="p" type="password" autocomplete="current-password"></form>');
  assert.equal(r.status, 'ok');
  assert.equal(r.username, null);
  assert.equal(r.password.id, 'p');
});

test('two username-only forms on one page are ambiguous, so nothing is filled', () => {
  const r = find(`<form><input type="email" autocomplete="email"></form>
    <form><input type="email" autocomplete="username"></form>`);
  assert.deepEqual(r, { status: 'none' });
});

test('a page with no fields has nothing to fill', () => {
  assert.deepEqual(find('<p>hello</p>'), { status: 'none' });
});

test('setValue sets the value and sends input and change events', () => {
  const doc = page('<input id="u" type="text">');
  const el = doc.getElementById('u');
  const seen = [];
  el.addEventListener('input', () => seen.push(['input', el.value]));
  el.addEventListener('change', () => seen.push(['change', el.value]));
  setValue(el, 'alice');
  assert.equal(el.value, 'alice');
  assert.deepEqual(seen, [['input', 'alice'], ['change', 'alice']]);
});

test('setValue gets through a framework that guards the value property', () => {
  const doc = page('<input id="u" type="text">');
  const el = doc.getElementById('u');
  // what React does: it puts its own value property on the element to track what it last saw
  let tracked = '';
  Object.defineProperty(el, 'value', { configurable: true, get: () => tracked, set: (v) => { tracked = v; } });
  setValue(el, 'alice');
  assert.equal(tracked, '', 'the framework copy was not touched, so it will notice the change');
  const real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').get.call(el);
  assert.equal(real, 'alice');
});

test('fillFields fills what was found and reports it', () => {
  const doc = page('<form><input id="u" type="text"><input id="p" type="password"></form>');
  const found = findLoginFields(doc, { isVisible });
  assert.deepEqual(fillFields(found, { username: 'alice', password: 's3cret' }), ['username', 'password']);
  assert.equal(doc.getElementById('u').value, 'alice');
  assert.equal(doc.getElementById('p').value, 's3cret');
  assert.equal(doc.activeElement.id, 'p', 'the cursor ends in the password field');
});

test('fillFields skips an empty username and fields that were not found', () => {
  const doc = page('<form><input id="u" type="text"><input id="p" type="password"></form>');
  const found = findLoginFields(doc, { isVisible });
  assert.deepEqual(fillFields(found, { username: '', password: 'pw' }), ['password']);
  assert.equal(doc.getElementById('u').value, '');

  const stepOne = findLoginFields(page('<input id="e" type="email" autocomplete="username">'), { isVisible });
  assert.deepEqual(fillFields(stepOne, { username: 'a@b.c', password: 'pw' }), ['username']);
});
