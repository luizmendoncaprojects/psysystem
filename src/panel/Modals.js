import { useEffect, useState } from 'react';
import { Icon, Avatar, Chip, Modal, toast } from '../ui';
import { FEATURES } from '../data';
import { api } from '../api';

const DAYS = ['Segunda, 16/11', 'Terça, 17/11', 'Quarta, 18/11', 'Quinta, 19/11', 'Sexta, 20/11'];
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

/* ---------- Novo paciente (só o nome) + vínculo ---------- */
// Maps a patient from the API into the panel's local record shape.
export function fromServer(sp, defaultPerms) {
  return {
    id: sp.id, name: sp.name, age: '—', status: sp.linked ? 'Ativo' : 'Aguardando vínculo', last: '—', next: '—', use: 0, risk: 'Não definido', mood: null, cid: '', mode: 'Online',
    perms: { ...defaultPerms }, habits: [], meds: [], rx: [], waterGoal: 2000,
    link: { linked: sp.linked, code: sp.code, url: sp.link, expiresAt: sp.codeExpiresAt },
  };
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const copy = (text, ok) => navigator.clipboard?.writeText(text).then(() => toast(ok), () => toast('Não foi possível copiar. Selecione e copie.', 'warn'));

// Code + link to send to the patient. Used after creating a patient and on the patient profile.
export function LinkCard({ patient, onNewCode, compact }) {
  const l = patient.link;
  if (!l) return null;
  if (l.linked) return <p className="chip chip-ok"><Icon name="check" size={12} stroke={2.4} /> App vinculado</p>;
  const msg = `Olá, ${patient.name.split(' ')[0]}! Baixe o app KiWave, crie sua conta e use o código ${l.code} para se vincular a mim: ${l.url}`;
  return (
    <div className={`link-card ${compact ? 'compact' : ''}`}>
      <div className="row-between wrap gap12">
        <div>
          <p className="xs muted">Código de vínculo{l.expiresAt && ` · vale até ${fmtDate(l.expiresAt)}`}</p>
          <p className="link-code" aria-label={`Código ${l.code.split('').join(' ')}`}>{l.code}</p>
        </div>
        <div className="row gap8 wrap">
          <button className="btn-secondary sm-btn" onClick={() => copy(l.url, 'Link copiado')}><Icon name="copy" size={14} /> Copiar link</button>
          <a className="btn-secondary sm-btn" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Icon name="send" size={14} /> WhatsApp</a>
          {onNewCode && <button className="btn-ghost-sm" onClick={onNewCode}><Icon name="refresh" size={14} /> Novo código</button>}
        </div>
      </div>
      {!compact && <p className="xs muted mt8">O paciente baixa o app, cria a conta com os próprios dados e digita o código. Pronto: ficam vinculados.</p>}
    </div>
  );
}

export function NewPatientModal({ store, onClose, onCreated }) {
  const { setPatients, panelPrefs } = store;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 2) { setError('Informe o nome do paciente.'); return; }
    setBusy(true); setError('');
    try {
      const { patient } = await api.patients.create(n);
      const local = fromServer(patient, panelPrefs.defaultPerms);
      setPatients((ps) => [local, ...ps]);
      setCreated(local);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  if (created) {
    return (
      <Modal title={`${created.name} cadastrado`} sub="Envie o código ou o link. O vínculo acontece quando o paciente digitar o código no app." onClose={onClose}
        footer={<><button className="btn-secondary" onClick={onClose}>Fechar</button><button className="btn-primary" onClick={() => { onCreated?.(created.id); onClose(); }}>Abrir paciente</button></>}>
        <LinkCard patient={created} />
      </Modal>
    );
  }
  return (
    <Modal title="Novo paciente" sub="Só o nome. O paciente completa os próprios dados ao criar a conta no app." onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" form="np-form" disabled={busy}>{busy ? 'Gerando código…' : 'Gerar código de vínculo'}</button></>}>
      <form id="np-form" className="stack-12" onSubmit={save} noValidate>
        <label className="field">Nome do paciente
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!error} />
          {error && <span className="field-err" role="alert">{error}</span>}
        </label>
        <p className="xs muted">Recursos do app que já vêm ligados: {FEATURES.filter(([k]) => panelPrefs.defaultPerms[k]).map(([, l]) => l).join(', ')}.</p>
      </form>
    </Modal>
  );
}

