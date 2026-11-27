// KiWave API routes. Shared by the local server (server/index.mjs) and the Vercel function (api/index.mjs).
import crypto from 'node:crypto';
import { sign, verifyToken, rateLimiter } from './lib/security.mjs';
import { auth, db, isConfigured as supabaseReady } from './lib/supabase.mjs';
import * as google from './lib/google.mjs';
import { newCode, normalizeCode, isCode, validateSignup, CODE_HOURS } from './lib/linking.mjs';

const PORT = Number(process.env.API_PORT || 4000);
// On Vercel, APP_URL falls back to the production domain Vercel exposes.
const APP_URL = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
const SECRET = process.env.SESSION_SECRET;
const PROD = process.env.NODE_ENV === 'production';
const SESSION_DAYS = 7;
const ROLES = ['psicologa', 'paciente'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const configProblem = () => (!SECRET || SECRET.length < 32 ? 'SESSION_SECRET ausente ou curto (mín. 32 caracteres).' : !supabaseReady() ? 'SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY incompletos.' : null);

const loginLimit = rateLimiter({ max: 8, windowMs: 15 * 60 * 1000 });
const signupLimit = rateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
const codeLimit = rateLimiter({ max: 10, windowMs: 15 * 60 * 1000 }); // link codes could be guessed: cap attempts per user

/* ---------- helpers ---------- */
const send = (res, status, data, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
};
const fail = (res, status, error) => send(res, status, { error });
const httpError = (status, message) => Object.assign(new Error(message), { status });

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const cookieName = (role) => `kw_${role}`;
const setCookie = (role, value, maxAgeSec) => `${cookieName(role)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${PROD ? '; Secure' : ''}`;

async function body(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw httpError(415, 'Envie JSON.'); // blocks cross-site form posts
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 10_000) throw httpError(413, 'Corpo grande demais.'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw httpError(400, 'JSON inválido.'); }
}

// Session = our own signed cookie, one per role so both interfaces can be open side by side.
// shortcut: stateless sessions (no server-side revocation list); add one if accounts can be disabled mid-session.
const session = (req, role) => {
  const s = verifyToken(cookies(req)[cookieName(role)], SECRET);
  return s && s.role === role ? s : null;
};
const requireRole = (req, res, role) => {
  const s = session(req, role);
  if (!s) fail(res, 401, 'Faça login para continuar.');
  return s;
};
// Client IP for rate limiting. On Vercel req.socket is null once the body is read, and the
// platform's x-forwarded-for is trustworthy; locally that header could be spoofed, so use the socket.
const clientIp = (req) => (process.env.VERCEL
  ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '')
  : req.socket?.remoteAddress) || 'unknown';
const publicUser = (s) => ({ id: s.uid, role: s.role, name: s.name, email: s.email, patientId: s.patientId ?? null, psychologistId: s.psychologistId ?? null });
function issue(res, status, s, extra = {}) {
  const full = { uid: s.uid, role: s.role, name: s.name, email: s.email, patientId: s.patientId ?? null, psychologistId: s.psychologistId ?? null, exp: Date.now() + SESSION_DAYS * 864e5 };
  send(res, status, { user: publicUser(full), ...extra }, { 'Set-Cookie': setCookie(s.role, sign(full, SECRET), SESSION_DAYS * 86400) });
}

const linkUrl = (code) => `${APP_URL}/app?codigo=${code}`;
const codeExpiry = () => new Date(Date.now() + CODE_HOURS * 36e5).toISOString();
const PENDING_NAME = 'Novo paciente'; // placeholder until the patient links (patients.name is NOT NULL)
const patientView = (p) => ({
  id: p.id, name: p.name, linked: Boolean(p.user_id), linkedAt: p.linked_at, createdAt: p.created_at,
  code: p.user_id ? null : p.link_code, codeExpiresAt: p.user_id ? null : p.code_expires_at,
  link: p.user_id || !p.link_code ? null : linkUrl(p.link_code),
});
// Retries on the rare unique-code collision (PostgREST answers 409).
async function withFreshCode(write) {
  for (let i = 0; i < 3; i++) {
    try { return await write(newCode()); } catch (e) { if (e.status !== 409) throw e; }
  }
  throw httpError(500, 'Não foi possível gerar um código. Tente de novo.');
}

