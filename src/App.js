import { useCallback, useEffect, useRef, useState } from 'react';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/patient.css';
import './styles/panel.css';
import './styles/auth.css';
import './styles/wave.css';
import Patient from './patient/Patient';
import Panel from './panel/Panel';
import Login, { LinkScreen } from './Login';
import { Toaster, toast } from './ui';
import { api } from './api';
import { INITIAL_PATIENTS, INITIAL_EMOTION_LOG, INITIAL_SLEEP, INITIAL_PATIENT_PREFS, INITIAL_PANEL_PREFS, INITIAL_NOTAS, INITIAL_DOCS, INITIAL_TEMPLATES, INITIAL_EVENTS, ME } from './data';
import { patientView, withLog, dayKey, offsetKey } from './records';

// Latest call wins after `ms` of quiet, one timer per key (log, diary, topics…).
function useDebouncedSave(save, ms = 600) {
  const timers = useRef({});
  return (key, data) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => save(key, data), ms);
  };
}

// Loads this account's preferences once after login, then saves every change (account data stays out).
function usePrefsSync(active, role, prefs, setPrefs) {
  const loaded = useRef(false);
  useEffect(() => {
    if (!active) { loaded.current = false; return; }
    api.prefs.get(role).then(({ prefs: saved }) => { if (saved) setPrefs((p) => ({ ...p, ...saved, account: p.account })); loaded.current = true; }, () => {});
  }, [active, role, setPrefs]);
  const { account, ...rest } = prefs;
  const json = JSON.stringify(rest);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => api.prefs.save(role, JSON.parse(json)).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [json, role]);
}

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

  // Demo data only when tests inject sessions. A real login reads and writes the patient record in Supabase
  // (/api/records): the plan comes from the psychologist, the logs from the patient (see src/records.js).
  const demo = Boolean(initialSessions);
  const [basePatients, setPatients] = useState(demo ? INITIAL_PATIENTS : []);
  const [water, setWaterDemo] = useState(demo ? 750 : 0);
  const [emotionsDemo, setEmotions] = useState(demo ? INITIAL_EMOTION_LOG : {});
  const [sleepDemo, setSleepDemo] = useState(demo ? INITIAL_SLEEP : {}); // key = day offset (0 hoje, -1 ontem…)
  const [moodDemo, setMoodDemo] = useState(null);
  const [takenDemo, setTakenDemo] = useState({ 1: '08:12' }); // medId → time taken
  const [dayEmotionDemo, setDayEmotionDemo] = useState(null);
  const [todayEmotionsDemo, setTodayEmotionsDemo] = useState([]);
  const [notas, setNotas] = useState(demo ? INITIAL_NOTAS : []);
  const [docs, setDocs] = useState(demo ? INITIAL_DOCS : []);
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [events, setEvents] = useState(demo ? INITIAL_EVENTS : []);
  const [records, setRecords] = useState({}); // psychologist: patientId → record
  const [myRecord, setMyRecord] = useState(null); // patient: own record
  const [requests, setRequests] = useState([]); // document requests made by the patient
  // demo tests the 'onda' identity: blue as the default accent (still changeable in Configurações)
  const [patientPrefs, setPatientPrefs] = useState(demo ? { ...INITIAL_PATIENT_PREFS, accent: '#2f6fd6' } : INITIAL_PATIENT_PREFS);
  const [panelPrefs, setPanelPrefs] = useState(demo ? { ...INITIAL_PANEL_PREFS, accent: '#2f6fd6' } : INITIAL_PANEL_PREFS);
  // Google Calendar: status from the API; items = this week's Google events on the grid.
  const [google, setGoogle] = useState({ status: 'loading', configured: false, connected: false, email: null, items: [], send: true, names: false, loading: false, error: null });
  useEffect(() => {
    if (!sessions.psicologa) return;
    api.google.status().then((st) => setGoogle((g) => ({ ...g, status: 'ok', ...st })), () => setGoogle((g) => ({ ...g, status: 'offline' })));
  }, [sessions.psicologa]);

  // Logged-in names override the demo names.
  const patientUser = sessions.paciente;
  const psiUser = sessions.psicologa;
  usePrefsSync(!demo && Boolean(psiUser), 'psicologa', panelPrefs, setPanelPrefs);
  usePrefsSync(!demo && Boolean(patientUser?.psychologistId), 'paciente', patientPrefs, setPatientPrefs);
  const pPrefs = patientUser ? { ...patientPrefs, account: { ...patientPrefs.account, name: patientUser.name, email: patientUser.email } } : patientPrefs;
  const psPrefs = psiUser ? { ...panelPrefs, account: { ...panelPrefs.account, name: psiUser.name, email: psiUser.email } } : panelPrefs;
  const defaultPerms = panelPrefs.defaultPerms;

  // --- psychologist side: patients enriched with their records; edits saved per key ---
  const reloadRecords = useCallback(() => { if (!demo) api.records.list('psicologa').then(({ records: r }) => setRecords(r), () => {}); }, [demo]);
  const patients = demo ? basePatients : basePatients.map((p) => (records[p.id] || p.link?.linked ? { ...p, ...patientView(records[p.id], defaultPerms) } : p));
  const saveRecord = (pid, key, data) => {
    setRecords((rs) => ({ ...rs, [pid]: { ...rs[pid], [key]: data } }));
    api.records.save('psicologa', key, data, pid).catch((e) => toast(`Não foi possível salvar: ${e.message}`, 'warn'));
  };
  const updatePatient = (id, patch) => {
    if (demo) { setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))); return; }
    const cur = patients.find((p) => p.id === id);
    const rec = records[id] ?? {};
    const planKeys = ['perms', 'habits', 'meds', 'waterGoal'].filter((k) => k in patch);
    if (planKeys.length) {
      const plan = { perms: cur.perms, habits: cur.habits, meds: cur.meds, waterGoal: cur.waterGoal, ...rec.plan };
      planKeys.forEach((k) => { plan[k] = k === 'habits' ? patch.habits.map(({ week, ...h }) => h) : patch[k]; }); // week is derived from the log
      saveRecord(id, 'plan', plan);
    }
    if ('cid' in patch || 'risk' in patch) saveRecord(id, 'clinical', { cid: patch.cid ?? cur.cid, risk: patch.risk ?? cur.risk, riskAt: patch.riskAt ?? cur.riskAt ?? null });
    if ('notes' in patch) saveRecord(id, 'notes', patch.notes);
    if ('triage' in patch) saveRecord(id, 'triage', patch.triage);
    if ('rx' in patch) saveRecord(id, 'rxStatus', Object.fromEntries(patch.rx.filter((r) => r.status !== 'Nova').map((r) => [r.id, { status: r.status, med: r.med }])));
    const rest = Object.fromEntries(Object.entries(patch).filter(([k]) => !['perms', 'habits', 'meds', 'waterGoal', 'cid', 'risk', 'riskAt', 'rx', 'notes', 'triage'].includes(k)));
    if (Object.keys(rest).length) setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, ...rest } : p)));
  };

  // --- patient side: own record; every change to the log is saved (debounced) ---
  const myId = demo ? ME : patientUser?.patientId; // patient record this login is linked to
  const reloadMine = useCallback(() => { if (!demo && patientUser?.patientId) api.records.list('paciente').then(({ record }) => setMyRecord(record), () => {}); }, [demo, patientUser?.patientId]);
  useEffect(reloadMine, [reloadMine]);
  const saveMine = useDebouncedSave((key, data) => api.records.save('paciente', key, data).catch((e) => toast(`Não foi possível salvar: ${e.message}`, 'warn')));
  const putMine = (key, fn) => setMyRecord((r) => { const data = fn(r ?? {}); saveMine(key, data); return { ...r, [key]: data }; });
  const updateLog = (fn) => putMine('log', (r) => fn(withLog(r)));
  const today = dayKey();
  const mine = patientView(myRecord, defaultPerms);
  const myLog = mine.log;
  const lastMoodToday = [...myLog.mood].reverse().find((m) => dayKey(new Date(m.at)) === today)?.v ?? null;
  const realPatient = {
    perms: mine.perms, meds: mine.meds, habits: mine.habits, waterGoal: mine.waterGoal, rx: mine.rx, log: myLog,
    water: myLog.water[today] ?? 0,
    setWater: (v) => updateLog((l) => ({ ...l, water: { ...l.water, [today]: v } })),
    sleep: Object.fromEntries([0, -1, -2, -3, -4, -5, -6].map((o) => [o, myLog.sleep[offsetKey(o)]]).filter(([, v]) => v)),
    setSleep: (s) => updateLog((l) => ({ ...l, sleep: { ...l.sleep, ...Object.fromEntries(Object.entries(s).map(([o, v]) => [offsetKey(+o), v])) } })),
    emotions: mine.emotions,
    addEmotions: (list, extra) => updateLog((l) => ({ ...l, emotions: [...l.emotions, { at: new Date().toISOString(), list, ...extra }] })),
    todayEmotions: [...new Set(myLog.emotions.filter((e) => dayKey(new Date(e.at)) === today).flatMap((e) => e.list))],
    mood: lastMoodToday,
    setMood: (v) => updateLog((l) => ({ ...l, mood: [...l.mood, { at: new Date().toISOString(), v }] })),
    taken: myLog.meds[today] ?? {},
    setTaken: (t) => updateLog((l) => ({ ...l, meds: { ...l.meds, [today]: typeof t === 'function' ? t(l.meds[today] ?? {}) : t } })),
    dayEmotion: myLog.dayEmotion[today] ?? null,
    setDayEmotion: (e) => updateLog((l) => ({ ...l, dayEmotion: { ...l.dayEmotion, [today]: e } })),
    setHabits: (hs) => updateLog((l) => ({ ...l, habits: { ...l.habits, [today]: hs.filter((h) => h.week[6]).map((h) => h.id) } })),
    setRx: (rx) => putMine('rx', () => rx.map(({ url, ...r }) => r)),
    diary: myRecord?.diary ?? [], setDiary: (d) => putMine('diary', () => d),
    topics: myRecord?.topics ?? [], setTopics: (t) => putMine('topics', () => t),
  };
  const meDemo = basePatients.find((p) => p.id === ME);
  const demoPatient = demo && {
    perms: meDemo.perms, meds: meDemo.meds, habits: meDemo.habits, waterGoal: meDemo.waterGoal, rx: meDemo.rx,
    water, setWater: setWaterDemo, sleep: sleepDemo, setSleep: setSleepDemo, emotions: emotionsDemo,
    addEmotions: (list) => { setTodayEmotionsDemo(list); setEmotions((e) => { const n = { ...e }; list.forEach((f) => { n[f] = (n[f] || 0) + 1; }); return n; }); },
    todayEmotions: todayEmotionsDemo,
    mood: moodDemo, setMood: setMoodDemo, taken: takenDemo, setTaken: setTakenDemo,
    dayEmotion: dayEmotionDemo,
    setDayEmotion: (f) => { setEmotions((e) => ({ ...e, ...(dayEmotionDemo && { [dayEmotionDemo]: Math.max(0, (e[dayEmotionDemo] || 0) - 1) }), [f]: (e[f] || 0) + 1 })); setDayEmotionDemo(f); },
    setHabits: (habits) => updatePatient(ME, { habits }),
    setRx: (rx) => updatePatient(ME, { rx }),
  };

  const store = {
    patients, setPatients, updatePatient, records, reloadRecords, docs, setDocs, templates, setTemplates, events, setEvents, requests, setRequests,
    patientPrefs: pPrefs, setPatientPrefs, panelPrefs: psPrefs, setPanelPrefs, notas, setNotas,
    // demo panel overview reads these for the demo patient
    emotions: emotionsDemo, sleep: sleepDemo,
    ...(demo ? demoPatient : realPatient),
    reloadMine, sessions, logout, google, setGoogle, demo, myId,
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
