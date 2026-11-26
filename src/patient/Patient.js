import { useRef, useState } from 'react';
import { Icon, MoodPicker, MoodFace, Avatar, Segmented, Toggle, MOODS, Modal, toast, downloadText } from '../ui';
import { DocPaper } from '../panel/Docs';
import { EMOTIONS, fmtL, habitSub, brl, ME } from '../data';
import Settings from './Settings';

// [key, label, icon, visible(perms)]
const TABS = [
  ['hoje', 'Hoje', 'home', () => true],
  ['humor', 'Humor', 'smile', (p) => p.humor || p.emocoes],
  ['rotina', 'Rotina', 'checks', (p) => p.habitos || p.agua || p.remedios || p.receitas],
  ['diario', 'Diário', 'book', (p) => p.diario || p.pauta],
  ['docs', 'Documentos', 'file', () => true],
];

export default function Patient({ store }) {
  const { perms, patientPrefs: prefs, setPatientPrefs } = store;
  const [tab, setTab] = useState('hoje');
  const [dir, setDir] = useState(0); // -1 came from the right, 1 from the left: drives the slide-in
  const [mood, setMood] = useState(null);
  const [taken, setTaken] = useState({ 1: '08:12' }); // medId → time taken
  const [diarioSub, setDiarioSub] = useState('diario');
  const touch = useRef(null);
  const tabs = TABS.filter((t) => t[3](perms));
  const cur = tab === 'config' || tabs.some((t) => t[0] === tab) ? tab : 'hoje'; // tab may be turned off by the psychologist; config opens from the avatar
  const idx = tabs.findIndex((t) => t[0] === cur);
  const go = (t, sub) => {
    setDir(Math.sign(tabs.findIndex((x) => x[0] === t) - idx));
    setTab(t);
    if (sub) setDiarioSub(sub);
    document.querySelector('.phone-scroll')?.scrollTo(0, 0);
  };
  const ctx = { ...store, mood, setMood, taken, setTaken, go };

  // Swipe left/right on the content to move between bottom tabs. Ignored on form controls and horizontal scrollers.
  const onTouchStart = (e) => {
    touch.current = !prefs.swipe || e.target.closest('input, select, textarea, .no-swipe') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current || cur === 'config') return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // too short or mostly vertical (scroll)
    const next = tabs[idx + (dx < 0 ? 1 : -1)];
    if (next) go(next[0]);
  };

  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const cls = ['phone', dark && 'theme-dark', prefs.colorblind && 'cb', prefs.text === 'large' && 'text-lg'].filter(Boolean).join(' ');

  return (
    <div className={cls} style={{ '--accent': prefs.accent }} aria-label="App do paciente">
      <main className="phone-scroll" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-testid="patient-content">
        <div key={cur} className={`tab-pane in-${dir < 0 ? 'left' : dir > 0 ? 'right' : 'none'}`}>
          {cur === 'hoje' && <Hoje {...ctx} />}
          {cur === 'humor' && <Humor {...ctx} />}
          {cur === 'rotina' && <Rotina {...ctx} />}
          {cur === 'diario' && <DiarioTab perms={perms} sub={diarioSub} setSub={setDiarioSub} />}
          {cur === 'docs' && <Documentos store={store} />}
          {cur === 'config' && <Settings prefs={prefs} setPrefs={setPatientPrefs} onBack={() => go('hoje')} onLogout={() => store.logout('paciente')} />}
        </div>
      </main>
      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} aria-label="Navegação principal">
        {tabs.map(([k, l, i]) => (
          <button key={k} className={cur === k ? 'on' : ''} aria-current={cur === k ? 'page' : undefined} onClick={() => go(k)}>
            <span className="tab-ico"><Icon name={i} size={22} /></span>
            <span>{l}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Header({ eyebrow, title, sub, right }) {
  return (
    <header className="p-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="p-title">{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/* ---------- HOJE ---------- */
const MOODS_LABEL = MOODS.map((m) => m.label);
const TODAY = new Date(2026, 10, 16);
const dayLabel = (off) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + off);
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '');
  return s[0].toUpperCase() + s.slice(1);
};
const PAST_WATER = [1500, 2000, 1250, 1750, 1000, 2000]; // index = -off - 1

function Hoje({ patientPrefs, perms, mood, setMood, go, meds, taken, setTaken, water, setWater, waterGoal, sleep, setSleep, habits, setHabits }) {
  const [off, setOff] = useState(0); // 0 = hoje, -1 = ontem… past days are read-only except sleep
  const past = off < 0;
  const day = 6 + off; // index into habit.week
  const items = [
    ...(perms.remedios ? meds.map((m) => ({
      id: m.id, med: true, icon: 'pill', t: m.name,
      s: past ? `Remédio · ${m.time}` : taken[m.id] ? `Remédio · tomado às ${taken[m.id]}` : `Remédio · hoje às ${m.time}`,
      done: past ? true : !!taken[m.id],
    })) : []),
    ...(perms.habitos ? habits.map((h) => ({ id: `h${h.id}`, hid: h.id, icon: h.icon, t: h.name, s: `Hábito · ${[h.detail, h.reminder && `às ${h.reminder}`].filter(Boolean).join(' · ') || h.freq.toLowerCase()}`, done: !!h.week[day] })) : []),
  ];
  const dayMood = past ? WEEK[6 + off][1] : mood;
  const dayWater = past ? PAST_WATER[-off - 1] : water;
  const toggle = (it) => (it.med
    ? setTaken((t) => { const n = { ...t }; if (n[it.id]) delete n[it.id]; else n[it.id] = '09:41'; return n; })
    : setHabits(habits.map((h) => (h.id === it.hid ? { ...h, week: h.week.map((w, n) => (n === 6 ? 1 - w : w)) } : h))));
  const done = items.filter((i) => i.done).length;
  return (
    <>
      <header className="p-head">
        <div>
          <div className="date-nav">
            <button className="date-btn" aria-label="Dia anterior" disabled={off <= -6} onClick={() => setOff(off - 1)}><Icon name="chevL" size={16} /></button>
            <span className="eyebrow">{dayLabel(off)}</span>
            <button className="date-btn" aria-label="Próximo dia" disabled={off >= 0} onClick={() => setOff(off + 1)}><Icon name="chevR" size={16} /></button>
          </div>
          <h1 className="p-title">{off === 0 ? `Olá, ${patientPrefs.account.name.split(' ')[0]}` : off === -1 ? 'Ontem' : `Há ${-off} dias`}</h1>
        </div>
        {past
          ? <button className="btn-secondary sm-btn" onClick={() => setOff(0)}>Hoje</button>
          : <button className="icon-btn avatar-btn" aria-label="Perfil e configurações" onClick={() => go('config')}><Avatar name={patientPrefs.account.name} size={40} tone={2} /></button>}
      </header>

      {past && <p className="readonly-note"><Icon name="lock" size={14} /> Dias anteriores são só para consulta. Você pode ajustar apenas o sono.</p>}

      {perms.humor && (past ? (
        <section className="card row gap12">
          <MoodFace v={dayMood} size={40} />
          <div><p className="muted sm">Humor registrado</p><p className="row-title">{MOODS_LABEL[dayMood - 1]}</p></div>
        </section>
      ) : (
        <section className="card card-soft">
          <div className="row-between">
            <h2 className="h3">Como você está agora?</h2>
            <span className="pill-mini">5 seg</span>
          </div>
          <MoodPicker value={mood} onChange={setMood} />
          {mood && <p className="saved-note"><Icon name="check" size={16} /> Registrado. {perms.emocoes && <>Quer dizer o que sente? <button className="link" onClick={() => go('humor')}>Emoções</button></>}</p>}
        </section>
      ))}

      {perms.sono && <Sleep key={off} off={off} value={sleep[off]} onSave={(v) => setSleep({ ...sleep, [off]: v })} />}

      {!past && <section className="card session-card">
        <div className="row-between">
          <span className="eyebrow on-dark">Próxima sessão</span>
          <span className="chip chip-glass"><Icon name="video" size={14} /> Online</span>
        </div>
        <p className="session-when">Quinta, 19/11 · 18:00</p>
        <p className="on-dark-muted">com Débora Mendonça · 50 min · link libera 10 min antes</p>
        {perms.pauta && (
          <button className="session-agenda" onClick={() => go('diario', 'pauta')}>
            <span><strong>Assuntos</strong> para a próxima sessão</span>
            <span className="row gap4">Ver <Icon name="chevR" size={16} /></span>
          </button>
        )}
      </section>}

      {perms.agua && <Water water={dayWater} setWater={setWater} readOnly={past} goal={waterGoal} />}

      {items.length > 0 && (
        <section className="card">
          <div className="row-between">
            <div>
              <h2 className="h3">{past ? 'Rotina do dia' : 'Rotina de hoje'}</h2>
              <p className="muted sm">{done} de {items.length} concluídos</p>
            </div>
            {!past && <button className="link" onClick={() => go('rotina')}>Ver rotina</button>}
          </div>
          <div className="progress"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
          <ul className="list">
            {items.map((it) => (
              <li key={it.id} className="list-row">
                <span className={`ico-tile ${it.med ? 'tile-med' : 'tile-habit'}`}><Icon name={it.icon} size={18} /></span>
                <div className="grow">
                  <p className={`row-title ${it.done ? 'strike' : ''}`}>{it.t}</p>
                  <p className="muted sm">{it.s}</p>
                </div>
                <button className={`check ${it.done ? 'on' : ''}`} disabled={past} aria-label={`Marcar ${it.t}`} aria-pressed={it.done} onClick={() => toggle(it)}>
                  <Icon name="check" size={16} stroke={2.4} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Sleep({ off, value, onSave }) {
  const [d, setD] = useState(value ?? { bed: '23:30', wake: '07:00', q: 0, wakeups: 0 });
  const [saved, setSaved] = useState(!!value);
  const set = (patch) => { setSaved(false); setD({ ...d, ...patch }); };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const dur = (toMin(d.wake) - toMin(d.bed) + 1440) % 1440;
  const Q = ['Péssimo', 'Ruim', 'Ok', 'Bom', 'Ótimo'];
  return (
    <section className="card">
      <div className="row-between">
        <div className="row gap12">
          <span className="ico-tile tile-sleep"><Icon name="moon" size={18} /></span>
          <div>
            <h2 className="h3">Sono</h2>
            <p className="muted sm">{off === 0 ? 'Noite passada' : `Noite antes de ${dayLabel(off).split(',')[0].toLowerCase()}`}</p>
          </div>
        </div>
        <p className="sleep-dur">{Math.floor(dur / 60)}h{String(dur % 60).padStart(2, '0')}</p>
      </div>
      <div className="sleep-times">
        <label>Deitou<input type="time" value={d.bed} onChange={(e) => set({ bed: e.target.value })} /></label>
        <label>Acordou<input type="time" value={d.wake} onChange={(e) => set({ wake: e.target.value })} /></label>
        <div className="stepper">
          <span>Despertares</span>
          <div className="row">
            <button aria-label="Menos despertares" disabled={!d.wakeups} onClick={() => set({ wakeups: d.wakeups - 1 })}><Icon name="minus" size={14} /></button>
            <b aria-live="polite">{d.wakeups}</b>
            <button aria-label="Mais despertares" onClick={() => set({ wakeups: d.wakeups + 1 })}><Icon name="plus" size={14} /></button>
          </div>
        </div>
      </div>
      <p className="muted sm mt12">Como foi o sono?</p>
      <div className="q-row" role="radiogroup" aria-label="Qualidade do sono">
        {Q.map((l, i) => (
          <button key={l} role="radio" aria-checked={d.q === i + 1} className={d.q === i + 1 ? 'on' : ''} onClick={() => set({ q: i + 1 })}>{l}</button>
        ))}
      </div>
      <button className="btn-secondary block mt12" disabled={saved || !d.q} onClick={() => { onSave(d); setSaved(true); }}>
        {saved ? <><Icon name="check" size={16} /> Sono registrado</> : value ? 'Atualizar sono' : 'Registrar sono'}
      </button>
    </section>
  );
}

function Water({ water, setWater, readOnly, goal }) {
  const cups = Math.ceil(goal / 250);
  return (
    <section className="card">
      <div className="row-between">
        <div className="row gap12">
          <span className="ico-tile tile-water"><Icon name="drop" size={18} /></span>
          <div>
            <p className="row-title">Água hoje</p>
            <p className="muted sm"><strong className="ink">{fmtL(water)}</strong> de {fmtL(goal)}</p>
          </div>
        </div>
        {!readOnly && <div className="row gap6">
          <button className="icon-btn bordered" aria-label="Tirar um copo" disabled={!water} onClick={() => setWater(Math.max(0, water - 250))}><Icon name="minus" size={16} /></button>
          <button className="btn-sm water-btn" onClick={() => setWater(water + 250)}><Icon name="plus" size={14} /> Copo</button>
        </div>}
      </div>
      <div className="cups" aria-hidden="true">
        {Array.from({ length: cups }, (_, i) => <span key={i} className={`cup ${i < water / 250 ? 'full' : ''}`} />)}
      </div>
      {water >= goal ? <p className="saved-note"><Icon name="check" size={16} /> Meta de hoje alcançada</p> : <p className="xs muted mt8">Meta definida pela sua psicóloga · copos de 250 ml</p>}
    </section>
  );
}

/* ---------- HUMOR & EMOÇÕES ---------- */
const INFLUENCES = ['Trabalho', 'Sono', 'Família', 'Relacionamento', 'Saúde', 'Exercício', 'Dinheiro', 'Amizades'];
const WEEK = [['Ter', 4], ['Qua', 4], ['Qui', 3], ['Sex', 2], ['Sáb', 3], ['Dom', 2], ['Hoje', 3]];

function Chips({ items, value, onToggle, tone }) {
  return (
    <div className="chips">
      {items.map((f) => (
        <button key={f} className={`chip-sel ${tone || ''} ${value.includes(f) ? 'on' : ''}`} aria-pressed={value.includes(f)} onClick={() => onToggle(f)}>
          {value.includes(f) && <Icon name="check" size={14} stroke={2.4} />}{f}
        </button>
      ))}
    </div>
  );
}

function Humor({ perms, mood, setMood, setEmotions }) {
  const [feel, setFeel] = useState([]);
  const [inf, setInf] = useState([]);
  const [intensity, setIntensity] = useState(3);
  const [saved, setSaved] = useState(false);
  const tog = (arr, set) => (v) => { setSaved(false); set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]); };
  const canSave = (perms.humor && mood) || feel.length > 0;
  const save = () => {
    setEmotions((e) => { const n = { ...e }; feel.forEach((f) => { n[f] = (n[f] || 0) + 1; }); return n; });
    setSaved(true);
  };
  return (
    <>
      <Header title={perms.humor ? 'Humor e emoções' : 'Emoções'} sub="Registre quantas vezes quiser ao longo do dia" />
      {perms.humor && (
        <section className="card">
          <p className="eyebrow">Agora, 09:41</p>
          <MoodPicker value={mood} onChange={(v) => { setSaved(false); setMood(v); }} />
        </section>
      )}
      {perms.emocoes && (
        <section className="card">
          <h2 className="h3">O que você está sentindo?</h2>
          <p className="muted sm">Pode escolher mais de uma.</p>
          <p className="emo-group">Agradáveis</p>
          <Chips items={EMOTIONS.pos} value={feel} onToggle={tog(feel, setFeel)} tone="pos" />
          <p className="emo-group">Difíceis</p>
          <Chips items={EMOTIONS.neg} value={feel} onToggle={tog(feel, setFeel)} tone="neg" />
          {feel.length > 0 && (
            <div className="mt16">
              <label className="h3" htmlFor="intensity">Intensidade</label>
              <div className="range-row">
                <span className="xs muted">Leve</span>
                <input id="intensity" type="range" min="1" max="5" value={intensity} onChange={(e) => setIntensity(+e.target.value)} />
                <span className="xs muted">Forte</span>
              </div>
            </div>
          )}
          <h2 className="h3 mt16">O que influenciou?</h2>
          <Chips items={INFLUENCES} value={inf} onToggle={tog(inf, setInf)} />
        </section>
      )}
      <button className="btn-primary block" disabled={!canSave} onClick={save}>
        {saved ? <><Icon name="check" size={18} /> Registro salvo</> : 'Salvar registro'}
      </button>
      <p className="hint center"><Icon name="eye" size={14} /> Sua psicóloga verá este registro</p>

      {perms.humor && (
        <section className="card">
          <div className="row-between">
            <h2 className="h3">Últimos 7 dias</h2>
            <span className="muted sm">Média <strong className="ink">3,1</strong></span>
          </div>
          <div className="bars">
            {WEEK.map(([d, v]) => (
              <div key={d} className="bar-col">
                <MoodFace v={v} size={22} />
                <div className="bar-track"><span className={`bar-fill m${v}`} style={{ height: `${v * 20}%` }} /></div>
                <span className={`sm ${d === 'Hoje' ? 'ink strong' : 'muted'}`}>{d}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------- ROTINA ---------- */
const DAYS = ['T', 'Q', 'Q', 'S', 'S', 'D', 'Hoje'];

function Rotina(props) {
  const { perms } = props;
  const opts = [
    ...(perms.habitos || perms.agua ? [['habitos', 'Hábitos']] : []),
    ...(perms.remedios || perms.receitas ? [['remedios', 'Remédios']] : []),
  ];
  const [sub, setSub] = useState(opts[0][0]);
  const cur = opts.some((o) => o[0] === sub) ? sub : opts[0][0];
  return (
    <>
      <Header title="Rotina" />
      {opts.length > 1 && <Segmented options={opts} value={cur} onChange={setSub} />}
      {cur === 'habitos' ? <Habitos {...props} /> : <Remedios {...props} />}
    </>
  );
}

function Habitos({ perms, water, setWater, waterGoal, habits: h, setHabits: setH }) {
  return (
    <>
      {perms.agua && <Water water={water} setWater={setWater} goal={waterGoal} />}
      {perms.habitos && h.length === 0 && <p className="hint">Sua psicóloga ainda não definiu hábitos.</p>}
      {perms.habitos && h.map((x, i) => (
        <section key={x.id} className="card habit">
          <div className="row gap12">
            <span className="ico-tile tile-habit"><Icon name={x.icon} size={18} /></span>
            <div className="grow">
              <p className="row-title">{x.name}</p>
              <p className="muted sm">{habitSub(x, false)}</p>
            </div>
            {x.reminder && <span className="chip chip-quiet"><Icon name="bell" size={12} /> {x.reminder}</span>}
          </div>
          <div className="week">
            {DAYS.map((d, j) => {
              const isToday = j === 6;
              return (
                <button
                  key={j} className={`day ${x.week[j] ? 'done' : ''} ${isToday ? 'today' : ''}`}
                  disabled={!isToday} aria-label={isToday ? `Marcar ${x.name} hoje` : undefined} aria-pressed={isToday ? !!x.week[j] : undefined}
                  onClick={() => setH(h.map((y, k) => (k === i ? { ...y, week: y.week.map((w, n) => (n === 6 ? 1 - w : w)) } : y)))}
                >
                  <span className="day-dot">{x.week[j] ? <Icon name="check" size={13} stroke={2.6} /> : null}</span>
                  <span className="day-l">{d}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function Remedios({ perms, meds, taken, setTaken, rx, setRx }) {
  return (
    <>
      {perms.remedios && (
        <>
          <p className="section-label">Hoje</p>
          {meds.length === 0 && <p className="hint">Nenhum remédio cadastrado pela sua psicóloga.</p>}
          <ol className="timeline">
            {[...meds].sort((a, b) => a.time.localeCompare(b.time)).map((m) => (
              <li key={m.id} className={taken[m.id] ? 'past' : ''}>
                <span className="tl-time">{m.time}</span>
                <span className="tl-dot" />
                <div className="card tl-card">
                  <div className="grow">
                    <p className="row-title">{m.name}</p>
                    <p className="muted sm">{m.instr}</p>
                  </div>
                  {taken[m.id] ? (
                    <button className="chip chip-ok" onClick={() => { const n = { ...taken }; delete n[m.id]; setTaken(n); }} aria-label={`Desmarcar ${m.name}`}>
                      <Icon name="check" size={13} stroke={2.4} /> {taken[m.id]}
                    </button>
                  ) : (
                    <button className="btn-sm" onClick={() => setTaken({ ...taken, [m.id]: '09:41' })}>Tomei</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="hint">Lista cadastrada pela sua psicóloga a partir das suas receitas. Mudanças de dose são combinadas com o médico que prescreveu.</p>
        </>
      )}
      {perms.receitas && <Receitas meds={meds} rx={rx} setRx={setRx} />}
    </>
  );
}

function Receitas({ meds, rx, setRx }) {
  const [med, setMed] = useState(meds[0]?.name ?? 'Outro');
  const send = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    if (!/^image\/|application\/pdf/.test(f.type)) { toast('Envie uma foto ou um PDF da receita', 'warn'); return; }
    setRx([{ id: Date.now(), med, date: 'Hoje', file: f.name, url: URL.createObjectURL(f), status: 'Nova' }, ...rx]);
    toast('Receita enviada à sua psicóloga');
  };
  return (
    <section className="card">
      <div className="row gap12">
        <span className="ico-tile tile-doc"><Icon name="file" size={18} /></span>
        <div className="grow">
          <h2 className="h3">Receitas</h2>
          <p className="muted sm">Envie a foto ou o PDF. Sua psicóloga guarda e cadastra os horários.</p>
        </div>
      </div>
      <div className="rx-send">
        <label className="sr-only" htmlFor="rx-med">Remédio da receita</label>
        <select id="rx-med" value={med} onChange={(e) => setMed(e.target.value)}>
          {meds.map((m) => <option key={m.id}>{m.name}</option>)}
          <option>Remédio novo</option>
        </select>
        <label className="btn-primary file-btn">
          <Icon name="upload" size={16} /> Enviar receita
          <input type="file" accept="image/*,application/pdf" onChange={send} />
        </label>
      </div>
      <ul className="list">
        {rx.map((r) => (
          <li key={r.id} className="list-row">
            <div className="grow">
              <p className="row-title">{r.med}</p>
              <p className="muted sm">{r.file} · enviada {r.date === 'Hoje' ? 'hoje' : `em ${r.date}`}</p>
            </div>
            <span className={`chip ${r.status === 'Nova' ? 'chip-quiet' : 'chip-ok'}`}>{r.status === 'Nova' ? 'Enviada' : 'Recebida'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- DIÁRIO ---------- */
const INITIAL_ENTRIES = [
  { id: 3, d: 'Dom, 15/11 · 04:20', shared: true, t: 'Acordei às 4h de novo', b: 'Fiquei repassando a conversa de sexta. Fiz a respiração e consegui voltar a dormir lá pelas 5h.', mood: 2 },
  { id: 2, d: 'Sáb, 14/11 · 21:10', shared: false, t: 'Almoço com a família', b: 'Foi leve. Ri bastante com meu irmão e quase não pensei no trabalho.', mood: 4 },
  { id: 1, d: 'Sex, 13/11 · 19:45', shared: true, t: 'Reunião com o gestor', b: 'Saí da reunião com o coração acelerado. Quero levar isso para a sessão.', mood: 2, agenda: true },
];
const INITIAL_TOPICS = [
  { t: 'Conversa difícil com meu gestor na sexta', d: '13/11', prio: true, from: 'veio do diário' },
  { t: 'Voltei a acordar de madrugada', d: '15/11' },
  { t: 'Quero falar sobre a viagem de dezembro', d: 'Hoje' },
];
const PROMPT = 'O que te trouxe um pouco de calma hoje?';

function DiarioTab({ perms, sub, setSub }) {
  const opts = [...(perms.diario ? [['diario', 'Diário']] : []), ...(perms.pauta ? [['pauta', 'Assuntos da sessão']] : [])];
  const cur = opts.some((o) => o[0] === sub) ? sub : opts[0][0];
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [topics, setTopics] = useState(INITIAL_TOPICS);
  const [writing, setWriting] = useState(null); // { t } prefill
  const save = (e) => {
    setEntries([{ ...e, id: Date.now(), d: 'Hoje · 09:41' }, ...entries]);
    if (e.agenda) setTopics([...topics, { t: e.t, d: 'Hoje', from: 'veio do diário' }]);
    toast(e.agenda ? 'Salvo no diário e adicionado aos assuntos' : 'Salvo no diário');
    setWriting(null);
  };
  return (
    <>
      <Header title="Diário" right={cur === 'diario' && <button className="fab-sm" aria-label="Nova entrada" onClick={() => setWriting({ t: '' })}><Icon name="plus" size={20} /></button>} />
      {opts.length > 1 && <Segmented options={opts} value={cur} onChange={setSub} />}
      {cur === 'diario' ? <Diario entries={entries} onWrite={setWriting} /> : <Pauta topics={topics} setTopics={setTopics} />}
      {writing && <EntryModal prefill={writing} canAgenda={perms.pauta} onClose={() => setWriting(null)} onSave={save} />}
    </>
  );
}

function EntryModal({ prefill, canAgenda, onClose, onSave }) {
  const [e, setE] = useState({ t: prefill.t, b: '', mood: 3, shared: true, agenda: false });
  const ok = e.t.trim() && e.b.trim();
  return (
    <Modal sheet title="Nova entrada" sub={prefill.q} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!ok} onClick={() => onSave({ ...e, t: e.t.trim(), b: e.b.trim() })}>Salvar</button></>}>
      <label className="field">Título<input value={e.t} onChange={(x) => setE({ ...e, t: x.target.value })} placeholder="Ex.: Caminhada no fim da tarde" /></label>
      <label className="field">O que aconteceu<textarea rows={5} value={e.b} onChange={(x) => setE({ ...e, b: x.target.value })} placeholder="Escreva do seu jeito…" /></label>
      <div><p className="field-label">Como você estava</p><MoodPicker value={e.mood} onChange={(v) => setE({ ...e, mood: v })} size={36} /></div>
      <label className="check-row"><span><Icon name="eye" size={14} /> Compartilhar com a psicóloga</span><Toggle label="Compartilhar com a psicóloga" on={e.shared} onChange={(v) => setE({ ...e, shared: v })} /></label>
      {canAgenda && <label className="check-row"><span><Icon name="flag" size={14} /> Levar para a próxima sessão</span><Toggle label="Levar para a próxima sessão" on={e.agenda} onChange={(v) => setE({ ...e, agenda: v })} /></label>}
    </Modal>
  );
}

function Diario({ entries, onWrite }) {
  const [f, setF] = useState('todos');
  const list = entries.filter((e) => f === 'todos' || (f === 'comp' ? e.shared : !e.shared));
  return (
    <>
      <section className="card prompt-card">
        <p className="eyebrow">Pergunta do dia</p>
        <p className="prompt-q">{PROMPT}</p>
        <button className="btn-secondary" onClick={() => onWrite({ t: '', q: PROMPT })}><Icon name="pen" size={16} /> Escrever sobre isso</button>
      </section>
      <Segmented small options={[['todos', 'Todos'], ['comp', 'Compartilhados'], ['eu', 'Só eu']]} value={f} onChange={setF} />
      {list.map((e) => (
        <article key={e.id} className="card entry">
          <div className="row-between">
            <span className="muted sm row gap6"><MoodFace v={e.mood} size={18} /> {e.d}</span>
            <span className={`chip ${e.shared ? 'chip-accent' : 'chip-quiet'}`}>
              <Icon name={e.shared ? 'eye' : 'lock'} size={12} /> {e.shared ? 'Compartilhado' : 'Só eu'}
            </span>
          </div>
          <h3 className="entry-title">{e.t}</h3>
          <p className="entry-body">{e.b}</p>
          {e.agenda && <p className="entry-foot"><Icon name="flag" size={14} /> Adicionado à pauta</p>}
        </article>
      ))}
      {list.length === 0 && <p className="hint center">Nada aqui ainda.</p>}
      <p className="hint center"><Icon name="shield" size={14} /> Você decide o que compartilhar em cada registro.</p>
    </>
  );
}

/* ---------- ASSUNTOS DA SESSÃO (aba do Diário) ---------- */
function Pauta({ topics, setTopics }) {
  const [draft, setDraft] = useState('');
  const add = (e) => { e.preventDefault(); if (!draft.trim()) return; setTopics([...topics, { t: draft.trim(), d: 'Hoje' }]); setDraft(''); toast('Assunto adicionado'); };
  const toggle = (t) => setTopics(topics.map((x) => (x.t === t ? { ...x, prio: !x.prio } : x)));
  const remove = (t) => setTopics(topics.filter((x) => x.t !== t));
  return (
    <section className="card" id="pauta">
      <h2 className="h3">Pauta da próxima sessão</h2>
      <p className="muted sm">Anote o que você quer conversar para não esquecer.</p>
      <form className="add-row mt12" onSubmit={add}>
        <label className="sr-only" htmlFor="novo">Novo assunto</label>
        <input id="novo" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Novo assunto…" />
        <button className="btn-icon" aria-label="Adicionar assunto"><Icon name="plus" size={18} /></button>
      </form>
      <ul className="list topics">
        {topics.map((x) => (
          <li key={x.t} className="list-row">
            <button className={`topic-mark ${x.prio ? 'prio' : ''}`} aria-pressed={!!x.prio} aria-label={x.prio ? 'Tirar prioridade' : 'Marcar como prioridade'} onClick={() => toggle(x.t)}><Icon name="flag" size={14} /></button>
            <div className="grow">
              <p className="row-title">{x.t}</p>
              <p className="muted sm">{x.prio && <strong className="prio-txt">Prioridade · </strong>}{x.d}{x.from && ` · ${x.from}`}</p>
            </div>
            <button className="icon-btn" aria-label={`Remover ${x.t}`} onClick={() => remove(x.t)}><Icon name="x" size={16} /></button>
          </li>
        ))}
      </ul>
      <p className="hint mt8"><Icon name="eye" size={14} /> Sua psicóloga vê a pauta antes da sessão. Toque na bandeira para marcar prioridade.</p>
    </section>
  );
}

/* ---------- DOCUMENTOS ---------- */
const DOC_KINDS = ['Declaração de comparecimento', 'Atestado psicológico', 'Recibo das sessões', 'Relatório psicológico'];

function Documentos({ store }) {
  const { notas, setNotas, docs, panelPrefs, requests, setRequests, patientPrefs } = store;
  const mine = notas.filter((r) => r.pid === ME);
  const myDocs = docs.filter((d) => d.pid === ME && d.status === 'Assinado');
  const [f, setF] = useState('nf');
  const [view, setView] = useState(null);
  const [asking, setAsking] = useState(null);
  const notaText = (r) => `NFS-e ${r.n}\nTomador: ${patientPrefs.account.name}\nCompetência: ${r.comp}\nServiço: psicoterapia (${r.sessions} sessões)\nValor: ${brl(r.value)}`;
  const request = () => {
    setRequests([...requests, { id: Date.now(), name: patientPrefs.account.name, kind: asking.kind, why: asking.why }]);
    toast('Pedido enviado à sua psicóloga');
    setAsking(null);
  };
  return (
    <>
      <Header title="Documentos" sub="Tudo o que sua psicóloga emitiu para você" />
      <Segmented options={[['nf', 'Notas fiscais'], ['outros', 'Declarações']]} value={f} onChange={setF} />
      {f === 'nf' ? (
        <>
          <section className="card nf-summary">
            <div><p className="muted sm">Total em 2026</p><p className="stat-num">{brl(mine.reduce((t, r) => t + r.value, 0))}</p></div>
            <button className="btn-secondary sm-btn" disabled={!mine.length} onClick={() => downloadText('notas-fiscais-2026.txt', mine.map(notaText).join('\n\n---\n\n'))}><Icon name="download" size={14} /> Baixar todas</button>
          </section>
          {mine.length === 0 && <p className="hint">Nenhuma nota enviada ainda.</p>}
          <ul className="card list">
            {mine.map((r) => (
              <li key={r.id} className="nf-row">
                <span className="ico-tile tile-nf"><Icon name="file" size={18} /></span>
                <div className="nf-main">
                  <div className="row-between"><p className="row-title">{r.comp}</p><p className="row-title tnum-r">{brl(r.value)}</p></div>
                  <p className="muted sm">Nota {r.n} · {r.sessions} sessões · enviada {r.sent}</p>
                  <div className="nf-actions">
                    {r.url
                      ? <a className="btn-ghost-sm" href={r.url} target="_blank" rel="noreferrer"><Icon name="download" size={14} /> Abrir</a>
                      : <button className="btn-ghost-sm" onClick={() => downloadText(`nota-${r.n}.txt`, notaText(r))}><Icon name="download" size={14} /> Baixar</button>}
                    {r.ack
                      ? <span className="chip chip-ok"><Icon name="check" size={12} stroke={2.4} /> Ciente em {r.ack}</span>
                      : <button className="btn-sm" onClick={() => { setNotas((all) => all.map((x) => (x.id === r.id ? { ...x, ack: '16/11/2026' } : x))); toast('Ciência registrada'); }}>Dar ciência</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint"><Icon name="shield" size={14} /> Notas enviadas pela sua psicóloga, no seu CPF. Use para declarar despesas médicas no Imposto de Renda.</p>
        </>
      ) : (
        <>
          {myDocs.length === 0 && <p className="hint">Nenhum documento ainda.</p>}
          <ul className="card list">
            {myDocs.map((d) => (
              <li key={d.id} className="list-row">
                <span className="ico-tile tile-doc"><Icon name="file" size={18} /></span>
                <button className="grow text-btn" onClick={() => setView(d)}>
                  <p className="row-title">{d.title}</p>
                  <p className="muted sm">{d.date} · <span className="ok-txt">Assinado</span></p>
                </button>
                <button className="icon-btn" aria-label={`Ver ${d.title}`} onClick={() => setView(d)}><Icon name="eye" size={18} /></button>
              </li>
            ))}
          </ul>
          <section className="callout info">
            <Icon name="shield" size={20} />
            <div>
              <p className="row-title">Autenticidade garantida</p>
              <p className="sm">Cada documento traz um código de verificação, como <code>{myDocs[0]?.code ?? 'KW-8F2K-41QA'}</code>, que pode ser conferido por quem receber.</p>
            </div>
          </section>
        </>
      )}
      <button className="btn-secondary block" onClick={() => setAsking({ kind: DOC_KINDS[0], why: '' })}>Solicitar documento</button>

      {view && (
        <Modal sheet title={view.title} sub={`Assinado em ${view.date}`} onClose={() => setView(null)}
          footer={<button className="btn-primary" onClick={() => downloadText(`${view.title}.txt`, `${view.title.toUpperCase()}\n\n${view.body}\n\n${panelPrefs.account.name} · ${panelPrefs.account.crp}\nCódigo: ${view.code}`)}><Icon name="download" size={16} /> Baixar</button>}>
          <div className="paper-scale"><DocPaper title={view.title} body={view.body} account={panelPrefs.account} code={view.code} date={view.date} /></div>
        </Modal>
      )}
      {asking && (
        <Modal sheet title="Solicitar documento" sub="Sua psicóloga recebe o pedido e avisa quando o documento estiver aqui." onClose={() => setAsking(null)}
          footer={<><button className="btn-secondary" onClick={() => setAsking(null)}>Cancelar</button><button className="btn-primary" onClick={request}>Enviar pedido</button></>}>
          <label className="field">Documento<select className="select" value={asking.kind} onChange={(e) => setAsking({ ...asking, kind: e.target.value })}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Para que você precisa (opcional)<textarea rows={3} value={asking.why} onChange={(e) => setAsking({ ...asking, why: e.target.value })} placeholder="Ex.: apresentar no trabalho" /></label>
        </Modal>
      )}
    </>
  );
}
