import { useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, LineChart, MoodFace, Chip, RISK, STATUS, PageHead, Spark, Modal, toast, downloadText, usePaged, Pager } from '../ui';
import { FEATURES, CIDS, cidLabel, EMOTIONS, HABIT_ICONS, habitSub, fmtL, ME } from '../data';
import { LinkCard } from './Modals';
import { api } from '../api';

const nextKey = (p) => (p.next === '—' ? 'zz' : p.next.startsWith('Hoje') ? `0${p.next}` : p.next.split(' · ').map((s) => s.split('/').reverse().join('')).join(''));
const permCount = (p) => Object.values(p.perms).filter(Boolean).length;

/* ---------- TABLE (shared with the dashboard) ---------- */
export function PatientTable({ patients, open, compact }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Paciente</th><th>CID</th><th>Status</th>{!compact && <th>Última</th>}<th>Próxima</th>
            <th>Humor · 14 dias</th><th>Uso do app</th>{!compact && <th>Recursos no app</th>}<th>Risco (manual)</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => open(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(p.id)}>
              <td><div className="row gap10"><Avatar name={p.name} size={32} /><div><p className="row-title">{p.name}</p><p className="xs muted">{p.age} anos · {p.mode}</p></div></div></td>
              <td>{p.cid ? <span className="cid" title={cidLabel(p.cid)}>{p.cid}</span> : <span className="muted sm">—</span>}</td>
              <td><Chip kind={STATUS[p.status]}>{p.status}</Chip></td>
              {!compact && <td>{p.last}</td>}
              <td className={p.next.startsWith('Hoje') ? 'strong' : ''}>{p.next}</td>
              <td><Spark d={p.mood} /></td>
              <td><div className="use"><div className="progress thin"><span style={{ width: `${p.use}%` }} /></div><span className="sm">{p.use}%</span></div></td>
              {!compact && <td><span className="sm">{permCount(p)} de {FEATURES.length}</span></td>}
              <td><Chip kind={RISK[p.risk]}>{p.risk}</Chip></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- LIST PAGE ---------- */
export function PatientList({ patients, open, onNew }) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState('todos');
  const [risk, setRisk] = useState('');
  const [cid, setCid] = useState('');
  const [sort, setSort] = useState('nome');
  const count = (f) => patients.filter(f).length;
  const isActive = (p) => p.status.startsWith('Ativ');
  const rows = patients
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.cid.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => st === 'todos' || (st === 'ativos' ? isActive(p) : p.status === st))
    .filter((p) => !risk || p.risk === risk)
    .filter((p) => !cid || p.cid === cid)
    .sort((a, b) => (sort === 'nome' ? a.name.localeCompare(b.name) : sort === 'proxima' ? nextKey(a).localeCompare(nextKey(b)) : b.use - a.use));
  const pg = usePaged(rows, 10);
  return (
    <>
      <PageHead
        title="Pacientes" sub={`${count(isActive)} ativos · ${count((p) => p.status === 'Em pausa')} em pausa · ${count((p) => p.status === 'Alta')} alta`}
        actions={<><button className="btn-secondary" onClick={() => downloadText('pacientes.csv', ['nome;idade;status;cid;ultima;proxima;uso_app;risco', ...rows.map((p) => [p.name, p.age, p.status, p.cid, p.last, p.next, p.use, p.risk].join(';'))].join('\n'), 'text/csv')}><Icon name="download" size={16} /> Exportar</button><button className="btn-primary" onClick={onNew}><Icon name="plus" size={16} /> Novo paciente</button></>}
      />
      <section className="panel">
        <div className="filters">
          <label className="search grow-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CID" aria-label="Buscar por nome ou CID" /></label>
          <Segmented small value={st} onChange={setSt} options={[['todos', 'Todos', patients.length], ['ativos', 'Ativos', count(isActive)], ['Em pausa', 'Em pausa', count((p) => p.status === 'Em pausa')], ['Alta', 'Alta', count((p) => p.status === 'Alta')]]} />
          <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filtrar por risco">
            <option value="">Todos os riscos</option>
            {Object.keys(RISK).map((r) => <option key={r}>{r}</option>)}
          </select>
          <select className="select" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Filtrar por CID">
            <option value="">Todos os CIDs</option>
            {CIDS.filter(([k]) => k).map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
            <option value="nome">Ordenar: nome</option>
            <option value="proxima">Ordenar: próxima sessão</option>
            <option value="uso">Ordenar: uso do app</option>
          </select>
        </div>
        <div className="mt16">
          {rows.length ? <PatientTable patients={pg.rows} open={open} /> : <p className="muted center pad">Nenhum paciente encontrado.</p>}
          <Pager p={pg} noun="pacientes" />
        </div>
        <p className="note"><Icon name="lock" size={14} /> CID e risco são definidos por você e nunca aparecem no app do paciente.</p>
      </section>
    </>
  );
}

