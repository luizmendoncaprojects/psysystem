import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, LineChart, Chip, PageHead, Modal, toast, downloadText, usePaged, Pager, useEvery } from '../ui';
import { PatientTable, PatientList, PatientProfile } from './Pacientes';
import { brl, REPORT_KINDS, TODAY_STR } from '../data';
import PanelSettings from './Settings';
import { DocEditor, DocumentosOficiais, fromServerDoc } from './Docs';
import { NewPatientModal, SessionModal, EventModal, RunSessionModal, fromServer } from './Modals';
import { api } from '../api';
import { alerts, summary, evolution, answer, num, fmtH } from '../records';

const CRUMB = { painel: 'Clínica / Painel', agenda: 'Clínica / Agenda', pacientes: 'Clínica / Pacientes', relatorios: 'Clínica / Relatórios e resultados', documentos: 'Clínica / Documentos e notas fiscais', copilot: 'Inteligência / Copilot', config: 'Conta / Perfil e configurações' };
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

export default function Panel({ store }) {
  const { panelPrefs: prefs, setPanelPrefs, patients, docs } = store;
  const [page, setPage] = useState(prefs.home);
  const [pid, setPid] = useState(null); // open patient profile
  const [modal, setModal] = useState(null); // { type, ... }
  const [editor, setEditor] = useState(null); // DocEditor start
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const go = (p) => { setPage(p); setPid(null); setNavOpen(false); document.querySelector('.d-main')?.scrollTo(0, 0); };
  const open = (id) => { if (!id) return; setPage('pacientes'); setPid(id); document.querySelector('.d-main')?.scrollTo(0, 0); };
  const patient = patients.find((p) => p.id === pid);
  // Real patients (created through the API) join the demo list; their link status comes from the server.
  const { setPatients } = store;
  const defaultPerms = prefs.defaultPerms;
  const { setDocs, setRequests, demo, reloadRecords } = store;
  const loadPatients = useCallback(() => {
    api.patients.list().then(({ patients: rows }) => {
      setPatients((ps) => {
        const byId = new Map(rows.map((r) => [r.id, fromServer(r, defaultPerms)]));
        const kept = ps.map((p) => (byId.has(p.id) ? { ...p, name: byId.get(p.id).name, status: byId.get(p.id).status, link: byId.get(p.id).link } : p));
        return [...[...byId.values()].filter((r) => !ps.some((p) => p.id === r.id)), ...kept];
      });
      if (demo) return;
      // Signed documents and patient requests live in the database: replace the server ones, keep local drafts.
      api.documents.list('psicologa').then(({ documents }) => setDocs((all) => [...documents.map((d) => fromServerDoc(d, rows)), ...all.filter((x) => !x.server)]), () => {});
      api.requests.list().then(({ requests }) => setRequests(requests), () => {});
      reloadRecords(); // plans and what the patients logged
    }, () => {}); // offline or demo: keep the local list
  }, [setPatients, setDocs, setRequests, defaultPerms, demo, reloadRecords]);
  useEffect(loadPatients, [loadPatients]);
  useEvery(60_000, loadPatients); // picks up linked patients, new documents and requests
  const closeModal = () => setModal(null);
  const actions = {
    go, open,
    newPatient: () => setModal({ type: 'patient' }),
    newSession: (preset) => setModal({ type: 'session', preset }),
    showEvent: (event) => setModal({ type: 'event', event }),
    run: (id) => setModal({ type: 'run', pid: id }),
    openEditor: (start) => setEditor(start),
  };
  const toSign = docs.filter((d) => d.status === 'Para assinar').length;
  const NAV = [
    { group: 'Clínica', items: [['painel', 'Painel', 'grid'], ['agenda', 'Agenda', 'calendar'], ['pacientes', 'Pacientes', 'users', patients.length], ['relatorios', 'Relatórios e resultados', 'chart'], ['documentos', 'Documentos e notas', 'file', toSign || null]] },
    { group: 'Inteligência', items: [['copilot', 'Copilot IA', 'sparkles']] },
  ];

  return (
    <div className={`desk ${prefs.theme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} style={{ '--accent': prefs.accent }}>
      {navOpen && <button className="side-scrim" aria-label="Fechar menu" onClick={() => setNavOpen(false)} />}
      <aside className={`side ${navOpen ? 'open' : ''}`} id="side-nav">
        <div className="brand"><span className="brand-mark"><Icon name="logo" size={18} stroke={2.2} /></span> KiWave <span className="brand-sub">Consultório</span></div>
        {NAV.map((g) => (
          <nav key={g.group} aria-label={g.group}>
            <p className="side-label">{g.group}</p>
            {g.items.map(([k, l, i, n]) => (
              <button key={k} className={`side-item ${page === k ? 'on' : ''}`} aria-current={page === k ? 'page' : undefined} onClick={() => go(k)}>
                <Icon name={i} size={18} /> <span className="grow">{l}</span>{n ? <span className="side-count">{n}</span> : null}
              </button>
            ))}
          </nav>
        ))}
        <div className="side-foot">
          <div className="status-row"><span className="dot ok" /><div><p className="sm strong">Google Agenda</p><p className="xs muted">Sincronizado há 5 min</p></div></div>
          <div className="status-row"><span className="dot lock"><Icon name="lock" size={11} stroke={2.4} /></span><div><p className="sm strong">IA local ativa</p><p className="xs muted">Dados não saem do servidor</p></div></div>
          <button className={`me ${page === 'config' ? 'on' : ''}`} onClick={() => go('config')} aria-label="Perfil e configurações"><Avatar name={prefs.account.name} size={34} tone={4} /><div className="grow"><p className="sm strong">{prefs.account.name}</p><p className="xs muted">{prefs.account.crp}</p></div><Icon name="gear" size={16} /></button>
        </div>
      </aside>
      <div className="d-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Abrir menu" aria-controls="side-nav" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Icon name="menu" size={20} /></button>
          <p className="crumb">{patient ? <><button className="link sm" onClick={() => go('pacientes')}>Pacientes</button> / {patient.name}</> : CRUMB[page]}</p>
          <SearchBox patients={patients} open={open} />
          <Notifications store={store} open={open} go={go} />
          <button className="avatar-btn" aria-label="Abrir perfil e configurações" onClick={() => go('config')}><Avatar name={prefs.account.name} size={34} tone={4} /></button>
        </header>
        <main className="d-main">
          {page === 'painel' && <Dashboard store={store} a={actions} />}
          {page === 'agenda' && <Agenda store={store} a={actions} />}
          {page === 'pacientes' && (patient ? <PatientProfile key={pid} p={patient} store={store} a={actions} /> : <PatientList patients={patients} open={open} onNew={actions.newPatient} />)}
          {page === 'relatorios' && <Relatorios store={store} a={actions} />}
          {page === 'documentos' && <Documentos store={store} a={actions} />}
          {page === 'copilot' && <Copilot store={store} />}
          {page === 'config' && <PanelSettings store={store} prefs={prefs} setPrefs={setPanelPrefs} onLogout={() => store.logout('psicologa')} />}
        </main>
      </div>

      {modal?.type === 'patient' && <NewPatientModal store={store} onClose={closeModal} onCreated={open} />}
      {modal?.type === 'session' && <SessionModal store={store} preset={modal.preset} onClose={closeModal} />}
      {modal?.type === 'event' && <EventModal event={modal.event} store={store} onClose={closeModal} openPatient={open} onRun={actions.run} />}
      {modal?.type === 'run' && <RunSessionModal patient={patients.find((p) => p.id === modal.pid)} onClose={closeModal} />}
      {editor && <DocEditor start={editor} store={store} onClose={() => setEditor(null)} />}
    </div>
  );
}

/* ---------- Busca (⌘K / Ctrl+K) ---------- */
function SearchBox({ patients, open }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const hits = q ? patients.filter((p) => `${p.name} ${p.cid}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const pick = (id) => { open(id); setQ(''); ref.current?.blur(); };
  return (
    <div className="search-wrap">
      <label className="search"><Icon name="search" size={16} />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) pick(hits[0].id); if (e.key === 'Escape') setQ(''); }}
          placeholder="Buscar paciente" aria-label="Buscar paciente" />
        <kbd>Ctrl K</kbd>
      </label>
      {focus && q && (
        <ul className="dropdown" role="listbox">
          {hits.length ? hits.map((p) => (
            <li key={p.id}><button role="option" aria-selected="false" onMouseDown={() => pick(p.id)}><Avatar name={p.name} size={28} /><span className="grow">{p.name}</span><span className="xs muted">{p.cid || p.status}</span></button></li>
          )) : <li className="muted sm pad-s">Nenhum paciente encontrado</li>}
        </ul>
      )}
    </div>
  );
}