/* ---------- routes ---------- */
const routes = {
  'GET /api/health': (req, res) => send(res, 200, { ok: !configProblem(), supabase: supabaseReady(), google: google.isConfigured(), session: Boolean(SECRET && SECRET.length >= 32) }),

  'POST /api/auth/login': async (req, res) => {
    const { role, email, password } = await body(req);
    if (!ROLES.includes(role) || typeof email !== 'string' || typeof password !== 'string' || !email || !password) return fail(res, 400, 'Informe e-mail e senha.');
    const mail = email.trim().toLowerCase();
    if (!loginLimit(`${mail}|${clientIp(req)}`)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    let user;
    try { ({ user } = await auth.signIn(mail, password)); } catch (e) {
      if (e.status === 400) return fail(res, 401, 'E-mail ou senha incorretos.');
      throw e;
    }
    const profile = await db.one('profiles', 'id', user.id);
    if (!profile) return fail(res, 401, 'E-mail ou senha incorretos.');
    // Password was correct, so naming the right entry point reveals nothing to a stranger.
    if (profile.role !== role) return fail(res, 403, profile.role === 'psicologa' ? 'Esta é uma conta de psicóloga. Entre pelo painel, em /painel.' : 'Esta é uma conta de paciente. Entre pelo app, em /app.');
    issue(res, 200, { uid: user.id, role, name: profile.name, email: user.email, patientId: profile.patient_id, psychologistId: profile.psychologist_id });
  },

  // Patient creates their own account (name, contact, CPF, birth date). Logged in right away, still unlinked.
  // shortcut: email_confirm=true skips e-mail verification; turn on Supabase confirmation e-mails before launch.
  'POST /api/auth/signup': async (req, res) => {
    if (!signupLimit(clientIp(req))) return fail(res, 429, 'Muitos cadastros deste dispositivo. Tente mais tarde.');
    const { data, error } = validateSignup(await body(req));
    if (error) return fail(res, 400, error);
    let user;
    try { user = await auth.adminCreateUser(data.email, data.password); } catch (e) {
      if (e.status === 422 || e.status === 409) return fail(res, 409, 'Já existe uma conta com esse e-mail. Entre com sua senha.');
      throw e;
    }
    await db.upsert('profiles', { id: user.id, role: 'paciente', name: data.name, phone: data.phone, birth_date: data.birth, cpf: data.cpf });
    issue(res, 201, { uid: user.id, role: 'paciente', name: data.name, email: data.email });
  },

  'GET /api/auth/me': (req, res, url) => {
    const s = session(req, url.searchParams.get('role'));
    if (!s) return fail(res, 401, 'Sem sessão.');
    send(res, 200, { user: publicUser(s) });
  },

  'POST /api/auth/logout': async (req, res) => {
    const { role } = await body(req);
    if (!ROLES.includes(role)) return fail(res, 400, 'Perfil inválido.');
    send(res, 200, { ok: true }, { 'Set-Cookie': setCookie(role, '', 0) });
  },

  /* ----- patients and linking ----- */
  'GET /api/patients': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const rows = await db.list('patients', `psychologist_id=eq.${s.uid}&order=created_at.desc`);
    send(res, 200, { patients: rows.map(patientView) });
  },

  // Psychologist only generates a code + link. The name comes from the patient's own sign-up when they link.
  'POST /api/patients': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const row = await withFreshCode((code) => db.insert('patients', { psychologist_id: s.uid, name: PENDING_NAME, link_code: code, code_expires_at: codeExpiry() }));
    send(res, 201, { patient: patientView(row) });
  },

  // New code for a patient not linked yet (the old one stops working).
  'POST /api/patients/code': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const { id } = await body(req);
    if (typeof id !== 'string' || !UUID.test(id)) return fail(res, 400, 'Paciente inválido.');
    const [row] = await withFreshCode((code) => db.update('patients', `id=eq.${id}&psychologist_id=eq.${s.uid}&user_id=is.null`, { link_code: code, code_expires_at: codeExpiry() }));
    if (!row) return fail(res, 404, 'Paciente não encontrado ou já vinculado.');
    send(res, 200, { patient: patientView(row) });
  },

  // Patient checks a code before confirming: shows who they will be linked to.
  'GET /api/link/preview': async (req, res, url) => {
    const s = requireRole(req, res, 'paciente'); if (!s) return;
    if (!codeLimit(s.uid)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
    const code = normalizeCode(url.searchParams.get('code'));
    if (!isCode(code)) return fail(res, 400, 'O código tem 6 letras e números.');
    const now = encodeURIComponent(new Date().toISOString());
    const [p] = await db.list('patients', `link_code=eq.${code}&user_id=is.null&code_expires_at=gt.${now}&limit=1`);
    if (!p) return fail(res, 404, 'Código inválido ou vencido. Peça um novo à sua psicóloga.');
    const psi = await db.one('profiles', 'id', p.psychologist_id);
    send(res, 200, { psychologistName: psi?.name ?? 'Sua psicóloga' });
  },

  // Patient redeems the code: one transaction in the database (public.link_patient).
  'POST /api/link': async (req, res) => {
    const s = requireRole(req, res, 'paciente'); if (!s) return;
    if (!codeLimit(s.uid)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
    const code = normalizeCode((await body(req)).code);
    if (!isCode(code)) return fail(res, 400, 'O código tem 6 letras e números.');
    let row;
    try { [row] = await db.rpc('link_patient', { p_code: code, p_user: s.uid }); } catch (e) {
      if (/already_linked/.test(e.message)) return fail(res, 409, 'Sua conta já está vinculada a uma psicóloga.');
      if (/invalid_code/.test(e.message)) return fail(res, 404, 'Código inválido ou vencido. Peça um novo à sua psicóloga.');
      throw e;
    }
    await db.update('patients', `id=eq.${row.patient_id}`, { name: s.name }); // record takes the name the patient signed up with
    issue(res, 200, { ...s, patientId: row.patient_id, psychologistId: row.psychologist_id }, { psychologistName: row.psychologist_name });
  },

  /* ----- Google Calendar ----- */
  'GET /api/google/status': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    send(res, 200, await google.status(s.uid));
  },

  'GET /api/google/connect': (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    if (!google.isConfigured()) return fail(res, 503, 'Google não configurado: preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.');
    send(res, 200, { url: google.authUrl(s.uid) });
  },

  // Google redirects the browser here (directly to the API port).
  'GET /api/google/callback': async (req, res, url) => {
    const back = (status) => { res.writeHead(302, { Location: `${APP_URL}/painel?google=${status}` }); res.end(); };
    if (url.searchParams.get('error')) return back('cancelado');
    try { await google.handleCallback({ code: url.searchParams.get('code'), state: url.searchParams.get('state') }); back('conectado'); } catch (e) {
      console.error('[google callback]', e.message);
      back('erro');
    }
  },

  'GET /api/google/events': async (req, res, url) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const timeMin = url.searchParams.get('timeMin');
    const timeMax = url.searchParams.get('timeMax');
    if (!timeMin || !timeMax || Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax))) return fail(res, 400, 'Período inválido.');
    send(res, 200, { events: await google.listEvents(s.uid, { timeMin, timeMax }) });
  },

  'POST /api/google/events': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const { summary, start, end, description } = await body(req);
    if (typeof summary !== 'string' || !summary.trim() || summary.length > 200 || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) return fail(res, 400, 'Evento inválido.');
    send(res, 201, await google.createEvent(s.uid, { summary: summary.trim(), start, end, description: typeof description === 'string' ? description.slice(0, 1000) : undefined }));
  },

  'POST /api/google/disconnect': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    await google.disconnect(s.uid);
    send(res, 200, { ok: true });
  },
};

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const problem = configProblem();
  if (problem && url.pathname !== '/api/health') { console.error('[api config]', problem); return fail(res, 500, 'API sem configuração. Veja as variáveis de ambiente.'); }
  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return fail(res, 404, 'Rota não encontrada.');
  try {
    await route(req, res, url);
  } catch (e) {
    const status = e.status && e.status < 600 ? e.status : 500;
    const id = crypto.randomBytes(4).toString('hex');
    if (status >= 500) console.error(`[api ${id}]`, e);
    // 502 = a dependency (Supabase/Google) is misconfigured or down: the message names it and holds no secrets.
    if (!res.headersSent) fail(res, status, status === 502 ? `${e.message} (${id})` : status >= 500 ? `Erro interno (${id}).` : e.message);
  }
}