/* ---------- Nova sessão / remarcar ---------- */
export function SessionModal({ store, onClose, event, pid, preset }) {
  const { patients, events, setEvents, panelPrefs } = store;
  const active = patients.filter((p) => p.status !== 'Alta');
  const [d, setD] = useState(event
    ? { pid: event.pid, day: event.day, start: event.start, dur: event.dur * 60, mode: event.sub.startsWith('Presencial') ? 'Presencial' : 'Online', repeat: false }
    : { pid: pid ?? active[0].id, day: 0, start: 15, dur: panelPrefs.sessionMin, mode: 'Online', repeat: true, ...preset });
  const set = (k, num) => (e) => setD({ ...d, [k]: num ? +e.target.value : e.target.value });
  const clash = events.find((x) => x.id !== event?.id && x.day === d.day && d.start < x.start + x.dur && x.start < d.start + d.dur / 60);
  const save = () => {
    const p = patients.find((x) => x.id === d.pid);
    const ev = { id: event?.id ?? Date.now(), day: d.day, start: d.start, dur: Math.max(0.5, d.dur / 60), title: p.name, sub: d.mode, kind: d.mode === 'Online' ? 'on' : 'in', pid: p.id };
    setEvents(event ? events.map((x) => (x.id === event.id ? ev : x)) : [...events, ev]);
    const g = store.google;
    if (!event && g?.connected && g.send) {
      const at = (h) => new Date(2026, 10, 16 + d.day, Math.floor(h), (h % 1) * 60).toISOString(); // demo week
      api.google.create({ summary: g.names ? `Sessão · ${p.name}` : 'Sessão', start: at(d.start), end: at(d.start + d.dur / 60), description: 'Criado pelo KiWave' })
        .then(() => toast('Sessão enviada ao Google Agenda'), (e) => toast(`Google: ${e.message}`, 'warn'));
    }
    toast(`${event ? 'Sessão remarcada' : 'Sessão agendada'}: ${p.name.split(' ')[0]}, ${DAYS[d.day].split(',')[0].toLowerCase()} às ${hhmm(d.start)}`);
    onClose();
  };
  return (
    <Modal title={event ? 'Remarcar sessão' : 'Nova sessão'} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>{event ? 'Salvar' : 'Agendar'}</button></>}>
      <label className="field">Paciente
        <select className="select" value={d.pid} onChange={set('pid')} disabled={!!event}>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>
      <div className="grid-2f">
        <label className="field">Dia<select className="select" value={d.day} onChange={set('day', true)}>{DAYS.map((x, i) => <option key={x} value={i}>{x}</option>)}</select></label>
        <label className="field">Horário<select className="select" value={d.start} onChange={set('start', true)}>{Array.from({ length: 24 }, (_, i) => 8 + i / 2).map((h) => <option key={h} value={h}>{hhmm(h)}</option>)}</select></label>
        <label className="field">Duração<select className="select" value={d.dur} onChange={set('dur', true)}>{[30, 40, 45, 50, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
        <label className="field">Atendimento<select className="select" value={d.mode} onChange={set('mode')}><option>Online</option><option>Presencial</option></select></label>
      </div>
      {!event && <label className="check-row"><span>Repetir toda semana</span><input type="checkbox" checked={d.repeat} onChange={(e) => setD({ ...d, repeat: e.target.checked })} /></label>}
      {clash && <p className="form-warn"><Icon name="alert" size={14} /> Conflito com “{clash.title}” às {hhmm(clash.start)}.</p>}
    </Modal>
  );
}

/* ---------- Detalhes de um evento da agenda ---------- */
export function EventModal({ event, store, onClose, openPatient, onRun }) {
  const [resched, setResched] = useState(false);
  const [cancel, setCancel] = useState(false);
  if (resched) return <SessionModal store={store} event={event} onClose={onClose} />;
  const google = event.kind === 'g';
  const remove = () => { store.setEvents(store.events.filter((x) => x.id !== event.id)); toast(`Sessão desmarcada · ${event.title.split(' ')[0]} será avisado(a) no app`); onClose(); };
  return (
    <Modal title={event.title} sub={`${DAYS[event.day]} · ${hhmm(event.start)} – ${hhmm(event.start + event.dur)}`} onClose={onClose}
      footer={google ? <button className="btn-secondary" onClick={onClose}>Fechar</button> : cancel ? (
        <><span className="foot-note">Desmarcar esta sessão?</span><button className="btn-secondary" onClick={() => setCancel(false)}>Voltar</button><button className="btn-danger" onClick={remove}>Desmarcar</button></>
      ) : (
        <>
          <button className="btn-ghost-sm danger-txt" onClick={() => setCancel(true)}>Desmarcar</button>
          <button className="btn-secondary" onClick={() => setResched(true)}>Remarcar</button>
          <button className="btn-secondary" onClick={() => { openPatient(event.pid); onClose(); }}>Abrir paciente</button>
          <button className="btn-primary" onClick={() => { onClose(); onRun(event.pid); }}><Icon name="video" size={16} /> Iniciar sessão</button>
        </>
      )}>
      {google
        ? <p className="sm">Evento importado do Google Agenda. Edite no Google; o horário fica bloqueado para sessões.</p>
        : (
          <div className="row gap12">
            <Avatar name={event.title} size={44} />
            <div className="grow"><p className="row-title">{event.title}</p><p className="muted sm">{event.sub}</p></div>
            <Chip kind={event.kind === 'on' ? 'accent' : event.kind === 'first' ? 'ok' : 'quiet'}>{event.kind === 'on' ? 'Online' : event.kind === 'first' ? '1ª sessão' : 'Presencial'}</Chip>
          </div>
        )}
    </Modal>
  );
}

/* ---------- Sessão em andamento ---------- */
export function RunSessionModal({ patient, onClose }) {
  const [sec, setSec] = useState(0);
  const [notes, setNotes] = useState('');
  useEffect(() => { const t = setInterval(() => setSec((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const end = () => { toast(`Sessão encerrada · evolução de ${patient.name.split(' ')[0]} salva no prontuário`); onClose(); };
  return (
    <Modal title={`Sessão com ${patient.name}`} sub={patient.mode === 'Online' ? 'Online · link enviado ao app do paciente' : 'Presencial'} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Minimizar</button><button className="btn-primary" onClick={end}>Encerrar e salvar evolução</button></>}>
      <div className="timer"><span className="dot ok" /> <b>{mm}:{ss}</b><span className="muted sm">de 50 min</span></div>
      <label className="field">Evolução da sessão<textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Temas trabalhados, intervenções, combinados para a próxima semana…" /></label>
      <p className="xs muted row gap6"><Icon name="lock" size={12} /> O prontuário é visível só para você.</p>
    </Modal>
  );
}
