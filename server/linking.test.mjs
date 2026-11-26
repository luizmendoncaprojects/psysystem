import test from 'node:test';
import assert from 'node:assert/strict';
import { newCode, normalizeCode, isCode, validCpf, validateSignup } from './lib/linking.mjs';

test('codes are 6 unambiguous chars and normalize user input', () => {
  for (let i = 0; i < 200; i++) assert.ok(isCode(newCode()));
  assert.equal(normalizeCode(' kw-7f3k2a '), 'KW7F3K2A');
  assert.equal(normalizeCode('7f3-k2a'), '7F3K2A');
  assert.equal(isCode('7F3K2A'), true);
  assert.equal(isCode('O0I1AA'), false);
});

test('CPF check digits', () => {
  assert.equal(validCpf('529.982.247-25'), true);
  assert.equal(validCpf('529.982.247-24'), false);
  assert.equal(validCpf('111.111.111-11'), false);
  assert.equal(validCpf('123'), false);
});

test('sign-up validation', () => {
  const ok = { name: 'Luiz  Mendonça', email: ' Luiz@Ex.com ', phone: '(62) 99999-1234', birth: '1990-05-10', cpf: '529.982.247-25', password: 'senha-longa-1', consent: true };
  const r = validateSignup(ok, new Date('2026-11-26'));
  assert.deepEqual(r.data, { name: 'Luiz Mendonça', email: 'luiz@ex.com', phone: '62999991234', cpf: '52998224725', birth: '1990-05-10', password: 'senha-longa-1' });
  assert.match(validateSignup({ ...ok, name: 'Luiz' }).error, /sobrenome/);
  assert.match(validateSignup({ ...ok, cpf: '52998224724' }).error, /CPF/);
  assert.match(validateSignup({ ...ok, birth: '2030-01-01' }, new Date('2026-11-26')).error, /nascimento/);
  assert.match(validateSignup({ ...ok, password: 'curta' }).error, /10 caracteres/);
  assert.match(validateSignup({ ...ok, consent: false }).error, /termos/);
});
