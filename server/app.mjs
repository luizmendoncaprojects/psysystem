// KiWave API routes. Shared by the local server (server/index.mjs) and the Vercel function (api/index.mjs).
import crypto from 'node:crypto';
import { sign, verifyToken, rateLimiter } from './lib/security.mjs';
import { auth, db, isConfigured as supabaseReady } from './lib/supabase.mjs';
import * as google from './lib/google.mjs';
import * as cert from './lib/certificate.mjs';
import { buildPdf, signPdf } from './lib/signpdf.mjs';
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

async function body(req, max = 10_000) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw httpError(415, 'Envie JSON.'); // blocks cross-site form posts
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > max) throw httpError(413, 'Corpo grande demais.'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw httpError(400, 'JSON inválido.'); }
}

// Session = our own signed cookie, one per role so both interfaces can be open side by side.
// shortcut: stateless sessions (no server-side revocation list); add one if accounts can be disabled mid-session.
const session = (req, role) => {
  const s = verifyToken(cookies(req)[cookieName(role)], SECRET);
  return s && s.role === role ? s : null;
};
// Routes both sides use: ?role= says which login to use (both can be open in one browser).
const roleSession = (req, url) => { const r = url.searchParams.get('role'); return ROLES.includes(r) ? session(req, r) : session(req, 'psicologa') ?? session(req, 'paciente'); };
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
// Each record key has a single writer, so the two sides never overwrite each other.
// Who may write each record key. notes = session follow-up (prontuário), triage = the psychologist's own topic priority.
export const RECORD_KEYS = { psicologa: ['plan', 'clinical', 'rxStatus', 'notes', 'triage'], paciente: ['log', 'diary', 'topics', 'rx'] };
// Keys the patient app never receives.
export const PANEL_ONLY = ['clinical', 'notes', 'triage'];
// Charts drawn in a signed PDF (timeline report). Untrusted input: keep only numbers and short labels.
const cleanCharts = (charts) => (Array.isArray(charts) ? charts.slice(0, 6) : []).map((c) => {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const min = n(c?.min) ?? 0; const max = n(c?.max) ?? 1;
  return { title: String(c?.title ?? '').slice(0, 60), min, max: max > min ? max : min + 1, points: (Array.isArray(c?.points) ? c.points.slice(0, 400) : []).map(n), labels: (Array.isArray(c?.labels) ? c.labels.slice(0, 2) : []).map((l) => String(l).slice(0, 12)) };
});
const DOC_COLS ='id,patient_id,title,body,code,signed_by,signed_at'; // everything but the PDF bytes
// title, body, signer and PDF are stored encrypted (AES-256-GCM, CERT_KEY): the database only holds ciphertext.
const docView = (d) => ({ id: d.id, patientId: d.patient_id, title: cert.unseal(d.title), body: cert.unseal(d.body), code: d.code, signedBy: d.signed_by && cert.unseal(d.signed_by), signedAt: d.signed_at });
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

  /* ----- digital certificate (psychologist) ----- */
  'GET /api/certificate': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const c = await db.one('certificates', 'psychologist_id', s.uid);
    send(res, 200, { certificate: c && { fileName: c.file_name, subject: c.subject, issuer: c.issuer, validUntil: c.valid_until, uploadedAt: c.uploaded_at } });
  },

  // Upload: the password must open the file, so a typo is caught now and not at signing time.
  'POST /api/certificate': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const { fileName, pfx, password } = await body(req, 200_000);
    if (typeof pfx !== 'string' || !pfx || typeof password !== 'string' || !password) return fail(res, 400, 'Envie o arquivo do certificado e a senha.');
    const name = String(fileName ?? '').slice(0, 200);
    if (!/\.(pfx|p12)$/i.test(name)) return fail(res, 400, 'Use o arquivo .pfx ou .p12 do certificado A1.');
    const info = cert.inspect(pfx, password);
    await db.upsert('certificates', { psychologist_id: s.uid, file_name: name, pfx_enc: cert.seal(pfx), password_enc: cert.seal(password), subject: info.subject, issuer: info.issuer, valid_until: info.validUntil, uploaded_at: new Date().toISOString() });
    send(res, 200, { certificate: { fileName: name, ...info, uploadedAt: new Date().toISOString() } });
  },

  // Showing the saved certificate password requires the login password again.
  'POST /api/certificate/reveal': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const { password } = await body(req);
    if (typeof password !== 'string' || !password) return fail(res, 400, 'Digite sua senha de login.');
    if (!loginLimit(`${s.email}|${clientIp(req)}`)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
    try { await auth.signIn(s.email, password); } catch (e) {
      if (e.status === 400) return fail(res, 401, 'Senha de login incorreta.');
      throw e;
    }
    const c = await db.one('certificates', 'psychologist_id', s.uid);
    if (!c) return fail(res, 404, 'Nenhum certificado salvo.');
    send(res, 200, { password: cert.unseal(c.password_enc) });
  },

  // Builds the PDF and signs it with the saved certificate. The browser never holds the certificate or its password.
  'POST /api/documents/sign': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const b = await body(req, 100_000);
    const text = (v, max) => String(v ?? '').slice(0, max);
    if (!text(b.body, 50_000).trim()) return fail(res, 400, 'O documento está vazio.');
    if (!UUID.test(String(b.patientId))) return fail(res, 400, 'Escolha um paciente vinculado ao app.');
    const [patient] = await db.list('patients', `id=eq.${b.patientId}&psychologist_id=eq.${s.uid}&limit=1`);
    if (!patient) return fail(res, 404, 'Paciente não encontrado.');
    const c = await db.one('certificates', 'psychologist_id', s.uid);
    if (!c) return fail(res, 409, 'Envie seu certificado digital em Configurações › Certificado digital antes de assinar.');
    if (c.valid_until && new Date(c.valid_until) < new Date()) return fail(res, 409, 'Seu certificado digital venceu. Envie um novo em Configurações.');
    const tz = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
    const now = new Date();
    const code = `KW-${crypto.randomBytes(6).toString('hex').toUpperCase().match(/.{4}/g).join('-')}`; // unique key (UNIQUE in the table)
    const pdf = await buildPdf({
      title: text(b.title, 200) || 'Documento', body: text(b.body, 50_000), author: s.name, crp: text(b.crp, 60), place: text(b.place, 80) || 'Goiânia', charts: cleanCharts(b.charts),
      dateLong: now.toLocaleDateString('pt-BR', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }),
      signedBy: c.subject, issuer: c.issuer, signedAt: now.toLocaleString('pt-BR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }), code,
    });
    const signed = await signPdf(pdf, Buffer.from(cert.unseal(c.pfx_enc), 'base64'), cert.unseal(c.password_enc));
    const row = await db.insert('documents', { psychologist_id: s.uid, patient_id: patient.id, title: cert.seal(text(b.title, 200) || 'Documento'), body: cert.seal(text(b.body, 50_000)), code, pdf: cert.seal(signed.toString('base64')), signed_by: cert.seal(c.subject), signed_at: now.toISOString() });
    if (UUID.test(String(b.requestId))) await db.update('document_requests', `id=eq.${b.requestId}&psychologist_id=eq.${s.uid}`, { status: 'Concluído' });
    send(res, 201, { document: docView(row) });
  },

  // Signed documents: the psychologist sees all of hers; a patient sees only their own.
  'GET /api/documents': async (req, res, url) => {
    const s = roleSession(req, url);
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    const who = s.role === 'psicologa' ? `psychologist_id=eq.${s.uid}` : `patient_id=eq.${s.patientId}`;
    if (s.role === 'paciente' && !UUID.test(String(s.patientId))) return send(res, 200, { documents: [] });
    const rows = await db.list('documents', `${who}&select=${DOC_COLS}&order=signed_at.desc`);
    send(res, 200, { documents: rows.map(docView) });
  },

  // The signed PDF itself, as a file download. ?role= picks which login to use when both are open.
  'GET /api/documents/pdf': async (req, res, url) => {
    const s = session(req, url.searchParams.get('role') === 'paciente' ? 'paciente' : 'psicologa');
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    const id = url.searchParams.get('id');
    if (!UUID.test(String(id))) return fail(res, 400, 'Documento inválido.');
    const d = await db.one('documents', 'id', id);
    const mine = d && (s.role === 'psicologa' ? d.psychologist_id === s.uid : d.patient_id === s.patientId);
    if (!mine) return fail(res, 404, 'Documento não encontrado.');
    const file = `${cert.unseal(d.title)} - ${d.code}.pdf`.replace(/[^\w\s.()À-ÿ-]/g, '');
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(Buffer.from(cert.unseal(d.pdf), 'base64'));
  },

  /* ----- patient record (plan set by the psychologist, logs written by the patient) ----- */
  // psychologist: { records: { [patientId]: { key: data } } } for all her patients (diary: shared entries only).
  // patient: { record: { key: data } } for themself (never the PANEL_ONLY keys).
  'GET /api/records': async (req, res, url) => {
    const s = roleSession(req, url);
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    let rows;
    if (s.role === 'psicologa') {
      const mine = await db.list('patients', `psychologist_id=eq.${s.uid}&select=id`);
      if (!mine.length) return send(res, 200, { records: {} });
      rows = await db.list('patient_records', `patient_id=in.(${mine.map((p) => p.id).join(',')})`);
    } else {
      if (!UUID.test(String(s.patientId))) return send(res, 200, { record: {} });
      rows = await db.list('patient_records', `patient_id=eq.${s.patientId}&key=not.in.(${PANEL_ONLY.join(',')})`);
    }
    const out = {};
    for (const r of rows) {
      let data = JSON.parse(cert.unseal(r.data));
      if (r.key === 'diary' && s.role === 'psicologa') data = data.filter((e) => e.shared); // private entries never leave for the panel
      (out[r.patient_id] ??= {})[r.key] = data;
    }
    send(res, 200, s.role === 'psicologa' ? { records: out } : { record: out[s.patientId] ?? {} });
  },

  'POST /api/records': async (req, res, url) => {
    const s = roleSession(req, url);
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    const { patientId, key, data } = await body(req, 3_000_000); // rx carries photos/PDFs
    if (!RECORD_KEYS[s.role].includes(key)) return fail(res, 403, 'Você não pode alterar este dado.');
    if (data === undefined || typeof data !== 'object') return fail(res, 400, 'Dados inválidos.');
    let pid = s.patientId;
    if (s.role === 'psicologa') {
      if (!UUID.test(String(patientId))) return fail(res, 400, 'Paciente inválido.');
      const [p] = await db.list('patients', `id=eq.${patientId}&psychologist_id=eq.${s.uid}&select=id&limit=1`);
      if (!p) return fail(res, 404, 'Paciente não encontrado.');
      pid = p.id;
    } else if (!UUID.test(String(pid))) return fail(res, 409, 'Vincule sua conta a uma psicóloga primeiro.');
    await db.upsert('patient_records', { patient_id: pid, key, data: cert.seal(JSON.stringify(data)), updated_at: new Date().toISOString() });
    send(res, 200, { ok: true });
  },

  /* ----- preferences (theme, accent…) per account ----- */
  'GET /api/prefs': async (req, res, url) => {
    const s = session(req, url.searchParams.get('role') === 'paciente' ? 'paciente' : 'psicologa');
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    const r = await db.one('user_prefs', 'user_id', s.uid);
    send(res, 200, { prefs: r ? JSON.parse(cert.unseal(r.data)) : null });
  },

  'POST /api/prefs': async (req, res, url) => {
    const s = session(req, url.searchParams.get('role') === 'paciente' ? 'paciente' : 'psicologa');
    if (!s) return fail(res, 401, 'Faça login para continuar.');
    const { prefs } = await body(req, 50_000);
    if (!prefs || typeof prefs !== 'object') return fail(res, 400, 'Preferências inválidas.');
    await db.upsert('user_prefs', { user_id: s.uid, data: cert.seal(JSON.stringify(prefs)), updated_at: new Date().toISOString() });
    send(res, 200, { ok: true });
  },

  /* ----- document requests ----- */
  'POST /api/requests': async (req, res) => {
    const s = requireRole(req, res, 'paciente'); if (!s) return;
    if (!UUID.test(String(s.patientId)) || !s.psychologistId) return fail(res, 409, 'Vincule sua conta a uma psicóloga primeiro.');
    const { kind, why } = await body(req);
    const k = String(kind ?? '').trim();
    if (k.length < 2 || k.length > 120) return fail(res, 400, 'Escolha o documento.');
    const row = await db.insert('document_requests', { psychologist_id: s.psychologistId, patient_id: s.patientId, kind: cert.seal(k), why: cert.seal(String(why ?? '').trim().slice(0, 500)) });
    send(res, 201, { request: { id: row.id } });
  },

  'GET /api/requests': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const rows = await db.list('document_requests', `psychologist_id=eq.${s.uid}&status=eq.Pendente&select=*,patients(name)&order=created_at.desc`);
    send(res, 200, { requests: rows.map((r) => ({ id: r.id, patientId: r.patient_id, name: r.patients?.name ?? 'Paciente', kind: cert.unseal(r.kind), why: cert.unseal(r.why) || null, createdAt: r.created_at })) });
  },

  'POST /api/requests/done': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    const { id } = await body(req);
    if (!UUID.test(String(id))) return fail(res, 400, 'Pedido inválido.');
    await db.update('document_requests', `id=eq.${id}&psychologist_id=eq.${s.uid}`, { status: 'Concluído' });
    send(res, 200, { ok: true });
  },

  'POST /api/certificate/remove': async (req, res) => {
    const s = requireRole(req, res, 'psicologa'); if (!s) return;
    await db.remove('certificates', 'psychologist_id', s.uid);
    send(res, 200, { ok: true });
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
