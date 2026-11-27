import { useEffect, useState } from 'react';
import './App.css';
import './App2.css';
import './App3.css';
import './App4.css';
import './App5.css';
import './App6.css';
import Patient from './patient/Patient';
import Panel from './panel/Panel';
import Login, { LinkScreen } from './Login';
import { Toaster, toast } from './ui';
import { api } from './api';
import { INITIAL_PATIENTS, INITIAL_EMOTION_LOG, INITIAL_SLEEP, INITIAL_PATIENT_PREFS, INITIAL_PANEL_PREFS, INITIAL_NOTAS, INITIAL_DOCS, INITIAL_TEMPLATES, INITIAL_EVENTS, ME } from './data';

// Two real entry points: /app (patient, mobile) and /painel (psychologist, desktop).
const viewFromPath = () => (window.location.pathname.startsWith('/painel') ? 'psicologa' : 'paciente');
const GOOGLE_MSG = { conectado: ['Google Agenda conectado', 'ok'], cancelado: ['Conexão com o Google cancelada', 'warn'], erro: ['Não foi possível conectar o Google Agenda. Tente de novo.', 'warn'] };

// initialSessions: tests pass logged-in users and skip the API. undefined = still checking, null = logged out.
export default function App({ initialSessions }) {
  const [view, setView] = useState(viewFromPath);
  useEffect(() => {
    if (window.location.pathname === '/') window.history.replaceState(null, '', `/app${window.location.search}`);
    const onPop = () => setView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => { document.title = view === 'psicologa' ? 'KiWave · Consultório' : 'KiWave'; }, [view]);

  const [sessions, setSessions] = useState(initialSessions ?? { paciente: undefined, psicologa: undefined });
  const setSession = (role, user) => setSessions((s) => ({ ...s, [role]: user }));
  useEffect(() => {
    if (initialSessions) return;
    ['paciente', 'psicologa'].forEach((role) => api.me(role).then(({ user }) => setSession(role, user ?? null), () => setSession(role, null)));
    const g = new URLSearchParams(window.location.search).get('google'); // back from the Google consent screen
    if (g && GOOGLE_MSG[g]) {
      toast(...GOOGLE_MSG[g]);
      window.history.replaceState(null, '', '/painel');
    }
  }, [initialSessions]);
  const logout = async (role) => {
    try { await api.logout(role); } catch { /* cookie may already be gone */ }
    setSession(role, null);
    toast('Você saiu da conta');
  };

  // shortcut: clinical data below is still in-memory demo data; next step is moving it to Supabase tables.
  // Plan (perms, cid, habits, meds, waterGoal, rx) lives on each patient and is set by the psychologist.
  // Patient-generated logs (water, emotions, sleep) exist only for the logged-in patient (ME).
  // Demo data only when tests inject sessions. A real login starts clean: only what the database has.
  const demo = Boolean(initialSessions);
  const [patients, setPatients] = useState(demo ? INITIAL_PATIENTS : []);
  const [water, setWater] = useState(demo ? 750 : 0);
  const [emotions, setEmotions] = useState(demo ? INITIAL_EMOTION_LOG : {});
  const [sleep, setSleep] = useState(demo ? INITIAL_SLEEP : {}); // key = day offset (0 hoje, -1 ontem…)
  const [notas, setNotas] = useState(demo ? INITIAL_NOTAS : []);
  const [docs, setDocs] = useState(demo ? INITIAL_DOCS : []);
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [events, setEvents] = useState(demo ? INITIAL_EVENTS : []);
  // The logged-in patient's own plan (real mode). shortcut: in memory until the plan tables exist in Supabase.
  const [myPlan, setMyPlan] = useState({ perms: { ...INITIAL_PANEL_PREFS.defaultPerms }, habits: [], meds: [], rx: [], waterGoal: 2000 });
  const [requests, setRequests] = useState([]); // document requests made by the patient
  const [patientPrefs, setPatientPrefs] = useState(INITIAL_PATIENT_PREFS);
  const [panelPrefs, setPanelPrefs] = useState(INITIAL_PANEL_PREFS);
  // Google Calendar: status from the API; items = this week's Google events on the grid.
  const [google, setGoogle] = useState({ status: 'loading', configured: false, connected: false, email: null, items: [], send: true, names: false, loading: false, error: null });
  useEffect(() => {
    if (!sessions.psicologa) return;
    api.google.status().then((st) => setGoogle((g) => ({ ...g, status: 'ok', ...st })), () => setGoogle((g) => ({ ...g, status: 'offline' })));
  }, [sessions.psicologa]);
  const updatePatient = (id, patch) => setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Logged-in names override the demo names.
  const patientUser = sessions.paciente;
  const psiUser = sessions.psicologa;
  const pPrefs = patientUser ? { ...patientPrefs, account: { ...patientPrefs.account, name: patientUser.name, email: patientUser.email } } : patientPrefs;
  const psPrefs = psiUser ? { ...panelPrefs, account: { ...panelPrefs.account, name: psiUser.name, email: psiUser.email } } : panelPrefs;

  const me = demo ? patients.find((p) => p.id === ME) : myPlan;
  const myId = demo ? ME : sessions.paciente?.patientId; // patient record this login is linked to
  const store = {
    patients, setPatients, updatePatient, docs, setDocs, templates, setTemplates, events, setEvents, requests, setRequests,
    patientPrefs: pPrefs, setPatientPrefs, panelPrefs: psPrefs, setPanelPrefs, notas, setNotas, water, setWater, emotions, setEmotions, sleep, setSleep,
    perms: me.perms, meds: me.meds, habits: me.habits, waterGoal: me.waterGoal, rx: me.rx,
    setHabits: (habits) => (demo ? updatePatient(ME, { habits }) : setMyPlan((p) => ({ ...p, habits }))),
    setRx: (rx) => (demo ? updatePatient(ME, { rx }) : setMyPlan((p) => ({ ...p, rx }))),
    sessions, logout, google, setGoogle, demo, myId,
  };

  const loading = <div className="boot" role="status">Carregando…</div>;
  let patientScreen;
  if (patientUser === undefined) patientScreen = loading;
  else if (!patientUser) patientScreen = <Login role="paciente" onLogin={(u) => setSession('paciente', u)} />;
  else if (!patientUser.psychologistId) patientScreen = <LinkScreen user={patientUser} onLinked={(u) => setSession('paciente', u)} onLogout={() => logout('paciente')} />;
  else patientScreen = <Patient store={store} />;

  let panelScreen;
  if (psiUser === undefined) panelScreen = loading;
  else if (!psiUser) panelScreen = <Login role="psicologa" onLogin={(u) => setSession('psicologa', u)} />;
  else panelScreen = <Panel store={store} />;

  return (
    <div className={`shell shell-${view}`}>
      {view === 'paciente' ? <div className="stage">{patientScreen}</div> : panelScreen}
      <Toaster />
    </div>
  );
}
