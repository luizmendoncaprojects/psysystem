import { useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, Chip, RISK, STATUS, PageHead, Spark, Modal, toast, downloadText, usePaged, Pager } from '../ui';
import { FEATURES, cidLabel, EMOTIONS, HABIT_ICONS, habitSub, fmtL, ME } from '../data';

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
            <th>Humor · 14 dias</th><th>Uso do app</th>{!compact && <th>Recursos no app</th>}<th title="Risco de suicídio / autolesão · sua avaliação">Risco (suicídio)</th>
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
          <label className="search grow-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou CID" aria-label="Buscar por nome ou CID" /></label>
          <Segmented small value={st} onChange={setSt} options={[['todos', 'Todos', patients.length], ['ativos', 'Ativos', count(isActive)], ['Em pausa', 'Em pausa', count((p) => p.status === 'Em pausa')], ['Alta', 'Alta', count((p) => p.status === 'Alta')]]} />
          <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filtrar por risco">
            <option value="">Risco de suicídio: todos</option>
            {Object.keys(RISK).map((r) => <option key={r}>{r}</option>)}
          </select>
          <select className="select" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Filtrar por CID">
            <option value="">Todos os CIDs</option>
            {[...new Set(patients.map((p) => p.cid).filter(Boolean))].sort().map((k) => <option key={k} value={k}>{k} · {cidLabel(k)}</option>)}
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
        <p className="note"><Icon name="lock" size={14} /> CID-11 e risco de suicídio/autolesão são definidos por você e nunca aparecem no app do paciente.</p>
      </section>
    </>
  );
}

export function Emocoes({ counts }) {
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

export function Plano({ p, up }) {
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
export function RemediosReceitas({ p, up }) {
  const blank = { name: '', time: '08:00', instr: '', by: '' };
  const [draft, setDraft] = useState(null);
  const [showRx, setShowRx] = useState(null);
  const save = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const { rxId, ...med } = draft; // rxId: saving this medicine also accepts that prescription
    const name = med.name.trim();
    up({ meds: [...p.meds, { ...med, name, id: Date.now() }], ...(rxId && { rx: p.rx.map((r) => (r.id === rxId ? { ...r, status: 'Aceita', med: name } : r)) }) });
    toast(`${name} cadastrado · lembrete às ${draft.time} no app${rxId ? ' · receita aceita' : ''}`);
    setDraft(null);
  };
  return (
    <div className="grid-2-1">
      <section className="panel">
        <div className="panel-head">
          <div><h2 className="h3">Remédios em uso</h2><p className="muted sm">Cadastrados por você a partir das receitas. Viram lembretes no app do paciente.</p></div>
          {!draft && <button className="btn-primary sm-btn" onClick={() => setDraft(blank)}><Icon name="plus" size={14} /> Cadastrar remédio</button>}
        </div>
        {draft && (
          <Modal title={draft.rxId ? 'Aceitar receita' : 'Cadastrar remédio'} sub={draft.rxId ? 'Preencha o remédio da receita. O horário vira lembrete no app do paciente.' : 'O horário vira lembrete no app do paciente.'} onClose={() => setDraft(null)}
            footer={<><button className="btn-secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="btn-primary" form="med-form">{draft.rxId ? 'Salvar e aceitar receita' : 'Salvar remédio'}</button></>}>
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
                <p className="row-title">{r.med || 'Receita enviada'}</p>
                <p className="xs muted">{r.file} · {r.date}</p>
              </div>
              <Chip kind={r.status === 'Nova' ? 'accent' : 'quiet'}>{r.status === 'Nova' ? 'Nova' : 'Aceita'}</Chip>
              {(r.url || r.data)
                ? <a className="btn-ghost-sm" href={r.url || r.data} download={r.data ? r.file : undefined} target="_blank" rel="noreferrer"><Icon name={r.data ? "download" : "eye"} size={14} /> {r.data ? "Baixar" : "Ver"}</a>
                : <button className="btn-ghost-sm" onClick={() => setShowRx(r)}><Icon name="eye" size={14} /> Ver</button>}
              {r.status === 'Nova' && <button className="btn-primary sm-btn" onClick={() => setDraft({ ...blank, rxId: r.id })}><Icon name="check" size={14} /> Aceitar</button>}
            </li>
          ))}
          {p.rx.length === 0 && <li className="muted sm">Nenhuma receita enviada.</li>}
        </ul>
      </section>
      {showRx && (
        <Modal title={`Receita · ${showRx.med || showRx.file}`} sub={`${showRx.file} · enviada em ${showRx.date}`} onClose={() => setShowRx(null)}
          footer={<button className="btn-primary" onClick={() => downloadText(showRx.file.replace(/.w+$/, '.txt'), `Receita ${showRx.file}
Paciente: ${p.name}
Enviada em ${showRx.date}`)}><Icon name="download" size={16} /> Baixar</button>}>
          <div className="rx-mock">
            <p className="xs muted">Arquivo de exemplo</p>
            <p className="row-title">Receituário de controle especial</p>
            <p className="sm">Paciente: {p.name}</p>
            <p className="sm">Uso oral: {showRx.med || "—"} · 1 comprimido ao dia, contínuo</p>
            <p className="xs muted mt12">Dr. Ricardo Alves · psiquiatra · CRM-GO 00000</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- PERMISSÕES ---------- */
export function Permissoes({ p, up }) {
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
export function copyText(text, ok) {
  navigator.clipboard?.writeText(text).then(() => toast(ok), () => toast('Não foi possível copiar. Selecione o texto e copie.', 'warn'));
}