/* ---------- Notificações ---------- */
function Notifications({ store, open, go }) {
  const [show, setShow] = useState(false);
  const [read, setRead] = useState([]);
  const items = [
    ...store.patients.flatMap((p) => p.rx.filter((r) => r.status === 'Nova').map((r) => ({ id: `rx${r.id}`, icon: 'file', text: `${p.name} enviou uma receita`, when: r.date, act: () => open(p.id) }))),
    ...store.notas.filter((n) => n.ack).slice(0, 2).map((n) => ({ id: `nf${n.id}`, icon: 'check', text: `${n.name} deu ciência na nota ${n.n}`, when: n.ack, act: () => go('documentos') })),
    ...(store.requests ?? []).map((r) => ({ id: `rq${r.id}`, icon: 'pen', text: `${r.name} pediu ${r.kind.toLowerCase()}`, when: r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : 'Hoje', act: () => go('documentos') })),
    ...(store.demo ? [{ id: 'mood', icon: 'smile', text: 'Camila Rocha: humor abaixo da média em 4 dos últimos 7 dias', when: 'Hoje', act: () => open('camila') }] : []),
  ];
  const unread = items.filter((i) => !read.includes(i.id)).length;
  return (
    <div className="notif-wrap">
      <button className="icon-btn" aria-label={`Notificações${unread ? `, ${unread} novas` : ''}`} aria-expanded={show} onClick={() => setShow(!show)}>
        <Icon name="bell" size={18} />{unread > 0 && <span className="badge-dot">{unread}</span>}
      </button>
      {show && (
        <div className="dropdown notif" role="dialog" aria-label="Notificações">
          <div className="row-between pad-s"><b className="sm">Notificações</b><button className="link sm" onClick={() => setRead(items.map((i) => i.id))}>Marcar todas como lidas</button></div>
          <ul>
            {items.map((i) => (
              <li key={i.id}><button className={read.includes(i.id) ? 'read' : ''} onClick={() => { setRead([...read, i.id]); setShow(false); i.act(); }}>
                <span className="ico-tile tile-habit sm-tile"><Icon name={i.icon} size={14} /></span><span className="grow sm">{i.text}</span><span className="xs muted">{i.when}</span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- PAINEL ---------- */
const ATTN = [
  ['camila', 'Humor abaixo da média e ansiedade em 9 registros de emoção; enviou receita nova', 'App · Emoções · Receitas', 'smile'],
  ['rafael', '3 doses sem registro desde quinta-feira', 'App · Remédios', 'pill'],
  ['beatriz', 'Compartilhou 2 registros novos no diário', 'App · Diário', 'book'],
  ['thiago', 'Sem sessão há 26 dias', 'Agenda', 'calendar'],
];
function Dashboard({ store, a }) {
  const { patients, events, docs } = store;
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // 0 = Monday … 4 = Friday (agenda grid)
  const nowH = now.getHours() + now.getMinutes() / 60;
  const today = events.filter((e) => e.day === todayIdx && e.kind !== 'g').sort((x, y) => x.start - y.start);
  const sessions = events.filter((e) => e.kind !== 'g');
  const active = patients.filter((p) => p.status.startsWith('Ativ')).length;
  const toSign = docs.filter((d) => d.status === 'Para assinar').length;
  const next = today.find((e) => e.start > nowH);
  const hello = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '');
  // Demo: fixed examples. Real: rules over each patient's logs (src/records.js alerts).
  const attn = store.demo
    ? ATTN.filter(([id]) => patients.some((p) => p.id === id))
    : patients.flatMap((p) => alerts(p).slice(0, 2).map(([msg, src, ic]) => [p.id, msg, src, ic])).slice(0, 8);
  const asked = (store.requests ?? []).length;
  const usage = patients.length ? Math.round(patients.filter((p) => p.use > 0).length / patients.length * 100) : 0;
  return (
    <>
      <PageHead
        title={`${hello}, ${store.panelPrefs.account.name.split(' ')[0]}`} sub={`${dateLabel[0].toUpperCase()}${dateLabel.slice(1)} · ${today.length ? `${today.length} ${today.length === 1 ? 'sessão' : 'sessões'} hoje` : 'nenhuma sessão hoje'}${next ? ` · a próxima é às ${hhmm(next.start)}` : ''}`}
        actions={<><button className="btn-secondary" onClick={a.newPatient}><Icon name="plus" size={16} /> Novo paciente</button><button className="btn-primary" onClick={() => a.newSession()}><Icon name="calendar" size={16} /> Nova sessão</button></>}
      />
      <div className="kpis">
        <Kpi label="Pacientes ativos" value={active} sub={`${patients.filter((p) => p.status === 'Em pausa').length} em pausa · ${patients.filter((p) => p.status === 'Alta').length} alta este mês`} icon="users" />
        <Kpi label="Sessões nesta semana" value={sessions.length} sub={`${sessions.filter((e) => e.kind === 'in').length} presenciais · ${sessions.filter((e) => e.kind !== 'in').length} online`} icon="calendar" />
        <Kpi label="Uso do app pelos pacientes" value={`${usage}%`} sub="registraram algo nos últimos 7 dias" icon="trend" />
        <div className="kpi kpi-action">
          <p className="kpi-label"><Icon name="pen" size={16} /> Documentos solicitados</p>
          <p className="kpi-value">{asked}</p>
          <button className="btn-light-sm" onClick={() => a.go('documentos')}>{asked ? 'Ver pedidos' : toSign ? `${toSign} para assinar` : 'Ver documentos'} <Icon name="chevR" size={14} /></button>
        </div>
      </div>

      <div className="grid-2-1">
        <section className="panel">
          <div className="panel-head"><h2 className="h3">Hoje</h2><button className="link" onClick={() => a.go('agenda')}>Abrir agenda</button></div>
          <ol className="day-list">
            <li className="now-line"><span>Agora · {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></li>
            {today.length === 0 && <li className="muted sm pad-s">Nenhuma sessão hoje. <button className="link sm" onClick={() => a.newSession()}>Agendar sessão</button></li>}
            {today.map((e) => {
              const p = patients.find((x) => x.id === e.pid);
              const first = e.kind === 'first' || !p?.mood;
              const mode = e.kind === 'in' ? 'Presencial' : e.kind === 'on' ? 'Online' : p?.mode ?? 'Presencial';
              return (
                <li key={e.id} className="appt">
                  <span className="appt-time">{hhmm(e.start)}</span>
                  <Avatar name={e.title} size={36} />
                  <button className="grow appt-btn" onClick={() => a.showEvent(e)}><p className="row-title">{e.title}</p><p className="muted sm">{first ? 'Primeira sessão' : 'Sessão semanal'} · {e.dur === 1 ? store.panelPrefs.sessionMin : e.dur * 60} min</p></button>
                  <Chip kind={mode === 'Presencial' ? 'quiet' : 'accent'}><Icon name={mode === 'Presencial' ? 'map' : 'video'} size={12} /> {mode}</Chip>
                  {first ? <span className="muted sm w-btn">Sem histórico</span> : <button className="btn-ghost-sm" onClick={() => a.open(e.pid)}><Icon name="sparkles" size={14} /> Resumo pré-sessão</button>}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2 className="h3">Pedem atenção</h2><p className="muted sm">A partir dos registros do app dos pacientes</p></div></div>
          <ul className="attn">
            {attn.length === 0 && <li className="muted sm pad-s">Nada por aqui. Os alertas aparecem conforme os pacientes usam o app.</li>}
            {attn.map(([id, msg, src, ic]) => {
              const p = patients.find((x) => x.id === id);
              return (
                <li key={`${id}${msg}`}>
                  <button className="attn-row" onClick={() => a.open(id)}>
                    <Avatar name={p.name} size={32} />
                    <div className="grow"><p className="row-title">{p.name}</p><p className="sm">{msg}</p><p className="xs muted row gap4"><Icon name={ic} size={12} /> {src}</p></div>
                    <Icon name="chevR" size={16} className="muted" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="note"><Icon name="shield" size={14} /> Alertas são regras simples sobre os registros. O nível de risco é sempre definido por você.</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Pacientes de hoje</h2><p className="muted sm">Na ordem da agenda</p></div>
          <button className="link" onClick={() => a.go('pacientes')}>Ver todos os {patients.length} <Icon name="chevR" size={14} /></button>
        </div>
        <PatientTable patients={today.map((e) => patients.find((p) => p.id === e.pid)).filter(Boolean)} open={a.open} compact />
      </section>
    </>
  );
}

function Kpi({ label, value, sub, icon }) {
  return (
    <div className="kpi">
      <p className="kpi-label"><Icon name={icon} size={16} /> {label}</p>
      <p className="kpi-value">{value}</p>
      <p className="muted sm">{sub}</p>
    </div>
  );
}

/* ---------- AGENDA ---------- */
const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i);
const WD = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const BASE = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })(); // Monday of the current week
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hourOf = (d) => Math.round((d.getHours() + d.getMinutes() / 60) * 2) / 2; // snap to the half-hour grid

// Google events for the shown week → grid items (Mon–Fri, 8h–20h).
function googleToGrid(items, monday) {
  return items.flatMap((g) => {
    const s = new Date(g.start);
    const e = new Date(g.end);
    const day = Math.floor((new Date(s.getFullYear(), s.getMonth(), s.getDate()) - monday) / 864e5);
    const start = Math.max(8, hourOf(s));
    const dur = Math.max(0.5, Math.min(20, hourOf(e)) - start);
    if (day < 0 || day > 4 || start >= 20) return [];
    return [{ id: `g-${g.id}`, day, start, dur, title: g.title, sub: g.fromKiWave ? 'Enviado pelo KiWave' : 'Google Agenda', kind: 'g', google: true }];
  });
}

export function GoogleSync({ g, setG, reload }) {
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try { window.location.assign((await api.google.connect()).url); } catch (e) { toast(e.message, 'warn'); setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try { await api.google.disconnect(); setG({ ...g, connected: false, email: null, items: [] }); toast('Google Agenda desconectado'); } catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); }
  };
  return (
    <section className="panel">
      <div className="row-between">
        <h2 className="h3">Google Agenda</h2>
        {g.connected && <button className={`icon-btn ${g.loading ? 'spin' : ''}`} aria-label="Sincronizar agora" onClick={reload} disabled={g.loading}><Icon name="refresh" size={16} /></button>}
      </div>
      {g.status === 'offline' && <p className="muted sm">Servidor fora do ar. Rode <code>npm run api</code> para conectar.</p>}
      {g.status === 'ok' && !g.configured && <p className="muted sm">Falta configurar: preencha <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no <code>.env</code> e reinicie a API.</p>}
      {g.status === 'ok' && g.configured && !g.connected && (
        <>
          <p className="muted sm">Traga seus compromissos para a agenda do KiWave e envie as sessões para o Google.</p>
          <button className="btn-primary block mt12" onClick={connect} disabled={busy}><Icon name="calendar" size={16} /> {busy ? 'Abrindo o Google…' : 'Conectar Google Agenda'}</button>
        </>
      )}
      {g.connected && (
        <>
          <p className="sm row gap6"><span className="dot ok" /> Conectado como <b>{g.email ?? 'conta Google'}</b></p>
          <p className="xs muted">{g.loading ? 'Sincronizando…' : g.error ? g.error : `${g.items.length} compromissos do Google nesta semana`}</p>
          <ul className="settings">
            <li><span>Enviar sessões novas para o Google</span><Toggle label="Enviar sessões" on={g.send} onChange={(v) => setG({ ...g, send: v })} /></li>
            <li><div><span>Mostrar o nome do paciente no Google</span><p className="xs muted">{g.names ? 'Ligado: o nome aparece no evento' : 'Desligado: aparece só “Sessão”, por sigilo'}</p></div><Toggle label="Mostrar nome" on={g.names} onChange={(v) => setG({ ...g, names: v })} /></li>
          </ul>
          <button className="btn-ghost-sm danger-txt mt8" onClick={disconnect} disabled={busy}>Desconectar</button>
        </>
      )}
    </section>
  );
}

function Agenda({ store, a }) {
  const { events, google: g, setGoogle: setG } = store;
  const [view, setView] = useState('semana');
  const [wk, setWk] = useState(0); // week offset; demo sessions repeat weekly
  const [dayIdx, setDayIdx] = useState(0);
  const monday = addDays(BASE, wk * 7);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));

  const reload = useCallback(async () => {
    setG((x) => ({ ...x, loading: true, error: null }));
    try {
      const { events: items } = await api.google.events(monday.toISOString(), addDays(monday, 5).toISOString());
      setG((x) => ({ ...x, loading: false, items: googleToGrid(items, monday) }));
    } catch (e) { setG((x) => ({ ...x, loading: false, error: e.message })); }
  }, [monday.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (g.connected) reload(); }, [g.connected, reload]);
  useEvery(60_000, () => { if (g.connected && !g.loading) reload(); });

  const all = [...events, ...(g.connected ? g.items : [])];
  const label = view === 'mes'
    ? `${MONTH_NAMES[monday.getMonth()]} de ${monday.getFullYear()}`
    : view === 'dia'
      ? `${WD[dayIdx].toLowerCase()}, ${days[dayIdx].getDate()} de ${MONTH_NAMES[days[dayIdx].getMonth()]}`
      : `${days[0].getDate()} – ${days[4].getDate()} de ${MONTH_NAMES[days[4].getMonth()]} de ${days[4].getFullYear()}`;
  const step = (n) => {
    if (view === 'dia') { const d = dayIdx + n; if (d < 0) { setWk(wk - 1); setDayIdx(4); } else if (d > 4) { setWk(wk + 1); setDayIdx(0); } else setDayIdx(d); }
    else if (view === 'mes') setWk(wk + n * 4);
    else setWk(wk + n);
  };
  const shown = view === 'dia' ? [dayIdx] : [0, 1, 2, 3, 4];
  const sessions = events.filter((e) => e.kind !== 'g');
  const fromGoogle = all.filter((e) => e.kind === 'g').length;

  return (
    <>
      <PageHead
        title="Agenda" sub={<span className="row gap6"><span className={`dot ${g.connected ? 'ok' : ''}`} /> {g.connected ? 'Google Agenda conectado' : 'Google Agenda não conectado'}</span>}
        actions={<button className="btn-primary" onClick={() => a.newSession()}><Icon name="plus" size={16} /> Nova sessão</button>}
      />
      <div className="grid-cal">
        <section className="panel p0">
          <div className="cal-toolbar">
            <div className="row gap8">
              <button className="btn-secondary sm-btn" onClick={() => { setWk(0); setDayIdx(0); }}>Hoje</button>
              <button className="icon-btn" aria-label="Anterior" onClick={() => step(-1)}><Icon name="chevL" size={18} /></button>
              <button className="icon-btn" aria-label="Próximo" onClick={() => step(1)}><Icon name="chevR" size={18} /></button>
              <h2 className="h3 cap">{label}</h2>
            </div>
            <Segmented small value={view} onChange={setView} options={[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']]} />
          </div>
          {view === 'mes' ? (
            <div className="month">
              {WD.map((w) => <span key={w} className="month-h">{w}</span>)}
              {Array.from({ length: 4 }, (_, r) => [0, 1, 2, 3, 4].map((i) => {
                const d = addDays(addDays(BASE, (wk + r) * 7 - 7), i);
                const n = sessions.filter((e) => e.day === i).length;
                const isToday = d.getTime() === BASE.getTime();
                return (
                  <button key={`${r}-${i}`} className={`month-cell ${isToday ? 'today' : ''}`} onClick={() => { setWk(wk + r - 1); setDayIdx(i); setView('dia'); }}>
                    <b>{d.getDate()}</b><span className="xs muted">{n} sessões</span>
                    <span className="month-dots">{Array.from({ length: n }, (_, k) => <i key={k} />)}</span>
                  </button>
                );
              }))}
            </div>
          ) : (
            <div className="cal">
              <div className="cal-head" style={{ gridTemplateColumns: `56px repeat(${shown.length}, minmax(120px, 1fr))` }}>
                <span />
                {shown.map((i) => <span key={i} className={wk === 0 && i === 0 ? 'today' : ''}><small>{WD[i]}</small><b>{days[i].getDate()}</b></span>)}
              </div>
              <div className="cal-body" style={{ gridTemplateColumns: `56px repeat(${shown.length}, minmax(120px, 1fr))` }}>
                <div className="cal-hours">{HOURS.map((h) => <span key={h}>{String(h).padStart(2, '0')}:00</span>)}</div>
                {shown.map((d) => (
                  <div key={d} className="cal-day">
                    {HOURS.map((h) => <button key={h} className="cal-slot" aria-label={`Agendar ${WD[d]} às ${h}h`} onClick={() => a.newSession({ day: d, start: h })} />)}
                    {wk === 0 && d === (new Date().getDay() + 6) % 7 && new Date().getHours() >= 8 && new Date().getHours() < 20 && <span className="cal-now" style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60 - 8) * 56}px` }} />}
                    {all.filter((e) => e.day === d).map((e) => (
                      <button key={e.id} className={`ev ev-${e.kind} ${e.google ? 'ev-google' : ''}`} style={{ top: (e.start - 8) * 56 + 2, height: e.dur * 56 - 4 }} onClick={() => a.showEvent(e)}>
                        <p className="ev-t">{e.title}</p>
                        <p className="ev-s">{hhmm(e.start)} · {e.sub}</p>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <div className="stack">
          <section className="panel">
            <h2 className="h3">Esta semana</h2>
            <div className="mini-kpis">
              <div><p className="kpi-value sm-kpi">{sessions.length}</p><p className="muted sm">sessões</p></div>
              <div><p className="kpi-value sm-kpi">{Math.max(0, 5 * 12 - all.reduce((s, e) => s + e.dur, 0))}</p><p className="muted sm">horas livres</p></div>
            </div>
            <ul className="legend">
              <li><span className="lg lg-in" /> Presencial <b>{sessions.filter((e) => e.kind === 'in').length}</b></li>
              <li><span className="lg lg-on" /> Online <b>{sessions.filter((e) => e.kind !== 'in').length}</b></li>
              <li><span className="lg lg-g" /> Compromissos (Google e bloqueios) <b>{fromGoogle}</b></li>
            </ul>
          </section>
          <GoogleSync g={g} setG={setG} reload={reload} />
        </div>
      </div>
    </>
  );
}

/* ---------- RELATÓRIOS ---------- */
const SCALES = [
  ['camila', 'GAD-7 · ansiedade · 4 aplicações', 21, 'leve', [['mar', 14], ['jun', 12], ['set', 10], ['nov', 9]]],
  ['rafael', 'PHQ-9 · humor depressivo · 3 aplicações', 27, 'moderada', [['jul', 18], ['set', 15], ['nov', 13]]],
  ['beatriz', 'GAD-7 · ansiedade · 3 aplicações', 21, 'leve', [['ago', 9], ['out', 7], ['nov', 5]]],
];
const STATUS_KIND = { Assinado: 'ok', 'Para assinar': 'warn', Rascunho: 'quiet', 'Rascunho da IA': 'ai', 'Em revisão': 'warn' };

function Relatorios({ store, a }) {
  const { docs, setDocs, patients, panelPrefs } = store;
  const [f, setF] = useState('todos');
  const [gen, setGen] = useState(null); // AI draft modal: { pid, period }
  const reports = docs.filter((d) => REPORT_KINDS.includes(d.tpl) || d.title.startsWith('Evolução'));
  const isDraft = (d) => d.status !== 'Assinado';
  const rows = reports.filter((r) => f === 'todos' || (f === 'rasc' ? isDraft(r) : !isDraft(r)));
  const pg = usePaged(rows, 8);
  const generate = () => {
    const p = patients.find((x) => x.id === gen.pid);
    const analysis = p.record ? summary(p.record).join('\n') : p.mood ? `Humor médio no app de ${(p.mood.reduce((t, v) => t + v, 0) / p.mood.length).toFixed(1).replace('.', ',')} em 14 dias.` : 'Sem registros suficientes no app.';
    const body = `IDENTIFICAÇÃO\nAutora: ${panelPrefs.account.name}, ${panelPrefs.account.crp}.\nInteressado: ${p.name}.\nAssunto: evolução ${gen.period.toLowerCase()}.\n\nPROCEDIMENTO\nAtendimentos ${p.mode === 'Online' ? 'online' : 'presenciais'} semanais de ${panelPrefs.sessionMin} minutos, com registros pelo app KiWave (uso em ${p.use}% dos últimos 14 dias).\n\nANÁLISE\nDados do app (contas automáticas, revise):\n${analysis}\n___\n\nCONCLUSÃO\n___`;
    const doc = { id: Date.now(), tpl: 'relatorio', pid: p.id, name: p.name, date: TODAY_STR, title: `Evolução · ${gen.period}`, body, status: 'Rascunho da IA', delivery: '—', code: null };
    setDocs([doc, ...docs]);
    setGen(null);
    a.openEditor({ docId: doc.id });
  };
  return (
    <>
      <PageHead title="Relatórios e resultados" sub="Escalas aplicadas, evolução dos pacientes e documentos em produção" actions={<button className="btn-primary" onClick={() => a.openEditor({ tpl: 'relatorio' })}><Icon name="plus" size={16} /> Novo relatório</button>} />
      <section className="panel">
        <div className="panel-head"><h2 className="h3">Resultados de escalas</h2><button className="link" onClick={() => a.go('copilot')}><Icon name="sparkles" size={14} /> Ver evolução no Copilot</button></div>
        <div className="scales">
          {SCALES.filter(([id]) => patients.some((p) => p.id === id)).length === 0 && <p className="muted sm">Nenhuma escala aplicada ainda.</p>}
          {SCALES.filter(([id]) => patients.some((p) => p.id === id)).map(([id, s, max, band, pts]) => {
            const p = patients.find((x) => x.id === id);
            const last = pts[pts.length - 1][1];
            return (
              <button key={id} className="scale-card" onClick={() => a.open(id)}>
                <div className="row gap10"><Avatar name={p.name} size={32} /><div><p className="row-title">{p.name}</p><p className="xs muted">{s}</p></div></div>
                <div className="row-between mt12">
                  <p><span className="kpi-value sm-kpi">{last}</span><span className="muted sm"> de {max} · {band}</span></p>
                  <Chip kind="ok"><Icon name="trend" size={12} /> −{pts[0][1] - last} pontos</Chip>
                </div>
                <div className="scale-bars">
                  {pts.map(([m, v]) => (
                    <div key={m}><span className="sb-v">{v}</span><div className="sb-track"><span style={{ height: `${(v / max) * 100}%` }} /></div><span className="xs muted">{m}</span></div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <p className="note">Escalas de rastreio de uso livre. Instrumentos com restrição do SATEPSI ficam fora do app até validação.</p>
      </section>
      <section className="panel ai-panel row-between wrap gap16">
        <div className="row gap12">
          <span className="ico-tile tile-ai"><Icon name="sparkles" size={20} /></span>
          <div><h2 className="h3">Rascunho de relatório com apoio da IA</h2><p className="muted sm">Monta um rascunho a partir das sessões e dos registros do app. Você revisa e completa antes de assinar.</p></div>
        </div>
        <button className="btn-primary" disabled={!patients.length} onClick={() => setGen({ pid: patients[0].id, period: 'Novembro/2026' })}>Gerar rascunho</button>
      </section>
      <section className="panel">
        <div className="panel-head"><h2 className="h3">Relatórios</h2><Segmented small value={f} onChange={setF} options={[['todos', 'Todos', reports.length], ['rasc', 'Em produção', reports.filter(isDraft).length], ['emit', 'Assinados']]} /></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Relatório</th><th>Paciente</th><th>Status</th><th>Atualizado</th><th className="right">Ação</th></tr></thead>
            <tbody>
              {pg.rows.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => a.openEditor({ docId: d.id })}>
                  <td className="row-title">{d.title}</td>
                  <td><div className="row gap8"><Avatar name={d.name} size={26} />{d.name}</div></td>
                  <td><Chip kind={STATUS_KIND[d.status] ?? 'quiet'}>{d.status}</Chip></td>
                  <td>{d.date}</td>
                  <td className="right"><button className={d.status === 'Rascunho da IA' ? 'btn-secondary sm-btn' : 'btn-ghost-sm'}>{d.status === 'Assinado' ? 'Abrir' : d.status === 'Rascunho da IA' ? 'Revisar' : 'Continuar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager p={pg} noun="relatórios" />
      </section>
      {gen && (
        <Modal title="Gerar rascunho com a IA" sub="Usa as sessões e os registros do app do período. Nada é enviado para fora do servidor." onClose={() => setGen(null)}
          footer={<><button className="btn-secondary" onClick={() => setGen(null)}>Cancelar</button><button className="btn-primary" onClick={generate}><Icon name="sparkles" size={16} /> Gerar e abrir no editor</button></>}>
          <label className="field">Paciente<select className="select" value={gen.pid} onChange={(e) => setGen({ ...gen, pid: e.target.value })}>{patients.filter((p) => p.status !== 'Alta').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field">Período<select className="select" value={gen.period} onChange={(e) => setGen({ ...gen, period: e.target.value })}>{['Novembro/2026', 'Outubro/2026', 'Último trimestre'].map((m) => <option key={m}>{m}</option>)}</select></label>
        </Modal>
      )}
    </>
  );
}

/* ---------- DOCUMENTOS E NOTAS ---------- */
const MONTHS = ['Novembro/2026', 'Outubro/2026', 'Setembro/2026', 'Agosto/2026'];

function Documentos({ store, a }) {
  const [tab, setTab] = useState('docs');
  return (
    <>
      <div className="tabs-line" role="tablist">
        {[['docs', 'Documentos oficiais'], ['nf', 'Notas fiscais']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'docs' ? <DocumentosOficiais store={store} openEditor={a.openEditor} /> : <NotasFiscais store={store} />}
    </>
  );
}

// The system does not issue invoices: the psychologist issues them elsewhere (prefeitura, contador) and uploads the PDF here.
function NotasFiscais({ store }) {
  const { notas, setNotas, patients, panelPrefs } = store;
  const active = patients.filter((p) => p.status.startsWith('Ativ'));
  const blank = { pid: active[0]?.id, comp: MONTHS[0], n: '', sessions: 4, value: 4 * panelPrefs.price, file: null };
  const [draft, setDraft] = useState(null);
  const [view, setView] = useState(null); // nota shown in the preview modal
  const [error, setError] = useState('');
  const [f, setF] = useState('todas');

  const list = notas.filter((r) => f === 'todas' || (f === 'aguardando' ? !r.ack : !!r.ack));
  const pg = usePaged(list, 8);
  const month = notas.filter((r) => r.comp === 'Outubro/2026');
  const waiting = notas.filter((r) => !r.ack).length;
  const missing = active.filter((p) => !month.some((r) => r.pid === p.id)).length;

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Envie a nota em PDF.'); e.target.value = ''; return; }
    setError('');
    setDraft({ ...draft, file });
  };
  const send = (e) => {
    e.preventDefault();
    if (!draft.file) { setError('Escolha o PDF da nota.'); return; }
    const p = patients.find((x) => x.id === draft.pid);
    setNotas([{ id: Date.now(), n: draft.n.trim() || '—', pid: p.id, name: p.name, comp: draft.comp, sessions: +draft.sessions, value: +draft.value, sent: TODAY_STR, file: draft.file.name, url: URL.createObjectURL(draft.file), ack: null }, ...notas]);
    toast(`Nota enviada ao app de ${p.name.split(' ')[0]}`);
    setDraft(null);
  };
  const exportCsv = () => downloadText('notas-fiscais.csv', ['numero;paciente;competencia;sessoes;valor;enviada;ciencia', ...notas.map((r) => [r.n, r.name, r.comp, r.sessions, r.value, r.sent, r.ack ?? ''].join(';'))].join('\n'), 'text/csv');

  return (
    <>
      <PageHead
        title="Notas fiscais" sub="Emita a nota no sistema da prefeitura ou com seu contador e envie o PDF aqui. O paciente recebe no app e dá ciência."
        actions={<><button className="btn-secondary" onClick={exportCsv}><Icon name="download" size={16} /> Exportar lista</button><button className="btn-primary" disabled={!active.length} title={active.length ? undefined : 'Cadastre um paciente primeiro'} onClick={() => { setDraft(blank); setError(''); }}><Icon name="upload" size={16} /> Enviar nota</button></>}
      />
      <div className="kpis">
        <div className="kpi"><p className="kpi-label"><Icon name="file" size={16} /> Enviadas de outubro</p><p className="kpi-value">{brl(month.reduce((s, r) => s + r.value, 0))}</p><p className="muted sm">{month.length} notas</p></div>
        <div className="kpi"><p className="kpi-label"><Icon name="clock" size={16} /> Aguardando ciência</p><p className="kpi-value">{waiting}</p><p className="muted sm">pacientes ainda não confirmaram</p></div>
        <div className="kpi"><p className="kpi-label"><Icon name="users" size={16} /> Sem nota de outubro</p><p className="kpi-value">{missing}</p><p className="muted sm">pacientes ativos</p></div>
        <div className="kpi"><p className="kpi-label"><Icon name="send" size={16} /> Entrega</p><p className="kpi-value sm-kpi">No app</p><p className="muted sm">o paciente é avisado ao receber</p></div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2 className="h3">Notas enviadas</h2>
          <Segmented small value={f} onChange={setF} options={[['todas', 'Todas', notas.length], ['aguardando', 'Aguardando ciência', waiting], ['ciente', 'Com ciência']]} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nº</th><th>Paciente</th><th>Competência</th><th>Sessões</th><th>Valor</th><th>Enviada em</th><th>Ciência do paciente</th><th className="right">Arquivo</th></tr></thead>
            <tbody>
              {pg.rows.map((r) => (
                <tr key={r.id}>
                  <td className="strong">{r.n}</td>
                  <td><div className="row gap8"><Avatar name={r.name} size={26} />{r.name}</div></td>
                  <td>{r.comp}</td>
                  <td>{r.sessions}</td>
                  <td className="strong">{brl(r.value)}</td>
                  <td>{r.sent}</td>
                  <td>{r.ack ? <Chip kind="ok"><Icon name="check" size={12} stroke={2.4} /> {r.ack}</Chip> : <Chip kind="warn"><Icon name="clock" size={12} /> Aguardando</Chip>}</td>
                  <td className="right">
                    {r.url
                      ? <a className="btn-ghost-sm" href={r.url} target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> Ver PDF</a>
                      : <button className="btn-ghost-sm" onClick={() => setView(r)}><Icon name="eye" size={14} /> Ver PDF</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager p={pg} noun="notas" />
      </section>

      {draft && (
        <Modal title="Enviar nota fiscal" sub="O PDF vai para o app do paciente, que confirma o recebimento." onClose={() => setDraft(null)}
          footer={<><button className="btn-secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="btn-primary" form="nf-form"><Icon name="send" size={14} /> Enviar ao app do paciente</button></>}>
          <form id="nf-form" className="stack-12" onSubmit={send}>
            <div className="grid-2f">
              <label className="field">Paciente<select className="select" value={draft.pid} onChange={(e) => setDraft({ ...draft, pid: e.target.value })}>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="field">Competência<select className="select" value={draft.comp} onChange={(e) => setDraft({ ...draft, comp: e.target.value })}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className="field">Nº da nota (opcional)<input value={draft.n} onChange={(e) => setDraft({ ...draft, n: e.target.value })} placeholder="000188" /></label>
              <label className="field">Sessões<input type="number" min="1" value={draft.sessions} onChange={(e) => setDraft({ ...draft, sessions: e.target.value, value: e.target.value * panelPrefs.price })} /></label>
              <label className="field">Valor (R$)<input type="number" min="0" step="0.01" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
            </div>
            <label className={`file-drop ${draft.file ? 'has' : ''}`}>
              <Icon name={draft.file ? 'check' : 'upload'} size={18} />
              <span>{draft.file ? draft.file.name : 'Escolher o PDF da nota'}</span>
              <input type="file" accept="application/pdf" onChange={pickFile} aria-label="PDF da nota fiscal" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Modal>
      )}
      {view && (
        <Modal title={`Nota ${view.n}`} sub={`${view.name} · ${view.comp}`} onClose={() => setView(null)}
          footer={<><button className="btn-secondary" onClick={() => setView(null)}>Fechar</button><button className="btn-primary" onClick={() => downloadText(view.file.replace('.pdf', '.txt'), `NFS-e ${view.n}\nTomador: ${view.name}\nCompetência: ${view.comp}\nServiço: psicoterapia (${view.sessions} sessões)\nValor: ${brl(view.value)}`)}><Icon name="download" size={16} /> Baixar</button></>}>
          <div className="nf-mock">
            <p className="xs muted">NOTA FISCAL DE SERVIÇOS ELETRÔNICA · arquivo de exemplo</p>
            <dl className="acc-list">
              <div><dt>Número</dt><dd>{view.n}</dd></div>
              <div><dt>Prestador</dt><dd>{panelPrefs.account.name} · {panelPrefs.account.doc}</dd></div>
              <div><dt>Tomador</dt><dd>{view.name}</dd></div>
              <div><dt>Serviço</dt><dd>Psicoterapia · {view.sessions} sessões</dd></div>
              <div><dt>Competência</dt><dd>{view.comp}</dd></div>
              <div><dt>Valor</dt><dd>{brl(view.value)}</dd></div>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- COPILOT ---------- */
const MONTHLY = [2.6, 2.7, 2.9, 3.1, 3.3, 2.8, 3.4, 3.6, 3.6];
const ANSWERS = [
  [/sess/i, 'Últimas 4 sessões: (22/10) planejamento da semana e higiene do sono; (29/10) ansiedade antes de reuniões, treino de respiração; (05/11) revisão dos registros, boa adesão; (12/11) primeira semana de caminhadas e conflito com o gestor. Tema que se repete: trabalho como gatilho.'],
  [/escala|gad/i, 'Desde a última aplicação (set, GAD-7 = 10) o escore caiu para 9, ainda na faixa leve. Os itens que mais pesam são “preocupação excessiva” e “dificuldade para relaxar”. Insônia inicial melhorou; despertares de madrugada voltaram nesta semana.'],
  [/evolu/i, 'Rascunho: Paciente relata semana com queda de humor a partir de 13/11, associada a conversa difícil com o gestor. Manteve respiração guiada diariamente e usou a técnica de madrugada (15/11). Trabalhado: ___. Combinado: ___.'],
];

function Copilot({ store }) {
  return store.demo ? <CopilotDemo /> : <CopilotReal patients={store.patients.filter((p) => p.record)} />;
}

// Real patients: evolution computed from the app logs (first period vs the latest), plus keyword answers.
function CopilotReal({ patients }) {
  const [pid, setPid] = useState(patients[0]?.id);
  const [q, setQ] = useState('');
  const [chat, setChat] = useState([]);
  const p = patients.find((x) => x.id === pid) ?? patients[0];
  if (!p) {
    return (
      <section className="panel empty-state">
        <span className="ico-tile tile-ai"><Icon name="sparkles" size={22} /></span>
        <h1 className="d-title">Copilot de evolução</h1>
        <p className="muted">Aparece quando algum paciente vinculado começar a registrar no app.</p>
      </section>
    );
  }
  const ev = evolution(p.record);
  const ask = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setChat((c) => [...c, { who: 'me', text }, { who: 'ai', text: answer(text, p.record) }]);
    setQ('');
  };
  const mm = (k) => { const [y, m] = k.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m - 1]}/${y.slice(2)}`; };
  return (
    <>
      <div className="copilot-hero">
        <div className="row-between wrap gap12">
          <div className="row gap10"><Avatar name={p.name} size={36} tone={2} /><div><p className="row-title">{p.name}</p><p className="xs on-dark-muted">{ev.spanDays ? `${ev.spanDays} dias de registros` : 'Sem registros de humor ainda'}</p></div></div>
          <select className="select" value={p.id} onChange={(e) => { setPid(e.target.value); setChat([]); }} aria-label="Paciente">{patients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
        <h1 className="hero-title mt16">Evolução pelos registros do app</h1>
        <p className="on-dark-muted">Primeiros {ev.win} dias comparados aos últimos {ev.win} · contas automáticas, sem modelo de IA</p>
        <div className="hero-kpis">
          {[['Humor médio', ev.first.moodAvg, ev.last.moodAvg, (v) => num(v)], ['Hábitos cumpridos', ev.first.habitPct, ev.last.habitPct, (v) => `${v}%`], ['Sono médio', ev.first.sleepAvg, ev.last.sleepAvg, fmtH], ['Emoções difíceis', ev.first.hard, ev.last.hard, String]].map(([l, a, b, f]) => (
            <div key={l}><p className="xs on-dark-muted">{l}</p><p className="hero-v">{a == null ? '—' : f(a)} → {b == null ? '—' : f(b)}</p></div>
          ))}
        </div>
      </div>
      <div className="grid-2-1">
        <section className="panel">
          <div className="panel-head"><div><h2 className="h3">Humor médio por mês</h2><p className="muted sm">Escala de 1 a 6 registrada no app</p></div></div>
          {ev.monthly.length >= 2
            ? <LineChart points={ev.monthly.map(([, v]) => v)} height={180} labels={ev.monthly.map(([k]) => mm(k))} />
            : <p className="muted pad center">O gráfico aparece com pelo menos 2 meses de registros.</p>}
        </section>
        <div className="stack">
          <section className="panel">
            <h2 className="h3 row gap6 ok-txt"><Icon name="trend" size={18} /> Sinais de melhoria</h2>
            <ul className="bullets ok">{ev.better.map((t) => <li key={t}>{t}</li>)}{!ev.better.length && <li className="muted">Nada a destacar ainda.</li>}</ul>
          </section>
          <section className="panel">
            <h2 className="h3 row gap6 warn-txt"><Icon name="alert" size={18} /> Pontos de atenção</h2>
            <ul className="bullets warn">{ev.worse.map((t) => <li key={t}>{t}</li>)}{!ev.worse.length && <li className="muted">Nada a destacar ainda.</li>}</ul>
          </section>
        </div>
      </div>
      <section className="panel ai-panel">
        <div className="panel-head"><h2 className="h3 row gap6"><Icon name="sparkles" size={18} /> Sugestões para a próxima sessão</h2><span className="xs muted">A partir da pauta e dos registros · a decisão é sempre sua</span></div>
        <ol className="suggest">{ev.suggestions.map((t) => <li key={t}>{t}</li>)}{!ev.suggestions.length && <li className="muted">Sem sugestões: poucos registros ainda.</li>}</ol>
      </section>
      {chat.length > 0 && (
        <section className="panel chat" aria-live="polite">
          {chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.who === 'ai' && <Icon name="sparkles" size={14} />}<p>{m.text}</p></div>)}
        </section>
      )}
      <form className="ask" onSubmit={ask}>
        <div className="ask-box">
          <Icon name="sparkles" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Pergunte sobre ${p.name.split(' ')[0]}: humor, sono, hábitos, remédios…`} aria-label="Pergunte ao Copilot" />
          <button className="btn-icon" aria-label="Enviar" disabled={!q.trim()}><Icon name="send" size={16} /></button>
        </div>
        <div className="row gap8 wrap">
          {['Resuma a semana', 'Como está o sono?', 'E os hábitos?', 'Quais emoções aparecem?'].map((x) => <button type="button" key={x} className="chip-sel" onClick={() => setQ(x)}>{x}</button>)}
        </div>
      </form>
    </>
  );
}

function CopilotDemo() {
  const [q, setQ] = useState('');
  const [chat, setChat] = useState([]);
  const [thinking, setThinking] = useState(false);
  const ask = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || thinking) return;
    setChat((c) => [...c, { who: 'me', text }]);
    setQ('');
    setThinking(true);
    setTimeout(() => {
      const hit = ANSWERS.find(([re]) => re.test(text));
      setChat((c) => [...c, { who: 'ai', text: hit ? hit[1] : 'Nos registros da Camila não encontrei algo específico sobre isso. Tente perguntar sobre sessões, escalas, sono, hábitos ou humor.' }]);
      setThinking(false);
    }, 700);
  };
  return (
    <>
      <div className="copilot-hero">
        <div className="row-between wrap gap12">
          <div className="row gap10"><Avatar name="Camila Rocha" size={36} tone={2} /><div><p className="row-title">Camila Rocha</p><p className="xs on-dark-muted">Mar – Nov 2026</p></div></div>
          <span className="chip chip-glass"><Icon name="lock" size={12} /> Processado localmente</span>
        </div>
        <p className="eyebrow on-dark mt16">Copilot de evolução</p>
        <h1 className="hero-title">Camila está evoluindo</h1>
        <p className="on-dark-muted">Primeiros 3 meses (mar–mai) comparados aos últimos 3 (set–nov) · sessões, escalas e registros do app</p>
        <div className="hero-kpis">
          {[['Humor médio no app', '2,7 → 3,6', '+0,9 ponto'], ['GAD-7', '14 → 9', 'De moderada para leve'], ['Hábitos cumpridos', '41% → 68%', '+27 p.p.'], ['Faltas', '3 → 0', 'Presença em todas as sessões']].map(([l, v, s]) => (
            <div key={l}><p className="xs on-dark-muted">{l}</p><p className="hero-v">{v}</p><p className="xs hero-delta"><Icon name="trend" size={12} /> {s}</p></div>
          ))}
        </div>
      </div>

      <div className="grid-2-1">
        <section className="panel">
          <div className="panel-head"><div><h2 className="h3">Humor médio por mês</h2><p className="muted sm">Escala de 1 a 6 registrada pela paciente no app · marcos anotados por você</p></div></div>
          <div className="milestones"><span style={{ left: '12.5%' }}><Icon name="pill" size={12} /> Início da medicação</span><span style={{ left: '62.5%' }}><Icon name="flag" size={12} /> Mudança de emprego</span></div>
          <LineChart points={MONTHLY} height={180} marks={[1, 5]} bands={[[0, 2, 'band1'], [6, 8, 'band2']]} labels={['mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov']} />
          <div className="legend row gap16 mt8"><span className="row gap6"><span className="lg lg-band1" /> Primeiros 3 meses</span><span className="row gap6"><span className="lg lg-band2" /> Últimos 3 meses</span></div>
        </section>
        <div className="stack">
          <section className="panel">
            <h2 className="h3 row gap6 ok-txt"><Icon name="trend" size={18} /> Sinais de melhoria</h2>
            <ul className="bullets ok">
              <li>Semanas com humor médio abaixo de 3 caíram de 9 para 2.</li>
              <li>GAD-7 saiu da faixa moderada (14) para a leve (9).</li>
              <li>A respiração guiada virou rotina: 12 dias seguidos, usada inclusive de madrugada.</li>
              <li>Recuperou-se da queda de agosto em cerca de 5 semanas.</li>
            </ul>
          </section>
          <section className="panel">
            <h2 className="h3 row gap6 warn-txt"><Icon name="alert" size={18} /> Pontos de atenção</h2>
            <ul className="bullets warn">
              <li>Quedas de humor coincidem com situações de trabalho: em agosto e de novo após 13/11.</li>
              <li>“Dormir antes das 23h” é o hábito com menor adesão: 43% dos dias no trimestre.</li>
              <li>Despertares de madrugada voltaram a aparecer no diário nesta semana.</li>
            </ul>
          </section>
        </div>
      </div>

      <section className="panel ai-panel">
        <div className="panel-head"><h2 className="h3 row gap6"><Icon name="sparkles" size={18} /> Sugestões para a sessão de quinta</h2><span className="xs muted">Apoio ao raciocínio clínico · a decisão é sempre sua</span></div>
        <ol className="suggest">
          <li><b>Retomar o conflito com o gestor:</b> é o item prioritário da pauta e coincide com a queda de humor desde 13/11.</li>
          <li><b>Revisar a rotina de sono:</b> dormir cedo é o hábito de menor adesão e os despertares voltaram.</li>
          <li><b>Explorar o uso da respiração antes de reuniões</b>, já que a própria paciente relata que ajudou em 15/11.</li>
        </ol>
      </section>

      {chat.length > 0 && (
        <section className="panel chat" aria-live="polite">
          {chat.map((m, i) => <div key={i} className={`msg ${m.who}`}>{m.who === 'ai' && <Icon name="sparkles" size={14} />}<p>{m.text}</p></div>)}
          {thinking && <div className="msg ai"><Icon name="sparkles" size={14} /><p className="muted">Lendo os registros…</p></div>}
        </section>
      )}
      <form className="ask" onSubmit={ask}>
        <div className="ask-box">
          <Icon name="sparkles" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pergunte ao Copilot sobre a Camila…" aria-label="Pergunte ao Copilot" />
          <button className="btn-icon" aria-label="Enviar" disabled={!q.trim() || thinking}><Icon name="send" size={16} /></button>
        </div>
        <div className="row gap8 wrap">
          {['Resuma as últimas 4 sessões', 'O que mudou desde a última escala?', 'Rascunhe a evolução de hoje'].map((s) => (
            <button type="button" key={s} className="chip-sel" onClick={() => setQ(s)}>{s}</button>
          ))}
        </div>
      </form>
    </>
  );
}
