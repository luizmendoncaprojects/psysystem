// Creates (or updates) the psychologist account and a patient waiting to be linked.
// The patient (Luiz) creates his own account in the app and enters the printed code.
// Run: npm run seed   — reads e-mail and password from .env; the password is never printed.
import { auth, db, isConfigured } from './lib/supabase.mjs';
import { newCode, CODE_HOURS } from './lib/linking.mjs';

if (!isConfigured()) { console.error('Preencha SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.'); process.exit(1); }

const email = process.env.SEED_PSICOLOGA_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_PSICOLOGA_PASSWORD;
if (!email || !password || password.length < 10) { console.error('Preencha SEED_PSICOLOGA_EMAIL e SEED_PSICOLOGA_PASSWORD (10+ caracteres) no .env.'); process.exit(1); }

const existing = ((await auth.adminListUsers()).users ?? []).find((u) => u.email === email);
const psi = existing ?? await auth.adminCreateUser(email, password);
if (existing) await auth.adminUpdateUser(existing.id, { password });
await db.upsert('profiles', { id: psi.id, role: 'psicologa', name: 'Débora Mendonça' });
console.log(`- psicóloga: ${email} ${existing ? 'atualizada' : 'criada'}`);

const patientName = 'Luiz Mendonça';
const [pending] = await db.list('patients', `psychologist_id=eq.${psi.id}&name=eq.${encodeURIComponent(patientName)}&limit=1`);
const code = newCode();
const expires = new Date(Date.now() + CODE_HOURS * 36e5).toISOString();
if (!pending) await db.insert('patients', { psychologist_id: psi.id, name: patientName, link_code: code, code_expires_at: expires });
else if (!pending.user_id) await db.update('patients', `id=eq.${pending.id}`, { link_code: code, code_expires_at: expires });

if (pending?.user_id) console.log(`- paciente: ${patientName} já vinculado.`);
else console.log(`- paciente: ${patientName} aguardando vínculo · código ${code} (vale ${CODE_HOURS} horas) · ${process.env.APP_URL || 'http://localhost:3000'}/app?codigo=${code}`);
