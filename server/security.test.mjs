import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verifyToken, rateLimiter } from './lib/security.mjs';

const SECRET = 'x'.repeat(40);

test('signed token round-trips and rejects tampering, wrong secret and expiry', () => {
  const t = sign({ uid: 'u1', role: 'psicologa', exp: Date.now() + 60_000 }, SECRET);
  assert.equal(verifyToken(t, SECRET).uid, 'u1');
  const [body, mac] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'u1', role: 'paciente', exp: Date.now() + 60_000 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${mac}`, SECRET), null);
  assert.equal(verifyToken(t, 'y'.repeat(40)), null);
  assert.equal(verifyToken(sign({ uid: 'u1', exp: Date.now() - 1 }, SECRET), SECRET), null);
  assert.equal(verifyToken(t, undefined), null);
  assert.equal(verifyToken(`${body}`, SECRET), null);
  assert.equal(verifyToken(undefined, SECRET), null);
});

test('rate limiter blocks after max attempts per key', () => {
  const allow = rateLimiter({ max: 2, windowMs: 60_000 });
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), false);
  assert.equal(allow('b'), true);
});
