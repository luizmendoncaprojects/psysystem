// Patient page in the panel: the main screen of the practice. Everything about one patient, split into sections
// with a left nav. Numbers and findings come from src/insights.js (rules over the app logs, no model).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, Avatar, Segmented, LineChart, MoodFace, Chip, RISK, STATUS, toast, DateField, Modal, smoothPath } from '../ui';
import { CID11 } from '../cid11';
import { cidLabel, RISK_LABEL, fmtL, FEATURES, EMOTIONS } from '../data';
import { LinkCard } from './Modals';
import { Emocoes, Plano, RemediosReceitas, Permissoes, copyText } from './Pacientes';
import { analyze } from '../insights';
import { demoRecord } from '../demoRecord';
import { answer, stats, num, fmtH, fmtDay, sleepMin, lastDays, withLog, dayKey, dailyMood } from '../records';
import { signDocument } from './Docs';
import { api } from '../api';

const EMOTION_POS = EMOTIONS.pos;
const NAV = [
  ['Acompanhamento', [['resumo', 'Visão geral', 'grid'], ['evolucao', 'Evolução', 'trend'], ['humor', 'Humor e emoções', 'smile'], ['sono', 'Sono', 'moon'], ['rotina', 'Hábitos', 'checks'], ['prontuario', 'Prontuário', 'pen'], ['pauta', 'Pauta', 'flag'], ['diario', 'Diário', 'book']]],
  ['Configurar app', [['plano', 'Plano no app', 'sliders'], ['remedios', 'Remédios e receitas', 'pill'], ['permissoes', 'Permissões do app', 'lock']]],
];
const TONE = { atencao: ['alert', 'Atenção'], melhora: ['trend', 'Melhora'], padrao: ['chart', 'Padrão'], info: ['flag', 'Informação'] };
const TILE_SECTION = { humor: 'humor', emocoes: 'humor', sono: 'sono', rotina: 'rotina', remedios: 'rotina', agua: 'rotina' };
const TILE_FEATURE = { humor: 'mood', emocoes: 'emotion', sono: 'sleep', rotina: 'routine', remedios: 'med', agua: 'water' };
const LEVELS = [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']];
const LEVEL_RANK = { alta: 0, media: 1, baixa: 2 };
const NOTE_KINDS = ['Sessão individual', 'Contato', 'Observação', 'Encaminhamento'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDate = (iso) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR');

// Topics in working order: open before done, psychologist level, then the patient's own priority.
export const sortTopics = (topics, triage) => [...topics].sort((a, b) => {
  const ta = triage[a.t] ?? {}; const tb = triage[b.t] ?? {};
  return (ta.done ? 1 : 0) - (tb.done ? 1 : 0) || (LEVEL_RANK[ta.level] ?? 3) - (LEVEL_RANK[tb.level] ?? 3) || (b.prio ? 1 : 0) - (a.prio ? 1 : 0);
});

export function PatientProfile({ p, store, a, initial = 'resumo' }) {
  const [sec, setSec] = useState(initial);
  const [prefill, setPrefill] = useState(null); // text sent from "Antes da sessão" to a new prontuário entry
  const up = (patch) => store.updatePatient(p.id, patch);
  // shortcut: the demo record is built from the patient id only, so plan edits in demo do not change the analysis.
  const rec = useMemo(() => p.record ?? (store.demo ? demoRecord(p) : null), [p.record, p.id, store.demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const ins = useMemo(() => analyze(rec ?? {}), [rec]);
  const topics = (p.record ? p.topics : rec?.topics) ?? [];
  const diary = ((p.record ? p.diary : rec?.diary) ?? []).filter((e) => e.shared);
  const triage = p.triage ?? {};
  const notes = p.notes ?? [];
  const newRx = p.rx.filter((r) => r.status === 'Nova').length;
  const go = (s) => { setSec(s); document.querySelector('.d-main')?.scrollTo(0, 0); };
  const toNote = (text) => { setPrefill(text); go('prontuario'); };
  const badges = { remedios: newRx, pauta: topics.filter((t) => !triage[t.t]?.done).length };
  const ctx = { p, up, rec, ins, topics, diary, triage, notes, go, toNote, store };
  return (
    <>
      <ProfileHead p={p} up={up} a={a} />
      {p.link && !p.link.linked && (
        <section className="panel link-banner">
          <div className="row gap8"><Icon name="clock" size={16} /><b className="sm">Aguardando o paciente criar a conta e digitar o código</b></div>
          <LinkCard compact patient={p} onNewCode={async () => {
            try { const { patient } = await api.patients.newCode(p.id); up({ link: { linked: false, code: patient.code, url: patient.link, expiresAt: patient.codeExpiresAt } }); toast('Novo código gerado; o anterior parou de valer'); } catch (e) { toast(e.message, 'warn'); }
          }} />
        </section>
      )}
      <div className="pf-body">
        <nav className="pf-nav" aria-label="Seções do paciente">
          {NAV.map(([group, items]) => (
            <div key={group} className="pf-nav-group">
              <p className="pf-nav-label">{group}</p>
              {items.map(([k, l, i]) => (
                <button key={k} className={sec === k ? 'on' : ''} aria-current={sec === k ? 'page' : undefined} onClick={() => go(k)}>
                  <Icon name={i} size={16} /><span className="grow">{l}</span>{badges[k] > 0 && <span className="pf-count">{badges[k]}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="pf-main">
          {sec === 'resumo' && <Resumo {...ctx} />}
          {sec === 'evolucao' && <Evolucao {...ctx} />}
          {sec === 'humor' && <Humor {...ctx} />}
          {sec === 'sono' && <Sono {...ctx} />}
          {sec === 'rotina' && <Rotina {...ctx} />}
          {sec === 'prontuario' && <Prontuario {...ctx} prefill={prefill} clearPrefill={() => setPrefill(null)} />}
          {sec === 'pauta' && <Pauta {...ctx} />}
          {sec === 'diario' && <Diario {...ctx} />}
          {sec === 'plano' && <Plano p={p} up={up} />}
          {sec === 'remedios' && <RemediosReceitas p={p} up={up} />}
          {sec === 'permissoes' && <Permissoes p={p} up={up} />}
        </div>
      </div>
    </>
  );
}

/* ---------- header ---------- */
function ProfileHead({ p, up, a }) {
  return (
    <header className="pf-head">
      <Avatar name={p.name} size={56} />
      <div className="pf-id">
        <div className="row gap8 wrap"><h1 className="d-title">{p.name}</h1><Chip kind={STATUS[p.status]}>{p.status}</Chip></div>
        <p className="muted sm">{p.age} anos · {p.mode} · última sessão {p.last} · próxima {p.next}</p>
        <p className="xs muted row gap6"><span className={`dot ${p.use ? 'ok' : ''}`} /> {p.use ? `App em uso · ${p.use}% dos últimos 14 dias com registro` : 'App ainda não usado'}</p>
      </div>
      <div className="pf-clinical">
        <CidPicker value={p.cid} onChange={(cid) => up({ cid })} />
        <div className="risk-field">
          <label className="field-label" htmlFor="risk">{RISK_LABEL}</label>
          <select id="risk" className={`select risk-${RISK[p.risk]}`} value={p.risk} onChange={(e) => up({ risk: e.target.value, riskAt: new Date().toISOString() })}>
            {Object.keys(RISK).map((r) => <option key={r}>{r}</option>)}
          </select>
          <span className="xs muted">{p.riskAt ? `Avaliado em ${fmtDate(p.riskAt)}` : 'Sem data de avaliação'} · nunca calculado pelo app</span>
        </div>
      </div>
      <div className="pf-actions">
        <button className="btn-secondary sm-btn" onClick={() => a.newSession({ pid: p.id })}><Icon name="calendar" size={14} /> Agendar</button>
        <button className="btn-secondary sm-btn" onClick={() => a.openEditor({ pid: p.id, tpl: 'declaracao' })}><Icon name="file" size={14} /> Gerar documento</button>
        <button className="btn-primary sm-btn" onClick={() => a.run(p.id)}><Icon name="video" size={14} /> Iniciar sessão</button>
      </div>
    </header>
  );
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Search the WHO CID-11 list by code prefix or words in the title (accent-insensitive).
export const searchCid = (q, max = 60) => {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return (words.length ? CID11.filter(([c, t]) => words.every((w) => norm(c).startsWith(w) || norm(t).includes(w))) : CID11).slice(0, max);
};

function CidPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const pick = (c) => { onChange(c); setOpen(false); setQ(''); };
  const hits = open ? searchCid(q) : [];
  return (
    <div className="cid-picker" ref={box}>
      <span className="field-label" id="cid-label">CID-11 · definido por você</span>
      <button type="button" className="cid-value" aria-labelledby="cid-label" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(!open)}>
        {value ? <><span className="cid">{value}</span><span className="cid-title">{cidLabel(value)}</span></> : <span className="muted grow">Não definido</span>}
        <Icon name="search" size={14} />
      </button>
      {open && (
        <div className="dropdown cid-pop">
          <input autoFocus className="cid-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} placeholder="Buscar por código ou nome (ex.: 6B00, ansiedade)" aria-label="Buscar CID-11" />
          <ul role="listbox" aria-label="CID-11">
            {value && <li><button onClick={() => pick('')}><Icon name="x" size={14} /> Remover CID</button></li>}
            {hits.map(([c, t]) => <li key={c}><button role="option" aria-selected={c === value} onClick={() => pick(c)}><span className="cid">{c}</span><span className="grow">{t}</span></button></li>)}
            {!hits.length && <li className="muted sm pad-s">Nenhum código encontrado.</li>}
          </ul>
          <p className="xs muted cid-src">CID-11 da OMS (versão 2025-01): capítulo 06 e fatores QD/QE.</p>
        </div>
      )}
    </div>
  );
}

/* ---------- shared pieces ---------- */
function Findings({ items, empty = 'Nada a destacar com os registros atuais.' }) {
  if (!items.length) return <p className="muted sm">{empty}</p>;
  return (
    <ul className="findings">
      {items.map((f) => (
        <li key={f.text} className={`fd fd-${f.tone}`}>
          <span className="fd-ico" title={TONE[f.tone][1]}><Icon name={TONE[f.tone][0]} size={15} /></span>
          <p>{f.text}</p>
        </li>
      ))}
    </ul>
  );
}
const byArea = (ins, ...areas) => ins.findings.filter((f) => areas.includes(f.area));

// Small line for tiles; gaps where there is no data.
function MiniLine({ points }) {
  const vals = points.filter((v) => v != null);
  if (vals.length < 2) return <span className="xs muted">poucos dados</span>;
  if (vals.every((v) => v === 0)) return <span className="xs muted">sem registros</span>;
  const lo = Math.min(...vals); const hi = Math.max(...vals); const w = 120; const h = 30;
  const x = (i) => (i * w) / (points.length - 1); const y = (v) => (hi === lo ? h / 2 : h - 3 - ((v - lo) * (h - 6)) / (hi - lo));
  // Days without a record are skipped: the line joins the days that have one, so it never breaks into pieces.
  const d = smoothPath(points.map((v, i) => [i, v]).filter(([, v]) => v != null).map(([i, v]) => [x(i), y(v)]));
  return <svg className="mini-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>;
}

// LineChart needs a value per point: carry the last value over gaps.
const filled = (points, min) => points.reduce((acc, v) => [...acc, v ?? acc[acc.length - 1] ?? null], []).map((v) => v ?? min);

function Trend({ s }) {
  if (s.value == null || s.prev == null) return <span className="xs muted">sem semana anterior</span>;
  if (s.trend === 'flat') return <span className="xs muted">estável</span>;
  return <span className="row gap6 wrap"><Chip kind={s.trend === 'better' ? 'ok' : 'warn'}>{s.trend === 'better' ? 'melhor' : 'pior'}</Chip><span className="xs muted">vs. semana anterior</span></span>;
}

function NoData({ text = 'Ainda não há registros no app para esta análise.' }) {
  return <section className="panel"><p className="muted center pad">{text}</p></section>;
}

/* ---------- Visão geral ---------- */
function Resumo({ p, ins, topics, diary, triage, notes, go, toNote }) {
  const top = ins.findings.slice(0, 6);
  const lines = top.map((f) => `- ${f.text}`).join('\n');
  const c = ins.coverage;
  const last = [...notes].sort((x, y) => y.at.localeCompare(x.at))[0];
  return (
    <>
    <button className="pr-cta" onClick={() => go('prontuario')}>
      <span className="pr-cta-ico"><Icon name="pen" size={24} /></span>
      <span>
        <span className="pr-cta-title">Prontuário</span>
        <span className="pr-cta-sub">{notes.length ? `${notes.length} ${notes.length === 1 ? 'registro' : 'registros'} · último em ${fmtDate(last.at)}, ${last.kind.toLowerCase()}` : 'Nenhum registro ainda. Registre o primeiro atendimento.'}</span>
      </span>
      <span className="pr-cta-go">Abrir prontuário <Icon name="chevR" size={16} /></span>
    </button>
    <div className="grid-2-1">
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <div><h2 className="h3">Antes da sessão</h2><p className="muted sm">{c.lastDay ? `Registros de ${c.logDays7} dos últimos 7 dias · ${c.logDays30} dos últimos 30` : 'Sem registros no app ainda'}</p></div>
            {top.length > 0 && c.lastDay && (
              <div className="row gap8">
                <button className="btn-secondary sm-btn" onClick={() => copyText(lines, 'Copiado')}><Icon name="copy" size={14} /> Copiar</button>
                <button className="btn-primary sm-btn" onClick={() => toNote(lines)}><Icon name="pen" size={14} /> Levar ao prontuário</button>
              </div>
            )}
          </div>
          <Findings items={top} />
          <p className="note"><Icon name="alert" size={14} /> Contas sobre o que o paciente registrou no app. Não definem diagnóstico nem risco.</p>
        </section>
        {ins.snapshot.length > 0 && (
          <section className="panel">
            <div className="panel-head"><div><h2 className="h3">Esta semana no app</h2><p className="muted sm">Últimos 7 dias comparados aos 7 anteriores · linha: 30 dias</p></div></div>
            <div className="tiles">
              {ins.snapshot.map((s) => (
                <button key={s.key} className={`tile f-${TILE_FEATURE[s.key]}`} onClick={() => go(TILE_SECTION[s.key])}>
                  <span className="tile-label">{s.label}</span>
                  <span className="tile-v">{s.text}</span>
                  <span className="xs muted">{s.sub}</span>
                  <MiniLine points={s.series} />
                  <Trend s={s} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="stack">
        <section className="panel">
          <div className="row-between"><h2 className="h3">Pauta</h2><button className="link" onClick={() => go('pauta')}>Organizar</button></div>
          <ul className="pauta">
            {sortTopics(topics, triage).filter((t) => !triage[t.t]?.done).slice(0, 4).map((t) => <TopicLine key={t.t} t={t} tri={triage[t.t]} />)}
            {!topics.length && <li className="muted sm">Nenhum assunto anotado pelo paciente.</li>}
          </ul>
        </section>
        <section className="panel">
          <div className="row-between"><h2 className="h3">Diário compartilhado</h2><button className="link" onClick={() => go('diario')}>Ver tudo</button></div>
          {diary.slice(0, 2).map((e) => <DiaryEntry key={e.id} e={e} />)}
          {!diary.length && <p className="muted sm mt8">Nada compartilhado ainda.</p>}
        </section>
        <section className="panel">
          <div className="row-between"><h2 className="h3">Plano no app</h2><button className="link" onClick={() => go('plano')}>Editar</button></div>
          <ul className="meds">
            <li><Icon name="checks" size={16} /><span className="grow">Hábitos</span><span className="muted sm">{p.habits.length}</span></li>
            <li><Icon name="pill" size={16} /><span className="grow">Remédios</span><span className="muted sm">{p.meds.length}</span></li>
            <li><Icon name="drop" size={16} /><span className="grow">Meta de água</span><span className="muted sm">{p.perms.agua ? fmtL(p.waterGoal) : 'desligada'}</span></li>
            <li><Icon name="sliders" size={16} /><span className="grow">Recursos ligados</span><span className="muted sm">{Object.values(p.perms).filter(Boolean).length} de {FEATURES.length}</span></li>
          </ul>
        </section>
      </div>
    </div>
    </>
  );
}

/* ---------- Evolução (was the global Copilot page) ---------- */
function Evolucao(props) {
  const [tab, setTab] = useState('visao');
  return (
    <>
      <Segmented value={tab} onChange={setTab} options={[['visao', 'Visão geral'], ['linha', 'Linha do tempo']]} />
      {tab === 'visao' ? <EvolucaoVisao {...props} /> : <LinhaDoTempo {...props} />}
    </>
  );
}

// Everything that happened with the patient, one item per day and type: prontuário, documents, shared diary,
// and each app record (mood, emotions, sleep, water, routine, medicines), plus milestones computed from them
// (first record, runs of low mood). Newest first, grouped by month.
export const TL_TYPES = [
  ['sessao', 'Prontuário', 'pen'], ['doc', 'Documentos', 'file'], ['marco', 'Marcos', 'flag'],
  ['humor', 'Humor', 'smile'], ['emocoes', 'Emoções', 'heart'], ['sono', 'Sono', 'moon'],
  ['agua', 'Água', 'drop'], ['rotina', 'Rotina', 'checks'], ['remedios', 'Remédios', 'pill'], ['diario', 'Diário', 'book'],
];
const MOOD_NAMES = ['Muito mal', 'Mal', 'Neutro', 'Ok', 'Bem', 'Muito bem'];
export function timeline({ notes = [], docs = [], diary = [], log, plan = {} }) {
  const ev = [];
  const add = (day, type, title, text = '') => day && ev.push({ day, type, title, text });
  notes.forEach((n) => add(n.at, 'sessao', n.kind, [n.text, n.plan && `Combinado: ${n.plan}`].filter(Boolean).join(' · ')));
  docs.forEach((d) => add(d.date.split('/').reverse().join('-'), 'doc', `${d.title} assinado`, d.code ? `Código ${d.code}` : ''));
  diary.filter((e) => e.at).forEach((e) => add(dayKey(new Date(e.at)), 'diario', e.t, e.b));
  if (log) {
    const byDay = {};
    log.mood.forEach((m) => { const k = dayKey(new Date(m.at)); (byDay[k] ??= []).push(m.v); });
    const moodDays = Object.keys(byDay).sort();
    moodDays.forEach((k) => { const v = byDay[k].reduce((a, b) => a + b, 0) / byDay[k].length; add(k, 'humor', `Humor: ${MOOD_NAMES[Math.round(v) - 1]}`, byDay[k].length > 1 ? `${byDay[k].length} registros, média ${num(v)}` : ''); });
    if (moodDays.length) add(moodDays[0], 'marco', 'Primeiro registro de humor no app');
    let run = [];
    const flush = () => { if (run.length) add(run[run.length - 1], 'marco', run.length === 1 ? 'Dia de humor baixo' : `${run.length} dias seguidos de humor baixo`, run.length === 1 ? 'Média “mal” ou “muito mal”.' : `De ${fmtDay(run[0])} a ${fmtDay(run[run.length - 1])}.`); run = []; };
    moodDays.forEach((k, i) => {
      const low = byDay[k].reduce((a, b) => a + b, 0) / byDay[k].length <= 2;
      const consecutive = i > 0 && (new Date(`${k}T12:00:00`) - new Date(`${moodDays[i - 1]}T12:00:00`)) / 864e5 === 1;
      if (!low || !consecutive) flush();
      if (low) run.push(k);
    });
    flush();
    const emo = {};
    log.emotions.forEach((e) => { const k = dayKey(new Date(e.at)); (emo[k] ??= new Set()); e.list.forEach((x) => emo[k].add(x)); });
    Object.entries(log.dayEmotion).forEach(([k, e]) => { (emo[k] ??= new Set()).add(e); });
    Object.entries(emo).forEach(([k, set]) => add(k, 'emocoes', [...set].join(', ')));
    Object.entries(log.sleep).forEach(([k, n]) => add(k, 'sono', `Sono: ${fmtH(sleepMin(n))}`, `${n.bed}–${n.wake}${n.wakeups ? ` · ${n.wakeups} ${n.wakeups === 1 ? 'despertar' : 'despertares'}` : ''}`));
    Object.entries(log.water).forEach(([k, ml]) => ml > 0 && add(k, 'agua', `Água: ${fmtL(ml)}`, plan.waterGoal ? (ml >= plan.waterGoal ? 'Meta atingida' : `Meta ${fmtL(plan.waterGoal)}`) : ''));
    const habitName = (id) => (plan.habits ?? []).find((h) => String(h.id) === String(id))?.name ?? 'Hábito removido';
    Object.entries(log.habits).forEach(([k, ids]) => ids.length && add(k, 'rotina', `${ids.length} ${ids.length === 1 ? 'hábito cumprido' : 'hábitos cumpridos'}`, ids.map(habitName).join(', ')));
    const medName = (id) => (plan.meds ?? []).find((m) => String(m.id) === String(id))?.name ?? 'Remédio removido';
    Object.entries(log.meds).forEach(([k, doses]) => { const ids = Object.keys(doses); if (ids.length) add(k, 'remedios', `${ids.length} ${ids.length === 1 ? 'dose tomada' : 'doses tomadas'}`, ids.map((id) => `${medName(id)} às ${doses[id]}`).join(', ')); });
  }
  return ev.sort((a, b) => b.day.localeCompare(a.day) || TL_TYPES.findIndex((t) => t[0] === a.type) - TL_TYPES.findIndex((t) => t[0] === b.type));
}

// Days between two YYYY-MM-DD keys, inclusive.
const rangeDays = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T12:00:00`); dayKey(d) <= to && out.length < 1000; d.setDate(d.getDate() + 1)) out.push(dayKey(d));
  return out;
};
// The four series shown next to the timeline and in its report: null = nothing logged that day.
export function rangeCharts(log, from, to) {
  const days = rangeDays(from, to);
  const hours = (n) => (n ? Math.round((sleepMin(n) / 60) * 10) / 10 : null);
  return [
    { key: 'humor', title: 'Humor do dia (1 a 6)', unit: '', min: 1, max: 6, points: dailyMood(log, days) },
    { key: 'sono', title: 'Horas de sono', unit: 'h', min: 0, max: 10, points: days.map((d) => hours(log.sleep[d])) },
    { key: 'agua', title: 'Água', unit: 'L', min: 0, max: 3, points: days.map((d) => (log.water[d] ? log.water[d] / 1000 : null)) },
    { key: 'rotina', title: 'Hábitos cumpridos', unit: 'por dia', min: 0, max: Math.max(1, ...days.map((d) => (log.habits[d] ?? []).length)), points: days.map((d) => (log.habits[d] ? log.habits[d].length : null)) },
  ].map((c) => ({ ...c, days, avg: (() => { const v = c.points.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })() }));
}

function TimelineCharts({ charts, emotions }) {
  const emo = Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = emo[0]?.[1] || 1;
  return (
    <div className="tl-charts">
      {charts.map((c) => (
        <div key={c.key} className={`tl-chart tl-${c.key}`}>
          <div className="row-between"><p className="sm strong">{c.title}</p><p className="xs muted">média {c.avg == null ? '—' : num(c.avg)}{c.avg == null ? '' : ` ${c.unit}`}</p></div>
          {c.points.filter((v) => v != null).length >= 2
            ? <LineChart points={filled(c.points, c.min)} min={c.min} max={c.max} height={90} labels={[fmtDay(c.days[0]), fmtDay(c.days[c.days.length - 1])]} />
            : <p className="xs muted tl-chart-empty">Poucos registros neste período.</p>}
        </div>
      ))}
      <div className="tl-chart tl-emocoes">
        <p className="sm strong">Emoções mais registradas</p>
        {emo.length ? (
          <ul className="emo-bars mt8">
            {emo.map(([e, n]) => <li key={e}><span className="sm">{e}</span><span className="emo-track"><span className={EMOTION_POS.includes(e) ? 'pos' : 'neg'} style={{ width: `${(n / max) * 100}%` }} /></span><b className="sm">{n}</b></li>)}
          </ul>
        ) : <p className="xs muted tl-chart-empty">Nenhuma emoção neste período.</p>}
      </div>
    </div>
  );
}

// One value per day across the chosen period. Hovering a day shows its date and what was recorded.
// values: (number|null)[]; kind 'line' joins the days with data, 'bar' draws a bar per day.
// Events on a day line: one icon per event type that day, in the type's color. Hover shows date and titles.
function EventStrip({ days, events, icon, name }) {
  const [hi, setHi] = useState(null);
  const n = days.length;
  const left = (i) => `${((i + 0.5) / n) * 100}%`;
  const label = (k) => new Date(`${days[k]}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return (
    <div className="dc">
      <div className="es-track" onMouseLeave={() => setHi(null)}>
        {events.map((list, i) => list.length > 0 && (
          <button key={days[i]} type="button" className="es-day" style={{ left: left(i) }} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} onBlur={() => setHi(null)}
            aria-label={`${label(i)}: ${list.map((e) => `${name[e.type]}: ${e.title}`).join('; ')}`}>
            {[...new Set(list.map((e) => e.type))].map((t) => <span key={t} className={`es-ico tl-${t}`}><Icon name={icon[t]} size={12} /></span>)}
          </button>
        ))}
        {hi != null && (
          <div className={`dc-tip ${(hi + 0.5) / n > 0.7 ? 'left' : ''}`} style={{ left: left(hi) }}>
            <p className="xs muted">{label(hi)}</p>
            {events[hi].map((e, k) => <p key={k} className="xs"><b>{name[e.type]}:</b> {e.title}</p>)}
          </div>
        )}
      </div>
      <div className="dc-axis xs muted"><span>{fmtDay(days[0])}</span><span>{fmtDay(days[Math.floor((n - 1) / 2)])}</span><span>{fmtDay(days[n - 1])}</span></div>
    </div>
  );
}

// colorAt(value) → CSS color: the line fades from one day's color to the next (mood scale, sleep hours…).
// kind 'stack': parts = { items: [{ name, color }], days: boolean[][] } — one block per item per day, filled when done.
function DayChart({ days, values, min = 0, max, kind = 'line', format, detail, height = 120, colorAt, parts }) {
  const [hi, setHi] = useState(null);
  const gid = useId();
  const n = days.length;
  const w = 1000; const h = height; const pad = 10;
  const top = max ?? Math.max(1, ...values.filter((v) => v != null));
  const cx = (i) => ((i + 0.5) * w) / n;
  const cy = (v) => pad + ((top - Math.min(top, Math.max(min, v))) * (h - pad * 2)) / (top - min || 1);
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  const d = smoothPath(pts.map(([i, v]) => [cx(i), cy(v)]));
  const bw = Math.max(2, (w / n) * 0.62);
  const label = (k) => new Date(`${days[k]}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return (
    <div className="dc" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${pts.length} dias com registro de ${n}`}>
        <line x1="0" x2={w} y1={h - pad} y2={h - pad} className="dc-base" />
        {colorAt && pts.length > 1 && (
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" x2={w} y1="0" y2="0">
              {pts.map(([i, v]) => <stop key={i} offset={cx(i) / w} style={{ stopColor: colorAt(v) }} />)}
            </linearGradient>
          </defs>
        )}
        {kind === 'line' && pts.length > 1 && <path d={d} className="dc-line" style={colorAt ? { stroke: `url(#${gid})` } : undefined} vectorEffect="non-scaling-stroke" />}
        {kind === 'stack' && parts && parts.days.map((done, i) => {
          const k = parts.items.length; const gap = 3; const bh = (h - pad * 2 - gap * (k - 1)) / Math.max(1, k);
          return parts.items.map((it, j) => (
            <rect key={`${i}-${j}`} x={cx(i) - bw / 2} width={bw} y={h - pad - (j + 1) * bh - j * gap} height={bh} rx="2"
              style={done[j] ? { fill: it.color } : { fill: 'transparent', stroke: 'var(--line)', strokeWidth: 1 }} vectorEffect="non-scaling-stroke" />
          ));
        })}
        {kind === 'bar' && pts.map(([i, v]) => <rect key={i} x={cx(i) - bw / 2} width={bw} y={cy(v)} height={Math.max(1, h - pad - cy(v))} rx="2" className="dc-bar" />)}
        {hi != null && <line x1={cx(hi)} x2={cx(hi)} y1={pad} y2={h - pad} className="dc-cursor" vectorEffect="non-scaling-stroke" />}
        {kind === 'line' && pts.map(([i, v]) => <circle key={i} cx={cx(i)} cy={cy(v)} r={hi === i ? 5 : 2.5} className="dc-pt" style={colorAt ? { stroke: colorAt(v) } : undefined} vectorEffect="non-scaling-stroke" />)}
        {days.map((day, i) => <rect key={day} x={(i * w) / n} width={w / n} y="0" height={h} fill="transparent" onMouseEnter={() => setHi(i)} />)}
      </svg>
      {hi != null && (
        <div className={`dc-tip ${cx(hi) > w * 0.7 ? 'left' : ''}`} style={{ left: `${(cx(hi) / w) * 100}%` }}>
          <p className="xs muted">{label(hi)}</p>
          <p className="sm strong">{values[hi] == null ? 'Sem registro' : format(values[hi])}</p>
          {parts ? parts.items.map((it, j) => <p key={it.name} className="xs dc-tip-item"><i style={{ background: parts.days[hi][j] ? it.color : 'transparent', borderColor: it.color }} /> {it.name} · {parts.days[hi][j] ? 'feito' : 'não feito'}</p>)
            : values[hi] != null && detail?.(hi) && <p className="xs">{detail(hi)}</p>}
        </div>
      )}
      <div className="dc-axis xs muted"><span>{fmtDay(days[0])}</span><span>{fmtDay(days[Math.floor((n - 1) / 2)])}</span><span>{fmtDay(days[n - 1])}</span></div>
    </div>
  );
}

// Mood scale colors (darkened a little so the line reads on white). Sleep: green ≥ 7 h, yellow 6–7 h, orange 5–6 h, red < 5 h.
const moodColor = (v) => `color-mix(in srgb, var(--mood-${Math.min(6, Math.max(1, Math.round(v)))}) 78%, #1d1b26)`;
const sleepColor = (h) => (h >= 7 ? '#2f9e6e' : h >= 6 ? '#d9a521' : h >= 5 ? '#e8833a' : '#d64545');
const STACK_COLORS = ['#1f8a78', '#5b5bd6', '#e07a5f', '#c0567d', '#2a8bc7', '#b8862f'];
const EVENT_TYPES = ['sessao', 'doc', 'marco', 'diario'];
const CHART_TYPES = ['humor', 'emocoes', 'sono', 'agua', 'rotina', 'remedios'];
function LinhaDoTempo({ p, rec, notes, diary, store }) {
  const today = dayKey();
  const start = lastDays(30)[0];
  const [from, setFrom] = useState(start); // inclusive, YYYY-MM-DD
  const [to, setTo] = useState(today);
  const [types, setTypes] = useState([]); // empty = all
  const [report, setReport] = useState(false);
  const docs = (store.docs ?? []).filter((d) => d.pid === p.id && d.status === 'Assinado');
  const log = rec ? withLog(rec) : null;
  const days = rangeDays(from, to);
  const all = timeline({ notes, docs, diary, log, plan: rec?.plan ?? { habits: p.habits, meds: p.meds, waterGoal: p.waterGoal } }).filter((e) => e.day >= from && e.day <= to);
  const byDay = (type) => { const m = {}; all.filter((e) => e.type === type).forEach((e) => { (m[e.day] ??= []).push(e); }); return m; };
  const count = (t) => all.filter((e) => e.type === t).length;
  const shown = (t) => (!types.length || types.includes(t)) && count(t) > 0;
  const toggle = (t) => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);
  const filtered = types.length > 0 || from !== start || to !== today;
  const charts = log ? rangeCharts(log, from, to) : [];
  const text = (type) => { const m = byDay(type); return (i) => (m[days[i]] ?? []).map((e) => e.text || e.title).join(' · '); };
  const plan = rec?.plan ?? { habits: p.habits, meds: p.meds };
  // One block per habit (or medicine) each day, in that item's color; filled = done.
  const stackOf = (list, done) => ({ items: list.map((x, k) => ({ name: x.name, color: STACK_COLORS[k % STACK_COLORS.length] })), days: days.map((d) => list.map((x) => done(d, x))) });
  const series = log ? {
    humor: { title: 'Humor do dia', kind: 'line', min: 1, max: 6, colorAt: moodColor, values: dailyMood(log, days), format: (v) => `${['Muito mal', 'Mal', 'Neutro', 'Ok', 'Bem', 'Muito bem'][Math.round(v) - 1]} (${num(v)})`, detail: text('humor') },
    emocoes: { title: 'Emoções registradas', kind: 'bar', values: days.map((d) => { const e = byDay('emocoes')[d]; return e ? e[0].title.split(', ').length : null; }), format: (v) => `${v} ${v === 1 ? 'emoção' : 'emoções'}`, avgFormat: (v) => `${num(v)} por dia`, detail: (i) => byDay('emocoes')[days[i]]?.[0].title },
    sono: { title: 'Horas de sono', kind: 'line', min: 0, max: 10, colorAt: sleepColor, values: charts.find((c) => c.key === 'sono')?.points ?? [], format: (v) => fmtH(v * 60), detail: text('sono') },
    agua: { title: 'Água', kind: 'bar', values: charts.find((c) => c.key === 'agua')?.points ?? [], format: (v) => `${num(v, 2)} L`, detail: text('agua') },
    rotina: { title: 'Hábitos cumpridos', kind: 'stack', parts: stackOf(plan.habits ?? [], (d, h) => (log.habits[d] ?? []).map(String).includes(String(h.id))), values: days.map((d) => (log.habits[d]?.length ? log.habits[d].length : null)), format: (v) => `${v} ${v === 1 ? 'hábito' : 'hábitos'}`, avgFormat: (v) => `${num(v)} por dia`, detail: text('rotina') },
    remedios: { title: 'Doses tomadas', kind: 'stack', parts: stackOf(plan.meds ?? [], (d, m) => Boolean(log.meds[d]?.[m.id])), values: days.map((d) => { const n = Object.keys(log.meds[d] ?? {}).length; return n || null; }), format: (v) => `${v} ${v === 1 ? 'dose' : 'doses'}`, avgFormat: (v) => `${num(v)} por dia`, detail: text('remedios') },
  } : {};
  const evDays = days.map((d) => all.filter((e) => e.day === d && EVENT_TYPES.includes(e.type) && shown(e.type)));
  const icon = Object.fromEntries(TL_TYPES.map(([k, , i]) => [k, i]));
  const name = Object.fromEntries(TL_TYPES.map(([k, l]) => [k, l]));
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="h3">Linha do tempo</h2><p className="muted sm">Passe o mouse sobre um dia para ver a data e o que foi registrado</p></div>
        <button className="btn-primary sm-btn" disabled={!all.length} onClick={() => setReport(true)}><Icon name="file" size={14} /> Relatório da linha do tempo</button>
      </div>
      <div className="tl-filters" role="search" aria-label="Filtrar linha do tempo">
        <div className="tl-filters-row">
          <div className="tl-dates">
            <DateField label="De" value={from} max={to || today} onChange={setFrom} />
            <DateField label="Até" value={to} min={from} max={today} onChange={setTo} />
          </div>
          {filtered && <button className="btn-ghost-sm" onClick={() => { setTypes([]); setFrom(start); setTo(today); }}><Icon name="x" size={14} /> Limpar filtros</button>}
        </div>
        <div className="tl-types" role="group" aria-label="O que mostrar">
          {TL_TYPES.map(([k, l, i]) => (
            <button key={k} className={`tl-type tl-${k} ${types.includes(k) ? 'on' : ''}`} aria-pressed={types.includes(k)} disabled={!count(k)} onClick={() => toggle(k)}>
              <Icon name={i} size={14} /> {l} <span className="tl-type-n">{count(k)}</span>
            </button>
          ))}
        </div>
      </div>
      {!all.length && <p className="muted pad center">Nada registrado neste período.</p>}
      {all.length > 0 && (
        <div className="dc-list">
          {evDays.some((x) => x.length) && (
            <div className="dc-row tl-marco">
              <div className="dc-head"><p className="sm strong row gap6"><Icon name="flag" size={14} /> Acontecimentos</p><p className="xs muted">prontuário, documentos, marcos e diário</p></div>
              <EventStrip days={days} events={evDays} icon={icon} name={name} />
            </div>
          )}
          {CHART_TYPES.filter(shown).map((t) => {
            if (t === 'rotina') {
              return (plan.habits ?? []).map((h, k) => {
                const color = STACK_COLORS[k % STACK_COLORS.length];
                const values = days.map((d) => ((log.habits[d] ?? []).map(String).includes(String(h.id)) ? 1 : null));
                const done = values.filter(Boolean).length;
                return (
                  <div key={`h${h.id}`} className="dc-row tl-rotina" style={{ '--c': color }}>
                    <div className="dc-head"><p className="sm strong row gap6"><Icon name={h.icon || 'checks'} size={14} /> {h.name}</p><p className="xs muted">Hábito · feito em {done} de {days.length} dias ({Math.round((done / days.length) * 100)}%)</p></div>
                    <DayChart days={days} kind="bar" max={1} height={70} values={values} format={() => 'Feito'} />
                  </div>
                );
              });
            }
            const s = series[t];
            const vals = s.values.filter((v) => v != null);
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            return (
              <div key={t} className={`dc-row tl-${t}`}>
                <div className="dc-head"><p className="sm strong row gap6"><Icon name={icon[t]} size={14} /> {s.title}</p><p className="xs muted">{vals.length} {vals.length === 1 ? 'dia' : 'dias'} com registro{avg != null ? ` · média ${(s.avgFormat ?? s.format)(avg)}` : ''}</p></div>
                <div>
                  <DayChart days={days} kind={s.kind} min={s.min ?? 0} max={s.max} values={s.values} format={s.format} detail={s.detail} colorAt={s.colorAt} parts={s.parts} />
                  {s.parts && <div className="dc-legend">{s.parts.items.map((x) => <span key={x.name} className="xs"><i style={{ background: x.color }} /> {x.name}</span>)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {report && <ReportFlow p={p} store={store} rec={rec} from={from} to={to} onClose={() => setReport(false)} />}
    </section>
  );
}

// Narrative of a period, one paragraph per area, each followed by its chart (key matches rangeCharts).
// Wording rules: humor "rebaixado" when the mean is ≤ 2,5, "positivo" when ≥ 4,5, otherwise "entre neutro e ok";
// a trend is reported only when the least-squares slope is ≥ 0,4 point per week; areas without data are skipped.
export function narrative(rec, from, to, name) {
  const log = withLog(rec);
  const days = rangeDays(from, to);
  const endOff = -Math.round((new Date(`${dayKey()}T12:00:00`) - new Date(`${to}T12:00:00`)) / 864e5);
  const s = stats(rec, { days: days.length, endOff });
  const first = name.split(' ')[0];
  const period = `No período de ${fmtDate(from)} a ${fmtDate(to)}`;
  const out = [];
  const daily = dailyMood(log, days);
  const pts = daily.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (s.moodN) {
    const tone = s.moodAvg <= 2.5 ? 'um humor predominantemente rebaixado' : s.moodAvg >= 4.5 ? 'um humor predominantemente positivo' : 'um humor oscilando entre neutro e ok';
    const low = daily.filter((v) => v != null && v <= 2).length;
    let slope = null;
    if (pts.length >= 4) {
      const mx = pts.reduce((a, [x]) => a + x, 0) / pts.length; const my = pts.reduce((a, [, y]) => a + y, 0) / pts.length;
      const den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
      slope = den ? (pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / den) * 7 : null;
    }
    const trend = slope == null || Math.abs(slope) < 0.4 ? 'sem mudança clara ao longo do período' : slope > 0 ? 'com tendência de melhora ao longo do período' : 'com tendência de piora ao longo do período';
    out.push({ key: 'humor', text: `${period}, ${first} apresentava ${tone}, com média de ${num(s.moodAvg)} numa escala de 1 a 6 (${s.moodN} registros em ${pts.length} dias), ${trend}.${low ? ` Em ${low} ${low === 1 ? 'dia o humor ficou' : 'dias o humor ficou'} entre “mal” e “muito mal”.` : ''}` });
  }
  if (s.nights) {
    const short = days.filter((d) => log.sleep[d] && sleepMin(log.sleep[d]) < 360).length;
    out.push({ key: 'sono', text: `O sono teve duração média de ${fmtH(s.sleepAvg)} em ${s.nights} noites registradas${short ? `, sendo ${short} com menos de 6 horas` : ''}${s.wakeups ? `, e ${s.wakeups} despertares no total (média de ${num(s.wakeups / s.nights)} por noite)` : ''}.` });
  }
  if (s.waterAvg != null) {
    const goal = rec?.plan?.waterGoal ?? 2000;
    const logged = days.filter((d) => log.water[d] > 0).length;
    const hit = days.filter((d) => (log.water[d] ?? 0) >= goal).length;
    out.push({ key: 'agua', text: `A ingestão de água foi, em média, de ${fmtL(s.waterAvg)} por dia, com a meta de ${fmtL(goal)} atingida em ${hit} de ${logged} dias registrados.` });
  }
  if (s.habitPct != null) {
    const sorted = [...s.byHabit].sort((a, b) => b.pct - a.pct);
    const best = sorted[0]; const worst = sorted[sorted.length - 1];
    out.push({ key: 'rotina', text: `Quanto à rotina combinada, ${first} cumpriu ${s.habitPct}% dos hábitos previstos${sorted.length > 1 && best.pct > worst.pct ? `, com maior adesão em “${best.name}” (${Math.min(100, best.pct)}%) e menor em “${worst.name}” (${worst.pct}%)` : ''}.` });
  }
  const emo = Object.entries(s.emotions).sort((a, b) => b[1] - a[1]);
  if (emo.length) {
    const total = emo.reduce((a, [, n]) => a + n, 0);
    out.push({ key: 'emocoes', text: `Entre as emoções registradas, as mais frequentes foram ${emo.slice(0, 3).map(([e, n]) => `${e.toLowerCase()} (${n})`).join(', ')}; ${Math.round((s.hard / total) * 100)}% delas foram emoções difíceis.` });
  }
  if (!out.length) out.push({ key: 'vazio', text: `${period}, ${first} não fez registros no app.` });
  out.push({ key: 'consideracoes', text: '' }); // psychologist's own words
  return out;
}

const REPORT_PARTS = [['humor', 'Humor'], ['sono', 'Sono'], ['agua', 'Água'], ['rotina', 'Hábitos'], ['emocoes', 'Emoções'], ['consideracoes', 'Suas considerações']];
// Step 1: period and what goes into the report. Step 2: the editable narrative (TimelineReport).
function ReportFlow({ p, store, rec, from: f0, to: t0, onClose }) {
  const today = dayKey();
  const [from, setFrom] = useState(f0);
  const [to, setTo] = useState(t0);
  const [parts, setParts] = useState(REPORT_PARTS.map(([k]) => k));
  const [ready, setReady] = useState(false);
  const log = rec ? withLog(rec) : null;
  if (ready) {
    const days = rangeDays(from, to).length;
    const endOff = -Math.round((new Date(`${today}T12:00:00`) - new Date(`${to}T12:00:00`)) / 864e5);
    const charts = log ? rangeCharts(log, from, to).filter((c) => parts.includes(c.key)) : [];
    const emotions = log && parts.includes('emocoes') ? stats(rec, { days, endOff }).emotions : {};
    return <TimelineReport p={p} store={store} rec={rec} from={from} to={to} charts={charts} emotions={emotions} parts={parts} onClose={onClose} onBack={() => setReady(false)} />;
  }
  const toggle = (k) => setParts(parts.includes(k) ? parts.filter((x) => x !== k) : [...parts, k]);
  return (
    <Modal title="Relatório da linha do tempo" sub="Escolha o período e o que vai aparecer. Depois você revisa e edita os textos." onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!parts.length || !from || !to} onClick={() => setReady(true)}>Gerar relatório</button></>}>
      <div className="stack-12">
        <div>
          <p className="field-label">Período</p>
          <div className="tl-dates">
            <DateField label="De" value={from} max={to || today} onChange={setFrom} />
            <DateField label="Até" value={to} min={from} max={today} onChange={setTo} />
          </div>
        </div>
        <div>
          <p className="field-label">O que vai no relatório</p>
          <div className="rp-parts">
            {REPORT_PARTS.map(([k, l]) => (
              <label key={k} className={`rp-part ${parts.includes(k) ? 'on' : ''}`}>
                <input type="checkbox" checked={parts.includes(k)} onChange={() => toggle(k)} /> {l}
              </label>
            ))}
          </div>
          <p className="xs muted mt8">O prontuário nunca entra: ele é só seu.</p>
        </div>
      </div>
    </Modal>
  );
}

// Report of the filtered timeline, as text → chart → text → chart. Every paragraph can be edited.
// Download = print of the preview. Send = signed PDF with the same text and charts in place (prontuário stays out).
function TimelineReport({ p, store, rec, from, to, charts, emotions, parts, onClose, onBack }) {
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState(() => (rec ? narrative(rec, from, to, p.name) : [{ key: 'consideracoes', text: '' }]).filter((b) => b.key === 'vazio' || parts.includes(b.key)));
  const [editing, setEditing] = useState(null); // index of the paragraph being edited
  const account = store.panelPrefs.account;
  const title = `Relatório de acompanhamento · ${fmtDate(from)} a ${fmtDate(to)}`;
  const chartOf = (key) => charts.find((c) => c.key === key);
  const setText = (i, text) => setBlocks(blocks.map((b, k) => (k === i ? { ...b, text } : b)));
  const pdfCharts = charts.map(({ title: t, min, max, points, days }) => ({ title: t, min, max, points, labels: [fmtDay(days[0]), fmtDay(days[days.length - 1])] }));
  // [[grafico:N]] marks where the server draws chart N of `charts`.
  const body = blocks.filter((b) => b.text.trim()).map((b) => {
    const i = charts.findIndex((c) => c.key === b.key);
    return `${b.key === 'consideracoes' ? 'CONSIDERAÇÕES\n' : ''}${b.text.trim()}${i >= 0 ? `\n[[grafico:${i}]]` : ''}`;
  }).join('\n\n');
  const send = async () => {
    setBusy(true);
    try {
      const doc = await signDocument(store, { id: Date.now(), tpl: 'relatorio', pid: p.id, name: p.name, title, body, status: 'Assinado', delivery: 'No app', date: new Date().toLocaleDateString('pt-BR'), charts: pdfCharts });
      store.setDocs((all) => [{ ...doc, body: body.replace(/\n\[\[grafico:\d+\]\]/g, '') }, ...all]);
      toast(`Relatório assinado e enviado ao app de ${p.name.split(' ')[0]}`);
      onClose();
    } catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); }
  };
  return (
    <Modal wide title="Relatório da linha do tempo" sub="Revise e edite os textos antes de enviar. O prontuário nunca vai para o paciente." onClose={onClose}
      footer={<>
        <button className="btn-ghost-sm" onClick={onBack}><Icon name="chevL" size={14} /> Período e conteúdo</button>
        <button className="btn-secondary" onClick={() => window.print()}><Icon name="download" size={16} /> Baixar PDF</button>
        <button className="btn-primary" disabled={busy || editing != null} onClick={send}><Icon name="send" size={16} /> {busy ? 'Assinando…' : 'Assinar e enviar ao paciente'}</button>
      </>}>
      <div className="paper tl-report print-area">
        <p className="paper-head">{account.name} · Psicóloga {account.crp}</p>
        <h3 className="paper-title">{title.toUpperCase()}</h3>
        <p className="sm">Paciente: <b>{p.name}</b></p>
        {blocks.map((b, i) => {
          const c = chartOf(b.key);
          const last = b.key === 'consideracoes';
          return (
            <div key={b.key} className="rp-block">
              {last && <h4 className="paper-h">Considerações</h4>}
              {editing === i ? (
                <div className="rp-edit">
                  <textarea rows={last ? 6 : 4} value={b.text} autoFocus onChange={(e) => setText(i, e.target.value)} placeholder={last ? 'Escreva sua leitura clínica do período, combinados e próximos passos…' : ''} aria-label="Texto do parágrafo" />
                  <button className="btn-primary sm-btn" onClick={() => setEditing(null)}><Icon name="check" size={14} /> Pronto</button>
                </div>
              ) : (
                <div className="rp-text">
                  {b.text ? <p>{b.text}</p> : <p className="muted">{last ? 'Sem considerações. Clique em Editar para escrever.' : 'Parágrafo vazio: não vai para o relatório.'}</p>}
                  <button className="icon-btn rp-edit-btn" aria-label="Editar parágrafo" onClick={() => setEditing(i)}><Icon name="edit" size={15} /></button>
                </div>
              )}
              {c && c.points.filter((v) => v != null).length >= 2 && (
                <figure className={`tl-chart tl-${c.key} rp-chart`}>
                  <figcaption className="row-between"><span className="sm strong">{c.title}</span><span className="xs muted">média {num(c.avg)}{c.unit ? ` ${c.unit}` : ''}</span></figcaption>
                  <LineChart points={filled(c.points, c.min)} min={c.min} max={c.max} height={110} labels={[fmtDay(c.days[0]), fmtDay(c.days[c.days.length - 1])]} />
                </figure>
              )}
              {b.key === 'emocoes' && <div className="rp-chart"><TimelineCharts charts={[]} emotions={emotions} /></div>}
            </div>
          );
        })}
        <p className="xs muted mt16">Gerado em {new Date().toLocaleDateString('pt-BR')} a partir dos registros do app KiWave e revisado pela psicóloga.</p>
      </div>
    </Modal>
  );
}

function EvolucaoVisao({ p, rec, ins }) {
  const [q, setQ] = useState('');
  const [chat, setChat] = useState([]);
  const ev = ins.evolution;
  if (!ev || !ev.spanDays) return <NoData text="A evolução aparece quando o paciente tiver registros de humor no app." />;
  const ask = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setChat((c) => [...c, { who: 'me', text }, { who: 'ai', text: answer(text, rec) }]);
    setQ('');
  };
  const mm = (k) => { const [y, m] = k.split('-'); return `${MONTHS[+m - 1]}/${y.slice(2)}`; };
  const suggestions = [...new Set([...ins.suggestions, ...ev.suggestions])].slice(0, 6);
  return (
    <>
      <div className="copilot-hero">
        <p className="eyebrow on-dark">Evolução pelos registros do app</p>
        <h2 className="hero-title">{ev.better.length > ev.worse.length ? `${p.name.split(' ')[0]} está melhorando` : ev.worse.length > ev.better.length ? 'Pontos pedem atenção' : 'Evolução estável'}</h2>
        <p className="on-dark-muted">{ev.spanDays} dias de registros · primeiros {ev.win} dias comparados aos últimos {ev.win}</p>
        <div className="hero-kpis">
          {[['Humor médio', ev.first.moodAvg, ev.last.moodAvg, (v) => num(v)], ['Hábitos cumpridos', ev.first.habitPct, ev.last.habitPct, (v) => `${v}%`], ['Sono médio', ev.first.sleepAvg, ev.last.sleepAvg, fmtH], ['Emoções difíceis', ev.first.hard, ev.last.hard, String]].map(([l, x, y, f]) => (
            <div key={l}><p className="xs on-dark-muted">{l}</p><p className="hero-v">{x == null ? '—' : f(x)} → {y == null ? '—' : f(y)}</p></div>
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
            <h2 className="h3 row gap6 ok-txt"><Icon name="trend" size={18} /> Sinais de melhora</h2>
            <ul className="bullets ok">{ev.better.map((t) => <li key={t}>{t}</li>)}{!ev.better.length && <li className="muted">Nada a destacar ainda.</li>}</ul>
          </section>
          <section className="panel">
            <h2 className="h3 row gap6 warn-txt"><Icon name="alert" size={18} /> Pontos de atenção</h2>
            <ul className="bullets warn">{ev.worse.map((t) => <li key={t}>{t}</li>)}{!ev.worse.length && <li className="muted">Nada a destacar ainda.</li>}</ul>
          </section>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head"><div><h2 className="h3">Sugestões para a próxima sessão</h2><p className="muted sm">A partir da pauta e dos registros · a decisão é sempre sua</p></div></div>
        <ol className="suggest">{suggestions.map((t) => <li key={t}>{t}</li>)}{!suggestions.length && <li className="muted">Sem sugestões: poucos registros ainda.</li>}</ol>
      </section>
      <section className="panel ask">
        <h2 className="h3">Perguntar sobre os registros</h2>
        {chat.length > 0 && <div className="chat" aria-live="polite">{chat.map((m, i) => <div key={i} className={`msg ${m.who}`}><p>{m.text}</p></div>)}</div>}
        <form onSubmit={ask} className="ask-box">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Humor, sono, hábitos, remédios, emoções, pauta de ${p.name.split(' ')[0]}…`} aria-label="Perguntar sobre os registros" />
          <button className="btn-icon" aria-label="Perguntar" disabled={!q.trim()}><Icon name="send" size={16} /></button>
        </form>
        <div className="row gap8 wrap">{['Resuma a semana', 'Como está o sono?', 'E os hábitos?', 'Quais emoções aparecem?'].map((x) => <button key={x} className="chip-sel sm" onClick={() => setQ(x)}>{x}</button>)}</div>
      </section>
    </>
  );
}

/* ---------- Humor e emoções ---------- */
function Humor({ rec, ins }) {
  const [range, setRange] = useState('30');
  if (!rec) return <NoData />;
  const days = range === '30' ? ins.series.days30 : ins.series.days90;
  const pts = range === '30' ? ins.series.mood30 : ins.series.mood90;
  const step = Math.floor(days.length / 3);
  const s14 = stats(rec, { days: 14 });
  const wdMax = 6;
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Humor médio do dia</h2><p className="muted sm">Escala de 1 a 6 registrada pelo paciente</p></div>
          <Segmented small value={range} onChange={setRange} options={[['30', '30 dias'], ['90', '90 dias']]} />
        </div>
        {pts.some((v) => v != null)
          ? <LineChart key={range} points={filled(pts, 1)} height={190} labels={[fmtDay(days[0]), fmtDay(days[step]), fmtDay(days[step * 2]), 'Hoje']} />
          : <p className="muted pad center">Sem registros de humor neste período.</p>}
        <div className="mt16"><Findings items={byArea(ins, 'humor')} /></div>
      </section>
      <div className="grid-2-1">
        <section className="panel">
          <div className="panel-head"><div><h2 className="h3">Por dia da semana</h2><p className="muted sm">Humor médio nos últimos 90 dias</p></div></div>
          <ul className="emo-bars">
            {ins.weekday.map((w) => (
              <li key={w.label}>
                <span className="sm">{w.label}</span>
                <span className="emo-track"><span className="pos" style={{ width: `${((w.avg ?? 0) / wdMax) * 100}%` }} /></span>
                <b className="sm">{w.avg == null ? '—' : num(w.avg)}</b>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2 className="h3">Por horário do registro</h2>
          <ul className="meds">
            {ins.timeOfDay.map((t) => <li key={t.label}><span className="grow">{t.label}</span><span className="muted sm">{t.n} registros</span><b className="sm">{t.avg == null ? '—' : num(t.avg)}</b></li>)}
          </ul>
        </section>
      </div>
      <div className="grid-2-1">
        {Object.keys(s14.emotions).length > 0 ? <Emocoes counts={s14.emotions} /> : <section className="panel"><h2 className="h3">Emoções registradas · 14 dias</h2><p className="muted sm mt8">Nenhuma emoção registrada ainda.</p></section>}
        <section className="panel">
          <div className="panel-head"><div><h2 className="h3">O que influenciou</h2><p className="muted sm">Citado pelo paciente ao registrar emoções · 30 dias</p></div></div>
          <ul className="emo-bars">
            {ins.influences.map((x) => (
              <li key={x.name}>
                <span className="sm">{x.name}</span>
                <span className="emo-track"><span className="neg" style={{ width: `${(x.hard / x.n) * 100}%` }} /></span>
                <b className="sm">{x.n}</b>
              </li>
            ))}
            {!ins.influences.length && <li className="muted sm">Nenhuma influência registrada.</li>}
          </ul>
          {ins.influences.length > 0 && <p className="xs muted mt12">Barra: parte dos registros com emoções difíceis.</p>}
          <div className="mt16"><Findings items={byArea(ins, 'emocoes')} empty="" /></div>
        </section>
      </div>
    </>
  );
}

/* ---------- Sono ---------- */
function Sono({ rec, ins }) {
  if (!rec) return <NoData />;
  const log = withLog(rec);
  const nights = lastDays(14).reverse().map((d) => [d, log.sleep[d]]).filter(([, n]) => n);
  const tile = ins.snapshot.find((s) => s.key === 'sono');
  const s7 = stats(rec, { days: 7 });
  return (
    <div className="grid-2-1">
      <section className="panel">
        <div className="panel-head"><div><h2 className="h3">Noites registradas</h2><p className="muted sm">Últimos 14 dias</p></div></div>
        <ul className="sleep-list">
          {nights.map(([d, n]) => (
            <li key={d}>
              <span className="sm grow">{d === dayKey() ? 'Hoje' : fmtDay(d)}</span>
              <span className="sm muted">{n.bed}–{n.wake}</span>
              <span className="sleep-bar"><span style={{ width: `${Math.min(100, (sleepMin(n) / 540) * 100)}%` }} /></span>
              <b className="sm">{fmtH(sleepMin(n))}</b>
              <span className="xs muted">{n.wakeups ? `${n.wakeups} desp.` : '—'}</span>
            </li>
          ))}
          {!nights.length && <li className="muted sm">Sem registros de sono.</li>}
        </ul>
      </section>
      <div className="stack">
        <section className="panel">
          <h2 className="h3">Nesta semana</h2>
          <div className="mini-stats">
            <div><p className="muted sm">Sono médio</p><p className="kpi-value sm-kpi">{tile?.text ?? '—'}</p></div>
            <div><p className="muted sm">Noites</p><p className="kpi-value sm-kpi">{s7.nights}</p></div>
            <div><p className="muted sm">Despertares</p><p className="kpi-value sm-kpi">{s7.wakeups}</p></div>
          </div>
          {tile && <div className="mt12"><Trend s={tile} /></div>}
        </section>
        <section className="panel"><h2 className="h3">O que os registros mostram</h2><div className="mt12"><Findings items={byArea(ins, 'sono')} /></div></section>
      </div>
    </div>
  );
}

/* ---------- Rotina ---------- */
function Rotina({ p, rec, ins }) {
  if (!rec) return <NoData />;
  const tile = (k) => ins.snapshot.find((s) => s.key === k);
  return (
    <>
      <section className="panel">
        <div className="panel-head"><div><h2 className="h3">Hábitos combinados</h2><p className="muted sm">Adesão em 14 dias · últimos 7 dias · humor nos dias com e sem o hábito (30 dias)</p></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Hábito</th><th>Adesão</th><th>Últimos 7 dias</th><th>Humor com / sem</th></tr></thead>
            <tbody>
              {ins.habits.map((h) => (
                <tr key={h.id}>
                  <td><p className="row-title">{h.name}</p></td>
                  <td><div className="use"><div className="progress"><span style={{ width: `${h.pct}%` }} /></div><span className="sm">{h.pct}%</span></div></td>
                  <td><span className="week-dots">{h.week.map((v, i) => <i key={i} className={v ? 'on' : ''} />)}</span></td>
                  <td>{h.mood ? <span className="sm">{num(h.mood.yes)} / {num(h.mood.no)}</span> : <span className="muted sm">poucos dias</span>}</td>
                </tr>
              ))}
              {!ins.habits.length && <tr><td colSpan={4} className="muted">Nenhum hábito no plano.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid-2-1">
        <section className="panel">
          <h2 className="h3">Remédios e água · esta semana</h2>
          <div className="mini-stats">
            <div><p className="muted sm">Doses marcadas</p><p className="kpi-value sm-kpi">{tile('remedios')?.text}</p><p className="xs muted">só você vê</p></div>
            <div><p className="muted sm">Água por dia</p><p className="kpi-value sm-kpi">{tile('agua')?.text}</p><p className="xs muted">meta {fmtL(p.waterGoal)}</p></div>
            <div><p className="muted sm">Hábitos</p><p className="kpi-value sm-kpi">{tile('rotina')?.text}</p><p className="xs muted">do combinado</p></div>
          </div>
        </section>
        <section className="panel"><h2 className="h3">O que os registros mostram</h2><div className="mt12"><Findings items={byArea(ins, 'rotina', 'remedios', 'agua')} /></div></section>
      </div>
    </>
  );
}

/* ---------- Prontuário (session follow-up, panel only) ---------- */
// Prontuário (Resolução CFP 01/2009): one entry per attendance, newest first. Only the psychologist sees it.
// Entries can be edited; the edit time is kept next to the creation time.
function Prontuario({ notes, up, topics, prefill, clearPrefill }) {
  const today = dayKey();
  const blank = { at: today, kind: NOTE_KINDS[0], topics: [], text: prefill ?? '', plan: '' };
  const [draft, setDraft] = useState(prefill ? blank : null); // { …, id? } id = editing an existing entry
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('todos');
  useEffect(() => { if (prefill) clearPrefill(); }, [prefill, clearPrefill]);
  const save = (e) => {
    e.preventDefault();
    if (!draft.text.trim()) return;
    const clean = { ...draft, text: draft.text.trim(), plan: draft.plan.trim() };
    up({ notes: draft.id
      ? notes.map((n) => (n.id === draft.id ? { ...n, ...clean, editedAt: new Date().toISOString() } : n))
      : [{ ...clean, id: Date.now(), createdAt: new Date().toISOString() }, ...notes] });
    toast(draft.id ? 'Registro atualizado' : 'Registro salvo no prontuário');
    setDraft(null);
  };
  const toggleTopic = (t) => setDraft({ ...draft, topics: draft.topics.includes(t) ? draft.topics.filter((x) => x !== t) : [...draft.topics, t] });
  const sorted = [...notes].sort((x, y) => y.at.localeCompare(x.at) || (y.createdAt ?? '').localeCompare(x.createdAt ?? ''));
  // Session number counts individual sessions in date order.
  const sessionNo = {};
  [...sorted].reverse().filter((n) => n.kind === 'Sessão individual').forEach((n, i) => { sessionNo[n.id] = i + 1; });
  const needle = q.trim().toLowerCase();
  const list = sorted.filter((n) => (kind === 'todos' || n.kind === kind) && (!needle || `${n.text} ${n.plan} ${(n.topics ?? []).join(' ')}`.toLowerCase().includes(needle)));
  const month = today.slice(0, 7);
  const thisMonth = notes.filter((n) => n.at.startsWith(month) && n.kind === 'Sessão individual').length;
  const lastPlan = sorted.find((n) => n.plan)?.plan;
  const stamp = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const day = (iso) => new Date(`${iso}T12:00:00`);
  return (
    <div className="pr">
      <header className="pr-hero">
        <div className="pr-hero-main">
          <span className="pr-hero-ico"><Icon name="pen" size={22} /></span>
          <div>
            <h2 className="pr-title">Prontuário</h2>
            <p className="sm pr-sub"><Icon name="lock" size={13} /> Só você vê. Nunca aparece no app do paciente (Resolução CFP 01/2009).</p>
          </div>
        </div>
        {!draft && <button className="btn-primary" onClick={() => setDraft(blank)}><Icon name="plus" size={16} /> Novo registro</button>}
        <dl className="pr-stats">
          <div><dt>Registros</dt><dd>{notes.length}</dd></div>
          <div><dt>Sessões neste mês</dt><dd>{thisMonth}</dd></div>
          <div><dt>Último atendimento</dt><dd>{sorted[0] ? fmtDate(sorted[0].at) : '—'}</dd></div>
        </dl>
        {lastPlan && <p className="pr-lastplan sm"><Icon name="flag" size={14} /> <span><b>Último combinado:</b> {lastPlan}</span></p>}
      </header>

      {draft && (
        <form className="pr-sheet" onSubmit={save}>
          <div className="pr-sheet-head">
            <h3 className="h3">{draft.id ? 'Editar registro' : 'Novo registro'}</h3>
            <DateField label="Data" value={draft.at} max={today} onChange={(v) => setDraft({ ...draft, at: v })} />
          </div>
          <div className="pr-kinds" role="radiogroup" aria-label="Tipo de registro">
            {NOTE_KINDS.map((k) => <button type="button" key={k} role="radio" aria-checked={draft.kind === k} className={`chip-sel sm ${draft.kind === k ? 'on' : ''}`} onClick={() => setDraft({ ...draft, kind: k })}>{k}</button>)}
          </div>
          {topics.length > 0 && (
            <div>
              <p className="field-label">Temas trabalhados (da pauta)</p>
              <div className="chips">{topics.map((t) => <button type="button" key={t.t} className={`chip-sel sm ${draft.topics.includes(t.t) ? 'on' : ''}`} aria-pressed={draft.topics.includes(t.t)} onClick={() => toggleTopic(t.t)}>{t.t}</button>)}</div>
            </div>
          )}
          <label className="field">Evolução<textarea className="pr-text-input" rows={9} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Como o paciente chegou, o que foi trabalhado, intervenções, como saiu, observações clínicas" required /></label>
          <label className="field">Combinados e próximos passos<textarea rows={3} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })} placeholder="Tarefas, encaminhamentos, o que retomar na próxima sessão" /></label>
          <div className="row gap8 end">
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>Cancelar</button>
            <button className="btn-primary" disabled={!draft.text.trim()}>{draft.id ? 'Salvar alterações' : 'Salvar registro'}</button>
          </div>
        </form>
      )}

      {notes.length > 0 && (
        <div className="pr-tools">
          <label className="search pr-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no prontuário" aria-label="Buscar no prontuário" /></label>
          <Segmented small value={kind} onChange={setKind} options={[['todos', 'Todos', notes.length], ...NOTE_KINDS.filter((k) => notes.some((n) => n.kind === k)).map((k) => [k, k, notes.filter((n) => n.kind === k).length])]} />
        </div>
      )}

      <ol className="pr-list">
        {list.map((n) => (
          <li key={n.id} className="pr-entry">
            <time className="pr-date" dateTime={n.at}>
              <span className="pr-day">{day(n.at).getDate()}</span>
              <span className="pr-month">{MONTHS[day(n.at).getMonth()]}</span>
              <span className="pr-year">{day(n.at).getFullYear()}</span>
            </time>
            <article className="pr-card">
              <div className="pr-card-head">
                <span className="pr-kind">{n.kind}{sessionNo[n.id] ? ` · nº ${sessionNo[n.id]}` : ''}</span>
                <div className="row gap4">
                  <button className="icon-btn" aria-label="Copiar registro" onClick={() => copyText(`${fmtDate(n.at)} · ${n.kind}\n${n.text}${n.plan ? `\nCombinados: ${n.plan}` : ''}`, 'Registro copiado')}><Icon name="copy" size={15} /></button>
                  <button className="icon-btn" aria-label="Editar registro" onClick={() => { setDraft({ ...n, topics: n.topics ?? [], plan: n.plan ?? '' }); document.querySelector('.d-main')?.scrollTo(0, 0); }}><Icon name="edit" size={15} /></button>
                </div>
              </div>
              {n.topics?.length > 0 && <div className="row gap6 wrap">{n.topics.map((t) => <span key={t} className="pr-topic">{t}</span>)}</div>}
              <p className="pr-body">{n.text}</p>
              {n.plan && <p className="pr-plan"><Icon name="flag" size={14} /> <span><b>Combinados:</b> {n.plan}</span></p>}
              {n.createdAt && <p className="xs muted">Registrado em {stamp(n.createdAt)}{n.editedAt ? ` · editado em ${stamp(n.editedAt)}` : ''}</p>}
            </article>
          </li>
        ))}
      </ol>
      {!notes.length && !draft && (
        <div className="pr-empty">
          <Icon name="pen" size={28} />
          <p className="row-title">Nenhum registro ainda</p>
          <p className="sm muted">Registre cada atendimento: data, tipo, o que foi trabalhado e os combinados.</p>
          <button className="btn-primary sm-btn" onClick={() => setDraft(blank)}><Icon name="plus" size={14} /> Primeiro registro</button>
        </div>
      )}
      {notes.length > 0 && !list.length && <p className="muted center pad">Nenhum registro com estes filtros.</p>}
    </div>
  );
}

/* ---------- Pauta ---------- */
function TopicLine({ t, tri }) {
  return (
    <li className={tri?.level === 'alta' || (!tri?.level && t.prio) ? 'prio' : ''}>
      <Icon name="flag" size={14} />
      <div><p className="row-title">{t.t}</p><p className="xs">{[tri?.level && `Sua prioridade: ${LEVELS.find(([k]) => k === tri.level)[1].toLowerCase()}`, t.prio && 'prioridade do paciente'].filter(Boolean).join(' · ') || 'sem prioridade'}</p></div>
    </li>
  );
}

function Pauta({ topics, triage, up }) {
  const set = (t, patch) => up({ triage: { ...triage, [t]: { ...triage[t], ...patch } } });
  const rows = sortTopics(topics, triage);
  return (
    <section className="panel">
      <div className="panel-head"><div><h2 className="h3">Pauta da próxima sessão</h2><p className="muted sm">Assuntos anotados pelo paciente no app. Sua prioridade e o “conversado” ficam só com você.</p></div></div>
      <ul className="topic-rows">
        {rows.map((t) => {
          const tri = triage[t.t] ?? {};
          return (
            <li key={t.t} className={tri.done ? 'done' : ''}>
              <div className="grow">
                <p className={`row-title ${tri.done ? 'strike' : ''}`}>{t.t}</p>
                <p className="xs muted">{[t.d && `anotado em ${t.d}`, t.from, t.prio && 'o paciente marcou como prioridade'].filter(Boolean).join(' · ') || 'anotado no app'}</p>
              </div>
              <Segmented small value={tri.level ?? ''} onChange={(level) => set(t.t, { level: tri.level === level ? null : level })} options={LEVELS} />
              <button className={`btn-secondary sm-btn ${tri.done ? 'on' : ''}`} aria-pressed={!!tri.done} onClick={() => set(t.t, { done: !tri.done })}><Icon name="check" size={14} /> {tri.done ? 'Conversado' : 'Marcar conversado'}</button>
            </li>
          );
        })}
        {!topics.length && <li className="muted sm">O paciente ainda não anotou assuntos.</li>}
      </ul>
    </section>
  );
}

/* ---------- Diário ---------- */
function DiaryEntry({ e }) {
  return (
    <article className="mini-entry">
      <p className="xs muted row gap6">{e.mood && <MoodFace v={e.mood} size={16} />} {e.at ? new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : e.d}{e.agenda && ' · levado para a pauta'}</p>
      <p className="row-title">{e.t}</p>
      <p className="sm">{e.b}</p>
    </article>
  );
}

function Diario({ diary }) {
  return (
    <section className="panel">
      <div className="panel-head"><div><h2 className="h3">Diário compartilhado</h2><p className="muted sm">Só aparecem as entradas que o paciente escolheu compartilhar.</p></div><span className="muted sm">{diary.length} {diary.length === 1 ? 'entrada' : 'entradas'}</span></div>
      {diary.map((e) => <DiaryEntry key={e.id} e={e} />)}
      {!diary.length && <p className="muted sm">Nada compartilhado ainda.</p>}
    </section>
  );
}
