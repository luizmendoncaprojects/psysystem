// Signed tokens (HMAC-SHA256) and a login rate limiter. Node built-ins only.
// Passwords are verified by Supabase Auth; this file never sees password hashes.
import crypto from 'node:crypto';

export function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

// Returns the payload, or null when the token is missing, tampered with or expired.
export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !secret) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Fixed-window limiter for login attempts, kept in memory.
// shortcut: per-process memory, resets on restart; move to Redis/DB with more than one server.
export function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
    h.n += 1;
    return h.n <= max;
  };
}
