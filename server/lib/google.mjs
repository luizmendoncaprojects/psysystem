// Google Calendar via OAuth 2.0 (authorization code + refresh token). Plain fetch, no SDK.
// Docs: https://developers.google.com/identity/protocols/oauth2/web-server
//       https://developers.google.com/calendar/api/v3/reference/events
import crypto from 'node:crypto';
import { db } from './supabase.mjs';
import { sign, verifyToken } from './security.mjs';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

const cfg = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.API_PORT || 4000}/api/google/callback`,
  secret: process.env.SESSION_SECRET,
});
export const isConfigured = () => Boolean(cfg().clientId && cfg().clientSecret);

// Tokens per KiWave user in public.google_connections (RLS on, server-only).
// shortcut: tokens stored as plain text; encrypt the column (pgsodium/Vault) before production.
const getTokens = async (uid) => {
  const r = await db.one('google_connections', 'user_id', uid);
  return r && { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: new Date(r.expires_at).getTime(), scope: r.scope, email: r.google_email, connectedAt: r.connected_at };
};
const setTokens = async (uid, t) => (t
  ? db.upsert('google_connections', { user_id: uid, google_email: t.email, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: new Date(t.expires_at).toISOString(), scope: t.scope, connected_at: t.connectedAt })
  : db.remove('google_connections', 'user_id', uid));

export async function status(uid) {
  const t = await getTokens(uid);
  return { configured: isConfigured(), connected: Boolean(t), email: t?.email ?? null, connectedAt: t?.connectedAt ?? null };
}

// state is signed and short-lived: it ties the callback to the user who started it (CSRF protection).
export function authUrl(uid) {
  const { clientId, redirectUri, secret } = cfg();
  const state = sign({ uid, n: crypto.randomBytes(8).toString('hex'), exp: Date.now() + 10 * 60 * 1000 }, secret);
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `${AUTH_URL}?${q}`;
}

async function tokenRequest(params) {
  const { clientId, clientSecret } = cfg();
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google token: ${data.error_description || data.error || r.status}`);
  return data;
}

// Exchanges the code from the callback. Returns the KiWave user id that started the flow.
export async function handleCallback({ code, state }) {
  const s = verifyToken(state, cfg().secret);
  if (!s?.uid) throw new Error('Estado inválido ou expirado. Tente conectar de novo.');
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: cfg().redirectUri });
  const email = t.id_token ? JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString('utf8')).email : null;
  const prev = await getTokens(s.uid);
  await setTokens(s.uid, {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? prev?.refresh_token, // Google sends it only on first consent
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
    scope: t.scope, email, connectedAt: new Date().toISOString(),
  });
  return s.uid;
}

async function accessToken(uid) {
  const t = await getTokens(uid);
  if (!t) { const e = new Error('Google Agenda não conectado.'); e.status = 409; throw e; }
  if (t.expires_at > Date.now()) return t.access_token;
  if (!t.refresh_token) { await setTokens(uid, null); const e = new Error('Conexão expirou. Conecte o Google Agenda de novo.'); e.status = 409; throw e; }
  const n = await tokenRequest({ refresh_token: t.refresh_token, grant_type: 'refresh_token' });
  await setTokens(uid, { ...t, access_token: n.access_token, expires_at: Date.now() + (n.expires_in - 60) * 1000 });
  return n.access_token;
}

async function gapi(uid, path, init = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken(uid)}`, 'Content-Type': 'application/json', ...init.headers } });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`Google Agenda: ${data.error?.message || r.status}`); e.status = r.status === 401 ? 409 : 502; throw e; }
  return data;
}

export async function listEvents(uid, { timeMin, timeMax }) {
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
  const data = await gapi(uid, `/calendars/primary/events?${q}`);
  return (data.items || [])
    .filter((e) => e.status !== 'cancelled' && e.start?.dateTime) // all-day events are skipped on the time grid
    .map((e) => ({ id: e.id, title: e.summary || '(sem título)', start: e.start.dateTime, end: e.end.dateTime, fromKiWave: e.extendedProperties?.private?.kiwave === '1' }));
}

export async function createEvent(uid, { summary, start, end, description }) {
  const tz = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
  const ev = await gapi(uid, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary, description,
      start: { dateTime: start, timeZone: tz }, end: { dateTime: end, timeZone: tz },
      extendedProperties: { private: { kiwave: '1' } },
    }),
  });
  return { id: ev.id, htmlLink: ev.htmlLink };
}

export async function disconnect(uid) {
  const t = await getTokens(uid);
  if (t) await fetch(`${REVOKE_URL}?token=${encodeURIComponent(t.refresh_token || t.access_token)}`, { method: 'POST' }).catch(() => {});
  await setTokens(uid, null);
}