/* ---------- PROFILE ---------- */
export function PatientProfile({ p, store, a }) {
  const [tab, setTab] = useState('visao');
  const up = (patch) => store.updatePatient(p.id, patch);
  const newRx = p.rx.filter((r) => r.status === 'Nova').length;
  return (
    <>
      <div className="patient-head">
        <Avatar name={p.name} size={64} />
        <div className="grow">
          <div className="row gap8 wrap"><h1 className="d-title">{p.name}</h1><Chip kind={STATUS[p.status]}>{p.status}</Chip></div>
          <p className="muted">{p.age} anos · {p.mode} · última sessão {p.last} · próxima {p.next}</p>
          <p className="xs muted mt8 row gap6"><span className={`dot ${p.use ? 'ok' : ''}`} /> {p.use ? `App conectado · uso de ${p.use}% nos últimos 14 dias` : 'App ainda não usado'}</p>
        </div>
        <div className="def-box">
          <label className="xs muted" htmlFor="cid">CID · definido por você</label>
          <select id="cid" className="select" value={p.cid} onChange={(e) => up({ cid: e.target.value })}>
            {CIDS.map(([k, l]) => <option key={k} value={k}>{k ? `${k} · ${l}` : l}</option>)}
          </select>
        </div>
        <div className="def-box">
          <label className="xs muted" htmlFor="risk">Risco · definido por você</label>
          <select id="risk" className={`select risk-${RISK[p.risk]}`} value={p.risk} onChange={(e) => up({ risk: e.target.value })}>
            {Object.keys(RISK).map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="row gap8">
          <button className="btn-secondary" onClick={() => a.newSession({ pid: p.id })}><Icon name="calendar" size={16} /> Agendar</button>
          <button className="btn-secondary" onClick={() => a.openEditor({ pid: p.id, tpl: 'declaracao' })}><Icon name="file" size={16} /> Gerar documento</button>
          <button className="btn-primary" onClick={() => a.run(p.id)}><Icon name="video" size={16} /> Iniciar sessão</button>
        </div>
      </div>
      {p.link && !p.link.linked && (
        <section className="panel link-banner">
          <div className="row gap8"><Icon name="clock" size={16} /><b className="sm">Aguardando o paciente criar a conta e digitar o código</b></div>
          <LinkCard compact patient={p} onNewCode={async () => {
            try { const { patient } = await api.patients.newCode(p.id); up({ link: { linked: false, code: patient.code, url: patient.link, expiresAt: patient.codeExpiresAt } }); toast('Novo código gerado; o anterior parou de valer'); } catch (e) { toast(e.message, 'warn'); }
          }} />
        </section>
      )}
      <div className="tabs-line" role="tablist">
        {[['visao', 'Visão geral'], ['plano', 'Plano no app'], ['remedios', 'Remédios e receitas', newRx], ['permissoes', 'Permissões do app']].map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}{n > 0 && <span className="tab-badge">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'visao' && (p.id === ME ? <OverviewFull p={p} store={store} /> : <OverviewBasic p={p} />)}
      {tab === 'plano' && <Plano p={p} up={up} />}
      {tab === 'remedios' && <RemediosReceitas p={p} up={up} />}
      {tab === 'permissoes' && <Permissoes p={p} up={up} />}
    </>
  );
}

/* ---------- OVERVIEW ---------- */
const MOOD30 = [4, 4, 3, 4, 3, 3, 4, 4, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 4, 3, 4, 4, 3, 3, 2, 3, 2, 2, 3, 3];
const SERIES = {
  humor: { points: MOOD30, min: 1, max: 5, label: 'Humor médio do dia (1 a 5)' },
  habitos: { points: [2, 3, 3, 2, 3, 3, 2, 3, 3, 3, 2, 3, 2, 3, 3, 2, 3, 3, 2, 2, 3, 2, 2, 1, 2, 2, 1, 2, 2, 1], min: 0, max: 3, label: 'Hábitos cumpridos no dia (de 3)' },
  remedios: { points: [3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], min: 0, max: 3, label: 'Doses registradas no dia (de 3)' },
};

function OverviewBasic({ p }) {
  return (
    <div className="grid-2-1">
      <section className="panel">
        <div className="panel-head"><div><h2 className="h3">Humor no app · 14 dias</h2><p className="muted sm">Escala de 1 a 5 registrada pelo paciente</p></div></div>
        {p.mood ? <LineChart points={p.mood} height={160} /> : <p className="muted pad center">Ainda não há registros no app.</p>}
      </section>
      <section className="panel">
        <h2 className="h3">Plano no app</h2>
        <ul className="meds">
          <li><Icon name="checks" size={16} /><span className="grow">Hábitos</span><span className="muted sm">{p.habits.length}</span></li>
          <li><Icon name="pill" size={16} /><span className="grow">Remédios</span><span className="muted sm">{p.meds.length}</span></li>
          <li><Icon name="drop" size={16} /><span className="grow">Meta de água</span><span className="muted sm">{p.perms.agua ? fmtL(p.waterGoal) : 'desligada'}</span></li>
          <li><Icon name="sliders" size={16} /><span className="grow">Recursos ligados</span><span className="muted sm">{permCount(p)} de {FEATURES.length}</span></li>
        </ul>
        <p className="note"><Icon name="sparkles" size={14} /> O resumo pré-sessão aparece após 2 semanas de registros no app.</p>
      </section>
    </div>
  );
}

function OverviewFull({ p, store }) {
  const [metric, setMetric] = useState('humor');
  const nights = Object.entries(store.sleep).sort((a, b) => b[0] - a[0]).slice(0, 5);
  const avg = nights.length ? nights.reduce((s, [, n]) => s + sleepMin(n), 0) / nights.length : 0;
  return (
    <div className="grid-2-1">
      <div className="stack">
        <section className="panel ai-panel">
          <div className="panel-head">
            <div><h2 className="h3 row gap6"><Icon name="sparkles" size={18} /> Resumo pré-sessão</h2><p className="muted sm">Semana de 09 a 15/11 · gerado localmente às 06:00</p></div>
            <Chip kind="ai">Rascunho da IA</Chip>
          </div>
          <ul className="ai-list">
            <li>Humor médio caiu de <b>3,9 para 3,1</b>, com a queda concentrada a partir de sexta (13/11).</li>
            <li>Emoção mais registrada: <b>ansiedade (9 vezes)</b>, quase sempre ligada a trabalho. Calma aparece 6 vezes, sobretudo após a respiração.</li>
            <li>Sono médio de <b>{fmtH(avg)}</b> com despertares de madrugada em 3 noites; “Dormir antes das 23h” cumprido em 3 de 7 dias.</li>
            <li>Trouxe 3 assuntos para a pauta. O prioritário é uma conversa difícil com o gestor, também citada no diário.</li>
          </ul>
          <div className="ai-foot">
            <p className="xs muted row gap6"><Icon name="alert" size={14} /> Revise antes de usar. A IA organiza os registros do app; não define diagnóstico nem risco.</p>
            <button className="btn-secondary sm-btn" onClick={() => copyText([...document.querySelectorAll('.ai-list li')].map((li) => '- ' + li.textContent).join('\n'), 'Resumo copiado para colar na evolução')}><Icon name="copy" size={14} /> Copiar para a evolução</button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2 className="h3">Acompanhamento pelo app</h2><p className="muted sm">Últimos 30 dias · linhas verticais marcam as sessões</p></div>
            <Segmented small value={metric} onChange={setMetric} options={[['humor', 'Humor'], ['habitos', 'Hábitos'], ['remedios', 'Remédios']]} />
          </div>
          <p className="xs muted">{SERIES[metric].label}</p>
          <LineChart key={metric} points={SERIES[metric].points} min={SERIES[metric].min} max={SERIES[metric].max} height={170} marks={[4, 11, 18, 25]} labels={['18/10', '25/10', '01/11', '08/11', 'Hoje']} />
          <div className="mini-stats four">
            <div><p className="muted sm">Hábitos cumpridos</p><p className="kpi-value sm-kpi">64%</p></div>
            <div><p className="muted sm">Adesão aos remédios</p><p className="kpi-value sm-kpi">96%</p><p className="xs muted">só você vê</p></div>
            <div><p className="muted sm">Água · média diária</p><p className="kpi-value sm-kpi">{fmtL(1530)}</p><p className="xs muted">meta {fmtL(p.waterGoal)}</p></div>
            <div><p className="muted sm">Sono médio</p><p className="kpi-value sm-kpi">{fmtH(avg)}</p></div>
          </div>
        </section>

        <Emocoes counts={store.emotions} />
      </div>

      <div className="stack">
        <section className="panel">
          <h2 className="h3">Pauta trazida pela paciente</h2>
          <p className="muted sm">Para a sessão de quinta, 19/11 · 18:00</p>
          <ul className="pauta">
            <li className="prio"><Icon name="flag" size={14} /><div><p className="row-title">Conversa difícil com o gestor na sexta</p><p className="xs prio-txt">Marcado como prioridade</p></div></li>
            <li><Icon name="flag" size={14} /><p className="row-title">Voltou a acordar de madrugada</p></li>
            <li><Icon name="flag" size={14} /><p className="row-title">Viagem de dezembro</p></li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="h3">Sono · últimas noites</h2>
          <ul className="sleep-list">
            {nights.map(([off, n]) => (
              <li key={off}>
                <span className="sm grow">{+off === 0 ? 'Hoje' : +off === -1 ? 'Ontem' : `Há ${-off} dias`}</span>
                <span className="sm muted">{n.bed}–{n.wake}</span>
                <span className="sleep-bar"><span style={{ width: `${Math.min(100, (sleepMin(n) / 540) * 100)}%` }} /></span>
                <b className="sm">{fmtH(sleepMin(n))}</b>
                <span className="xs muted">{n.wakeups ? `${n.wakeups} desp.` : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <div className="row-between"><h2 className="h3">Diário compartilhado</h2><span className="muted sm">5 de 9</span></div>
          {[['Dom, 15/11 · 04:20', 'Acordei às 4h de novo', 'Fiquei repassando a conversa de sexta. Fiz a respiração e consegui voltar a dormir lá pelas 5h.'],
            ['Sex, 13/11 · 19:45', 'Reunião com o gestor', 'Saí da reunião com o coração acelerado. Quero levar isso para a sessão.']].map(([d, t, b]) => (
            <article key={d} className="mini-entry">
              <p className="xs muted row gap6"><MoodFace v={2} size={16} /> {d} · humor: mal</p>
              <p className="row-title">{t}</p>
              <p className="sm">{b}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

const sleepMin = (n) => { const t = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; }; return (t(n.wake) - t(n.bed) + 1440) % 1440; };
const fmtH = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

function Emocoes({ counts }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;
  const pos = rows.filter(([e]) => EMOTIONS.pos.includes(e)).reduce((s, r) => s + r[1], 0);
  const neg = rows.filter(([e]) => EMOTIONS.neg.includes(e)).reduce((s, r) => s + r[1], 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="h3">Emoções registradas · 14 dias</h2><p className="muted sm">Escolhidas pela paciente a cada registro, além do humor</p></div>
        <div className="emo-split" aria-label={`${pos} agradáveis, ${neg} difíceis`}>
          <span className="pos" style={{ flex: pos }} /><span className="neg" style={{ flex: neg }} />
        </div>
      </div>
      <ul className="emo-bars">
        {rows.map(([e, n]) => (
          <li key={e}>
            <span className="sm">{e}</span>
            <span className="emo-track"><span className={EMOTIONS.pos.includes(e) ? 'pos' : 'neg'} style={{ width: `${(n / max) * 100}%` }} /></span>
            <b className="sm">{n}</b>
          </li>
        ))}
      </ul>
      <div className="legend row gap16 mt12">
        <span className="row gap6"><span className="lg lg-pos" /> Agradáveis · {pos}</span>
        <span className="row gap6"><span className="lg lg-neg" /> Difíceis · {neg}</span>
      </div>
    </section>
  );
}

/* ---------- PLANO NO APP (hábitos, lembretes, água) ---------- */
const FREQS = ['Todos os dias', 'Dias úteis', '5 vezes por semana', '3 vezes por semana', '1 vez por semana'];

function Plano({ p, up }) {
  const blank = { icon: 'wind', name: '', detail: '', freq: 'Todos os dias', reminder: '08:00' };
  const [draft, setDraft] = useState(null);
  const setHabit = (id, patch) => up({ habits: p.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const save = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    up({ habits: [...p.habits, { ...draft, name: draft.name.trim(), id: Date.now(), week: [0, 0, 0, 0, 0, 0, 0] }] });
    toast(`Hábito “${draft.name.trim()}” adicionado ao app`);
    setDraft(null);
  };
  return (
    <div className="grid-2-1">
      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Hábitos e lembretes</h2><p className="muted sm">O paciente vê exatamente estes hábitos e recebe os lembretes nos horários abaixo.</p></div>
          {!draft && <button className="btn-primary sm-btn" onClick={() => setDraft(blank)}><Icon name="plus" size={14} /> Adicionar hábito</button>}
        </div>
        {!p.perms.habitos && <p className="note warn-note"><Icon name="alert" size={14} /> Hábitos estão desligados nas permissões do app deste paciente.</p>}
        <ul className="habit-edit">
          {p.habits.map((h) => (
            <li key={h.id}>
              <span className="ico-tile tile-habit"><Icon name={h.icon} size={18} /></span>
              <div className="grow">
                <p className="row-title">{h.name}</p>
                <p className="xs muted">{habitSub(h)} · {h.week.filter(Boolean).length} de 7 dias</p>
              </div>
              <select className="select sm-select" value={h.freq} onChange={(e) => setHabit(h.id, { freq: e.target.value })} aria-label={`Frequência de ${h.name}`}>
                {FREQS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <div className="reminder">
                <Toggle label={`Lembrete de ${h.name}`} on={!!h.reminder} onChange={(on) => setHabit(h.id, { reminder: on ? '08:00' : '' })} />
                <input type="time" value={h.reminder} disabled={!h.reminder} onChange={(e) => setHabit(h.id, { reminder: e.target.value })} aria-label={`Horário do lembrete de ${h.name}`} />
              </div>
              <button className="icon-btn" aria-label={`Remover ${h.name}`} onClick={() => up({ habits: p.habits.filter((x) => x.id !== h.id) })}><Icon name="x" size={16} /></button>
            </li>
          ))}
          {p.habits.length === 0 && <li className="muted sm">Nenhum hábito definido.</li>}
        </ul>
        {draft && (
          <Modal title="Adicionar hábito" sub={`Aparece no app de ${p.name.split(' ')[0]} com lembrete no horário escolhido.`} onClose={() => setDraft(null)}
            footer={<><button className="btn-secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="btn-primary" form="habit-form">Salvar hábito</button></>}>
          <form id="habit-form" className="stack-12" onSubmit={save}>
            <div className="icon-pick" role="radiogroup" aria-label="Ícone">
              {HABIT_ICONS.map(([i, l]) => (
                <button type="button" key={i} role="radio" aria-checked={draft.icon === i} aria-label={l} className={draft.icon === i ? 'on' : ''} onClick={() => setDraft({ ...draft, icon: i })}><Icon name={i} size={16} /></button>
              ))}
            </div>
            <label className="field grow">Hábito<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Alongamento ao acordar" required /></label>
            <label className="field">Duração/meta<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="10 min" /></label>
            <label className="field">Frequência<select className="select" value={draft.freq} onChange={(e) => setDraft({ ...draft, freq: e.target.value })}>{FREQS.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label className="field">Lembrete<input type="time" value={draft.reminder} onChange={(e) => setDraft({ ...draft, reminder: e.target.value })} /></label>
          </form>
          </Modal>
        )}
      </section>

      <div className="stack">
        <section className="panel">
          <div className="row-between">
            <div className="row gap10"><span className="ico-tile tile-water"><Icon name="drop" size={18} /></span><div><h2 className="h3">Água</h2><p className="xs muted">Meta diária mostrada no app</p></div></div>
            <Toggle label="Água no app" on={p.perms.agua} onChange={(v) => up({ perms: { ...p.perms, agua: v } })} />
          </div>
          <div className={`goal ${p.perms.agua ? '' : 'off'}`}>
            <button className="icon-btn bordered" aria-label="Diminuir meta" disabled={!p.perms.agua || p.waterGoal <= 1000} onClick={() => up({ waterGoal: p.waterGoal - 250 })}><Icon name="minus" size={16} /></button>
            <div className="center"><p className="kpi-value">{fmtL(p.waterGoal)}</p><p className="xs muted">{p.waterGoal / 250} copos de 250 ml</p></div>
            <button className="icon-btn bordered" aria-label="Aumentar meta" disabled={!p.perms.agua || p.waterGoal >= 4000} onClick={() => up({ waterGoal: p.waterGoal + 250 })}><Icon name="plus" size={16} /></button>
          </div>
        </section>
        <section className="panel">
          <h2 className="h3">Lembretes de remédios</h2>
          <p className="xs muted">Horários cadastrados em Remédios e receitas.</p>
          <ul className="meds">
            {p.meds.map((m) => <li key={m.id}><Icon name="bell" size={16} /><span className="grow">{m.name}</span><span className="muted sm">{m.time}</span></li>)}
            {p.meds.length === 0 && <li className="muted sm">Nenhum remédio cadastrado.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ---------- REMÉDIOS E RECEITAS ---------- */
function RemediosReceitas({ p, up }) {
  const blank = { name: '', time: '08:00', instr: '', by: '' };
  const [draft, setDraft] = useState(null);
  const [showRx, setShowRx] = useState(null);
  const save = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    up({ meds: [...p.meds, { ...draft, name: draft.name.trim(), id: Date.now() }] });
    toast(`${draft.name.trim()} cadastrado · lembrete às ${draft.time} no app`);
    setDraft(null);
  };
  const setRx = (id, patch) => up({ rx: p.rx.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <div className="grid-2-1">
      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Remédios em uso</h2><p className="muted sm">Cadastrados por você a partir das receitas. Viram lembretes no app do paciente.</p></div>
          {!draft && <button className="btn-primary sm-btn" onClick={() => setDraft(blank)}><Icon name="plus" size={14} /> Cadastrar remédio</button>}
        </div>
        {draft && (
          <Modal title="Cadastrar remédio" sub="O horário vira lembrete no app do paciente." onClose={() => setDraft(null)}
            footer={<><button className="btn-secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="btn-primary" form="med-form">Salvar remédio</button></>}>
          <form id="med-form" className="stack-12" onSubmit={save}>
            <label className="field grow">Remédio e dose<input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Escitalopram 10 mg" required /></label>
            <label className="field">Horário (lembrete)<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
            <label className="field grow">Como tomar<input value={draft.instr} onChange={(e) => setDraft({ ...draft, instr: e.target.value })} placeholder="1 comprimido · após o café" /></label>
            <label className="field">Prescrito por<input value={draft.by} onChange={(e) => setDraft({ ...draft, by: e.target.value })} placeholder="psiquiatra" /></label>
          </form>
          </Modal>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Remédio</th><th>Horário</th><th>Como tomar</th><th>Prescrito por</th>{p.id === ME && <th>Adesão 30d</th>}<th /></tr></thead>
            <tbody>
              {p.meds.map((m, i) => (
                <tr key={m.id}>
                  <td className="row-title">{m.name}</td>
                  <td>{m.time}</td>
                  <td className="muted">{m.instr || '—'}</td>
                  <td className="muted">{m.by || '—'}</td>
                  {p.id === ME && <td><Chip kind={i === 0 ? 'warn' : 'ok'}>{i === 0 ? '93%' : '100%'}</Chip></td>}
                  <td className="right"><button className="icon-btn" aria-label={`Remover ${m.name}`} onClick={() => up({ meds: p.meds.filter((x) => x.id !== m.id) })}><Icon name="x" size={16} /></button></td>
                </tr>
              ))}
              {p.meds.length === 0 && <tr><td colSpan={6} className="muted">Nenhum remédio cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note"><Icon name="eye" size={14} /> A adesão aparece só para você. O paciente vê apenas os lembretes e marca “Tomei”.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Receitas enviadas</h2><p className="muted sm">Fotos e PDFs enviados pelo paciente no app</p></div>
          {!p.perms.receitas && <Chip kind="warn">Envio desligado</Chip>}
        </div>
        <ul className="rx-list">
          {p.rx.map((r) => (
            <li key={r.id} className={r.status === 'Nova' ? 'new' : ''}>
              <span className="ico-tile tile-doc"><Icon name="file" size={18} /></span>
              <div className="grow">
                <p className="row-title">{r.med}</p>
                <p className="xs muted">{r.file} · {r.date}</p>
              </div>
              <Chip kind={r.status === 'Nova' ? 'accent' : 'quiet'}>{r.status === 'Nova' ? 'Nova' : 'Guardada'}</Chip>
              {r.url
                ? <a className="btn-ghost-sm" href={r.url} target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> Ver</a>
                : <button className="btn-ghost-sm" onClick={() => setShowRx(r)}><Icon name="eye" size={14} /> Ver</button>}
              {r.status === 'Nova' && <button className="btn-secondary sm-btn" onClick={() => { setRx(r.id, { status: 'Arquivada' }); toast('Receita guardada no prontuário'); }}><Icon name="archive" size={14} /> Guardar</button>}
            </li>
          ))}
          {p.rx.length === 0 && <li className="muted sm">Nenhuma receita enviada.</li>}
        </ul>
      </section>
      {showRx && (
        <Modal title={`Receita · ${showRx.med}`} sub={`${showRx.file} · enviada em ${showRx.date}`} onClose={() => setShowRx(null)}
          footer={<button className="btn-primary" onClick={() => downloadText(showRx.file.replace(/.w+$/, '.txt'), `Receita de ${showRx.med}
Paciente: ${p.name}
Enviada em ${showRx.date}`)}><Icon name="download" size={16} /> Baixar</button>}>
          <div className="rx-mock">
            <p className="xs muted">Arquivo de exemplo</p>
            <p className="row-title">Receituário de controle especial</p>
            <p className="sm">Paciente: {p.name}</p>
            <p className="sm">Uso oral: {showRx.med} · 1 comprimido ao dia, contínuo</p>
            <p className="xs muted mt12">Dr. Ricardo Alves · psiquiatra · CRM-GO 00000</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- PERMISSÕES ---------- */
function Permissoes({ p, up }) {
  const set = (k, v) => up({ perms: { ...p.perms, [k]: v } });
  return (
    <section className="panel perms-panel">
      <div className="panel-head">
        <div><h2 className="h3">O que {p.name.split(' ')[0]} vê e registra no app</h2><p className="muted sm">Mudanças valem na hora. Recursos desligados somem do app do paciente.</p></div>
        <div className="row gap8">
          <button className="btn-secondary sm-btn" onClick={() => up({ perms: Object.fromEntries(FEATURES.map(([k]) => [k, true])) })}>Ligar tudo</button>
          <button className="btn-secondary sm-btn" onClick={() => up({ perms: Object.fromEntries(FEATURES.map(([k]) => [k, false])) })}>Desligar tudo</button>
        </div>
      </div>
      <ul className="perm-grid">
        {FEATURES.map(([k, l, d, i]) => (
          <li key={k} className={p.perms[k] ? 'on' : ''}>
            <span className="ico-tile tile-habit"><Icon name={i} size={18} /></span>
            <div className="grow"><p className="row-title">{l}</p><p className="xs muted">{d}</p></div>
            <Toggle label={l} on={p.perms[k]} onChange={(v) => set(k, v)} />
          </li>
        ))}
      </ul>
      <p className="note"><Icon name="lock" size={14} /> Sempre visíveis: tela Hoje, próxima sessão e Documentos (notas fiscais, declarações e atestados). Adesão, CID e risco nunca aparecem para o paciente.</p>
    </section>
  );
}

// Clipboard write with a toast; falls back to a warning if the browser refuses.
function copyText(text, ok) {
  navigator.clipboard?.writeText(text).then(() => toast(ok), () => toast('Não foi possível copiar. Selecione o texto e copie.', 'warn'));
}
