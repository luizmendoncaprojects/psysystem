import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// Minimal config so the handler accepts requests; Supabase points nowhere on purpose.
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_PUBLISHABLE_KEY = 'pk';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk';
process.env.VERCEL = '1';
const { handler } = await import('./app.mjs');

// Vercel-like request: JSON body, x-forwarded-for, and req.socket === null.
function vercelReq(path, body) {
  const req = Readable.from([JSON.stringify(body)]);
  Object.assign(req, { method: 'POST', url: path, headers: { host: 'kiwave.vercel.app', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, socket: null });
  return req;
}
function fakeRes() {
  const res = { status: 0, body: '', headersSent: false };
  res.writeHead = (s) => { res.status = s; res.headersSent = true; };
  res.end = (b) => { res.body = b; };
  return res;
}

test('login on Vercel (no req.socket) reaches Supabase instead of crashing', async () => {
  const res = fakeRes();
  await handler(vercelReq('/api/auth/login', { role: 'psicologa', email: 'a@b.com', password: 'qualquer-senha' }), res);
  assert.notEqual(res.status, 500, res.body);
  assert.equal(res.status, 502); // Supabase unreachable in this test: reported clearly, not as a crash
  assert.match(JSON.parse(res.body).error, /Supabase inacessível/);
});

test('signup on Vercel (no req.socket) validates instead of crashing', async () => {
  const res = fakeRes();
  await handler(vercelReq('/api/auth/signup', { name: 'X' }), res);
  assert.equal(res.status, 400);
});
