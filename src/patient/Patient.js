import { useEffect, useRef, useState } from 'react';
import { Icon, MoodPicker, MoodFace, Avatar, Segmented, Toggle, MOODS, Modal, toast, downloadText, useEvery, LineChart } from '../ui';
import { DocPaper, downloadDoc, fromServerDoc } from '../panel/Docs';
import { api } from '../api';
import { dayKey, offsetKey, emptyLog, lastDays, dailyMood, stats, num, fmtH, fmtDay, sleepMin } from '../records';
import { EMOTIONS, fmtL, habitSub, brl, ME } from '../data';
import Settings from './Settings';

const nowHHMM = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// [key, label, icon, visible(perms)]. The bottom bar puts the FAB in the middle of these four.
const TABS = [
  ['hoje', 'Hoje', 'home', () => true],
  ['humor', 'Humor', 'smile', (p) => p.humor || p.emocoes],
  ['rotina', 'Rotina', 'checks', (p) => p.habitos || p.agua || p.remedios || p.receitas],
  ['diario', 'Diário', 'book', (p) => p.diario || p.pauta],
];
// FAB menu: [label, icon, tab, sub, visible(perms)]
const FAB_ITEMS = [
  ['Meus registros', 'chart', 'registros', null, () => true],
  ['Documentos', 'file', 'docs', null, () => true],
  ['Remédios', 'pill', 'rotina', 'remedios', (p) => p.remedios || p.receitas],
  ['Assuntos da sessão', 'flag', 'diario', 'pauta', (p) => p.pauta],
  ['Configurações', 'gear', 'config', null, () => true],
];
const EXTRA = ['registros', 'docs', 'config']; // screens reached from the FAB, not from a tab

export default function Patient({ store }) {
  const { perms, patientPrefs: prefs, setPatientPrefs } = store;
  const [tab, setTab] = useState('hoje');
  const [dir, setDir] = useState(0); // -1 came from the right, 1 from the left: drives the slide-in
  const [diarioSub, setDiarioSub] = useState('diario');
  const [rotinaSub, setRotinaSub] = useState('habitos');
  const [fab, setFab] = useState(false);
  const [, setTick] = useState(0);
  // Each minute: re-render (dates stay current) and, with a real login, fetch documents and the plan
  // (habits, medicines, permissions the psychologist may have changed).
  const { demo, setDocs } = store;
  const loadDocs = () => {
    if (demo) return;
    api.documents.list('paciente').then(({ documents }) => setDocs((all) => [...documents.map((d) => fromServerDoc(d)), ...all.filter((x) => !x.server)]), () => {});
  };
  useEffect(loadDocs, []); // eslint-disable-line react-hooks/exhaustive-deps
  // shortcut: a reload landing inside the 600 ms save debounce can briefly show the previous value; fine at 1/min.
  useEvery(60_000, () => { setTick((t) => t + 1); loadDocs(); store.reloadMine(); });
  const touch = useRef(null);
  const tabs = TABS.filter((t) => t[3](perms));
  const cur = EXTRA.includes(tab) || tabs.some((t) => t[0] === tab) ? tab : 'hoje'; // tab may be turned off by the psychologist
  const idx = tabs.findIndex((t) => t[0] === cur);
  const go = (t, sub) => {
    setDir(idx < 0 ? 0 : Math.sign(tabs.findIndex((x) => x[0] === t) - idx));
    setTab(t);
    setFab(false);
    if (sub && t === 'diario') setDiarioSub(sub);
    if (sub && t === 'rotina') setRotinaSub(sub);
    document.querySelector('.phone-scroll')?.scrollTo(0, 0);
  };
  const ctx = { ...store, go };
  const half = Math.ceil(tabs.length / 2);
  const tabBtn = ([k, l, i]) => (
    <button key={k} className={cur === k ? 'on' : ''} aria-current={cur === k ? 'page' : undefined} onClick={() => go(k)}>
      <span className="tab-ico"><Icon name={i} size={22} /></span>
      <span>{l}</span>
    </button>
  );

  // Swipe left/right on the content to move between bottom tabs. Ignored on form controls and horizontal scrollers.
  const onTouchStart = (e) => {
    touch.current = !prefs.swipe || e.target.closest('input, select, textarea, .no-swipe') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current || idx < 0) return;
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
          {cur === 'rotina' && <Rotina {...ctx} sub={rotinaSub} setSub={setRotinaSub} />}
          {cur === 'diario' && <DiarioTab store={store} perms={perms} sub={diarioSub} setSub={setDiarioSub} />}
          {cur === 'docs' && <Documentos store={store} />}
          {cur === 'registros' && <MeusRegistros store={store} />}
          {cur === 'config' && <Settings prefs={prefs} setPrefs={setPatientPrefs} onBack={() => go('hoje')} onLogout={() => store.logout('paciente')} />}
        </div>
      </main>
      {fab && <button className="fab-scrim" aria-label="Fechar menu" onClick={() => setFab(false)} />}
      {fab && (
        <ul className="fab-menu" aria-label="Mais opções">
          {FAB_ITEMS.filter((f) => f[4](perms)).map(([l, i, t, sub], n) => (
            <li key={l} style={{ '--i': n }}>
              <button onClick={() => go(t, sub)}><span>{l}</span><span className="fab-item-ico"><Icon name={i} size={20} /></span></button>
            </li>
          ))}
        </ul>
      )}
      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${half}, 1fr) 72px repeat(${tabs.length - half}, 1fr)` }} aria-label="Navegação principal">
        {tabs.slice(0, half).map(tabBtn)}
        <div className="fab-slot">
          <button className={`fab ${fab ? 'open' : ''} ${EXTRA.includes(cur) ? 'on' : ''}`} aria-label={fab ? 'Fechar menu' : 'Mais: documentos, remédios e configurações'} aria-expanded={fab} onClick={() => setFab(!fab)}>
            <Icon name="plus" size={26} stroke={2.2} />
          </button>
        </div>
        {tabs.slice(half).map(tabBtn)}
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
// shortcut: demo session; swap for the real next session once the agenda lives in Supabase.
const NEXT_SESSION = { title: 'Sessão com Débora Mendonça', start: new Date('2026-11-19T18:00:00-03:00'), min: 50, where: 'Online · KiWave' };
const calStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20261119T210000Z
const sessionEnd = (s) => new Date(s.start.getTime() + s.min * 60000);
// .ics opens in Apple Calendar (and Outlook); Google gets a prefilled "new event" link. No account access needed.
const icsFor = (s) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KiWave//PT-BR', 'BEGIN:VEVENT', `UID:${calStamp(s.start)}@kiwave`, `DTSTAMP:${calStamp(new Date())}`,
  `DTSTART:${calStamp(s.start)}`, `DTEND:${calStamp(sessionEnd(s))}`, `SUMMARY:${s.title}`, `LOCATION:${s.where}`,
  'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${s.title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const googleCalUrl = (s) => `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: s.title, dates: `${calStamp(s.start)}/${calStamp(sessionEnd(s))}`, location: s.where })}`;
const DAY_EMOTIONS = ['Tristeza', 'Irritabilidade', 'Medo', 'Ansiedade', 'Vergonha'];
const dayLabel = (off) => {
  const d = new Date();
  d.setDate(d.getDate() + off);
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '');
  return s[0].toUpperCase() + s.slice(1);
};
const PAST_WATER = [1500, 2000, 1250, 1750, 1000, 2000]; // index = -off - 1

function Hoje({ demo, patientPrefs, perms, mood, setMood, go, meds, taken, setTaken, water, setWater, waterGoal, sleep, setSleep, habits, setHabits, dayEmotion, setDayEmotion, log }) {
  const pickEmotion = (f) => { setDayEmotion(f); toast('Emoção do dia registrada'); }; // locked once picked
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
  const pastMoods = log ? log.mood.filter((m) => dayKey(new Date(m.at)) === offsetKey(off)).map((m) => m.v) : [];
  const dayMood = past ? (demo ? WEEK[6 + off][1] : pastMoods.length ? Math.round(pastMoods.reduce((a, b) => a + b, 0) / pastMoods.length) : null) : mood;
  const dayWater = past ? (demo ? PAST_WATER[-off - 1] : log?.water[offsetKey(off)] ?? 0) : water;
  const toggle = (it) => (it.med
    ? setTaken((t) => { const n = { ...t }; if (n[it.id]) delete n[it.id]; else n[it.id] = nowHHMM(); return n; })
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

      {past && <p className="readonly-note"><Icon name="lock" size={14} /> Dias anteriores são só para consulta. Se esqueceu, ainda dá para registrar o sono.</p>}

      {perms.humor && (past ? (!dayMood ? <p className="hint">Sem registro de humor neste dia.</p> : 
        <section className="card row gap12">
          <MoodFace v={dayMood} size={40} />
          <div><p className="muted sm">Humor registrado</p><p className="row-title">{MOODS_LABEL[dayMood - 1]}</p></div>
        </section>
      ) : (
        mood ? (
          <section className="card row gap12">
            <MoodFace v={mood} size={40} />
            <div className="grow"><p className="muted sm row gap4"><Icon name="lock" size={12} /> Humor de hoje registrado</p><p className="row-title">{MOODS_LABEL[mood - 1]}</p></div>
            {perms.emocoes && <button className="link" onClick={() => go('humor')}>Emoções</button>}
          </section>
        ) : <MoodCard setMood={setMood} />
      ))}

      {items.length > 0 && (
        <section className="card f-routine">
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
                <button className={`check ${it.done ? 'on' : ''}`} disabled={past || it.done} aria-label={`Marcar ${it.t}`} aria-pressed={it.done} onClick={() => toggle(it)}>
                  <Icon name="check" size={16} stroke={2.4} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {perms.sono && <Sleep key={off} off={off} value={sleep[off]} onSave={(v) => setSleep({ ...sleep, [off]: v })} />}

      {perms.agua && <Water water={dayWater} setWater={setWater} readOnly={past} goal={waterGoal} cup={patientPrefs.cupMl ?? 250} />}

      {perms.emocoes && !past && (
        <section className="card f-emotion">
          <h2 className="h3">Qual a emoção do dia?</h2>
          <p className="muted sm">Escolha a que mais marcou o seu dia.</p>
          <div className="chips mt12" role="radiogroup" aria-label="Emoção do dia">
            {DAY_EMOTIONS.map((f) => (
              <button key={f} role="radio" aria-checked={dayEmotion === f} disabled={!!dayEmotion && dayEmotion !== f} className={`chip-sel neg ${dayEmotion === f ? 'on' : ''}`} onClick={() => !dayEmotion && pickEmotion(f)}>
                {dayEmotion === f && <Icon name="check" size={14} stroke={2.4} />}{f}
              </button>
            ))}
          </div>
          {dayEmotion && <p className="saved-note"><Icon name="lock" size={14} /> Registrada. Amanhã você escolhe de novo.</p>}
        </section>
      )}

      {/* shortcut: only demo has a scheduled session; real sessions come once the agenda is stored in Supabase */}
      {!past && !demo && (
        <section className="card row gap12">
          <span className="ico-tile tile-doc"><Icon name="calendar" size={18} /></span>
          <div><p className="row-title">Nenhuma sessão agendada</p><p className="muted sm">Quando sua psicóloga marcar, ela aparece aqui.</p></div>
        </section>
      )}
      {!past && demo && <section className="card session-card">
        <div className="row-between">
          <span className="eyebrow on-dark">Próxima sessão</span>
          <span className="chip chip-glass"><Icon name="video" size={14} /> Online</span>
        </div>
        <p className="session-when">Quinta, 19/11 · 18:00</p>
        <p className="on-dark-muted">com Débora Mendonça · 50 min · link libera 10 min antes</p>
        <div className="cal-add">
          <span className="on-dark-muted xs">Adicionar ao calendário</span>
          <div className="row gap8">
            <button className="chip chip-glass" onClick={() => downloadText('sessao-kiwave.ics', icsFor(NEXT_SESSION), 'text/calendar')}><Icon name="calendar" size={14} /> Apple</button>
            <a className="chip chip-glass" href={googleCalUrl(NEXT_SESSION)} target="_blank" rel="noreferrer"><Icon name="calendar" size={14} /> Google</a>
          </div>
        </div>
        {perms.pauta && (
          <button className="session-agenda" onClick={() => go('diario', 'pauta')}>
            <span><strong>Assuntos</strong> para a próxima sessão</span>
            <span className="row gap4">Ver <Icon name="chevR" size={16} /></span>
          </button>
        )}
      </section>}
    </>
  );
}

// Mood is picked, then confirmed: once registered it stays for the day.
function MoodCard({ setMood }) {
  const [pick, setPick] = useState(null);
  return (
    <section className="card card-soft f-mood">
      <div className="row-between">
        <h2 className="h3">Como você está agora?</h2>
        <span className="pill-mini">5 seg</span>
      </div>
      <MoodPicker value={pick} onChange={setPick} />
      {pick && <button className="btn-primary block mt12" onClick={() => { setMood(pick); toast('Humor registrado'); }}>Registrar humor</button>}
    </section>
  );
}

function Sleep({ off, value, onSave }) {
  const [d, setD] = useState(value ?? { bed: '23:30', wake: '07:00', q: 0, wakeups: 0 });
  const locked = !!value; // a registered night cannot be changed
  const set = (patch) => { if (!locked) setD({ ...d, ...patch }); };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const dur = (toMin(d.wake) - toMin(d.bed) + 1440) % 1440;
  const Q = ['Péssimo', 'Ruim', 'Ok', 'Bom', 'Ótimo'];
  return (
    <section className="card f-sleep">
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
        <label>Deitou<input type="time" disabled={locked} value={d.bed} onChange={(e) => set({ bed: e.target.value })} /></label>
        <label>Acordou<input type="time" disabled={locked} value={d.wake} onChange={(e) => set({ wake: e.target.value })} /></label>
        <div className="stepper">
          <span>Despertares</span>
          <div className="row">
            <button aria-label="Menos despertares" disabled={locked || !d.wakeups} onClick={() => set({ wakeups: d.wakeups - 1 })}><Icon name="minus" size={14} /></button>
            <b aria-live="polite">{d.wakeups}</b>
            <button aria-label="Mais despertares" disabled={locked} onClick={() => set({ wakeups: d.wakeups + 1 })}><Icon name="plus" size={14} /></button>
          </div>
        </div>
      </div>
      <p className="muted sm mt12">Como foi o sono?</p>
      <div className="q-row" role="radiogroup" aria-label="Qualidade do sono">
        {Q.map((l, i) => (
          <button key={l} role="radio" disabled={locked && d.q !== i + 1} aria-checked={d.q === i + 1} className={d.q === i + 1 ? 'on' : ''} onClick={() => set({ q: i + 1 })}>{l}</button>
        ))}
      </div>
      {locked
        ? <p className="saved-note"><Icon name="lock" size={14} /> Sono registrado</p>
        : <button className="btn-primary block mt12" disabled={!d.q} onClick={() => { onSave(d); toast('Sono registrado'); }}>Registrar sono</button>}
    </section>
  );
}

function Water({ water, setWater, readOnly, goal, cup = 250 }) {
  const cups = Math.ceil(goal / cup);
  return (
    <section className="card f-water">
      <div className="row-between">
        <div className="row gap12">
          <span className="ico-tile tile-water"><Icon name="drop" size={18} /></span>
          <div>
            <p className="row-title">Água hoje</p>
            <p className="muted sm"><strong className="ink">{fmtL(water)}</strong> de {fmtL(goal)}</p>
          </div>
        </div>
        {!readOnly && <div className="row gap6">
          <button className="btn-sm water-btn" onClick={() => setWater(water + cup)}><Icon name="plus" size={14} /> Copo de {cup} ml</button>
        </div>}
      </div>
      <div className="cups" aria-hidden="true">
        {Array.from({ length: cups }, (_, i) => <span key={i} className={`cup ${i < water / cup ? 'full' : ''}`} />)}
      </div>
      {water >= goal ? <p className="saved-note"><Icon name="check" size={16} /> Meta de hoje alcançada</p> : <p className="xs muted mt8">Meta definida pela sua psicóloga · mude o tamanho do copo em Configurações</p>}
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

// What is registered today is locked; after saving, the app confirms and goes back to Hoje.
function Humor({ demo, perms, mood, setMood, addEmotions, todayEmotions, go }) {
  const [pick, setPick] = useState(null);
  const [feel, setFeel] = useState([]);
  const [inf, setInf] = useState([]);
  const [intensity, setIntensity] = useState(3);
  const tog = (arr, set) => (v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const emoLocked = todayEmotions.length > 0;
  const canSave = (perms.humor && !mood && pick) || (!emoLocked && feel.length > 0);
  const save = () => {
    if (perms.humor && !mood && pick) setMood(pick);
    if (!emoLocked && feel.length) addEmotions(feel, { intensity, influences: inf });
    toast('Registro salvo');
    go('hoje');
  };
  return (
    <>
      <Header title={perms.humor ? 'Humor e emoções' : 'Emoções'} sub="Um registro por dia. Depois de salvo, ele fica guardado como está." />
      {perms.humor && (
        <section className="card">
          {mood
            ? <div className="row gap12"><MoodFace v={mood} size={40} /><div><p className="muted sm row gap4"><Icon name="lock" size={12} /> Humor de hoje registrado</p><p className="row-title">{MOODS_LABEL[mood - 1]}</p></div></div>
            : <><p className="eyebrow">Agora, {nowHHMM()}</p><MoodPicker value={pick} onChange={setPick} /></>}
        </section>
      )}
      {perms.emocoes && emoLocked && (
        <section className="card">
          <p className="muted sm row gap4"><Icon name="lock" size={12} /> Emoções de hoje registradas</p>
          <div className="chips">{todayEmotions.map((f) => <span key={f} className={`chip-sel ${EMOTIONS.pos.includes(f) ? 'pos' : 'neg'} on`}>{f}</span>)}</div>
        </section>
      )}
      {perms.emocoes && !emoLocked && (
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
        Salvar registro
      </button>
      <p className="hint center"><Icon name="eye" size={14} /> Sua psicóloga verá este registro</p>

      {perms.humor && demo && (
        <section className="card">
          <div className="row-between">
            <h2 className="h3">Últimos 7 dias</h2>
            <span className="muted sm">Média <strong className="ink">3,1</strong></span>
          </div>
          <div className="bars">
            {WEEK.map(([d, v]) => (
              <div key={d} className="bar-col">
                <MoodFace v={v} size={22} />
                <div className="bar-track"><span className={`bar-fill m${v}`} style={{ height: `${(v / 6) * 100}%` }} /></div>
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
  const { perms, sub, setSub } = props;
  const opts = [
    ...(perms.habitos || perms.agua ? [['habitos', 'Hábitos']] : []),
    ...(perms.remedios || perms.receitas ? [['remedios', 'Remédios']] : []),
  ];
  const cur = opts.some((o) => o[0] === sub) ? sub : opts[0][0];
  return (
    <>
      <Header title="Rotina" />
      {opts.length > 1 && <Segmented options={opts} value={cur} onChange={setSub} />}
      {cur === 'habitos' ? <Habitos {...props} /> : <Remedios {...props} />}
    </>
  );
}

function Habitos({ perms, patientPrefs, water, setWater, waterGoal, habits: h, setHabits: setH }) {
  return (
    <>
      {perms.agua && <Water water={water} setWater={setWater} goal={waterGoal} cup={patientPrefs.cupMl ?? 250} />}
      {perms.habitos && h.length === 0 && <p className="hint">Sua psicóloga ainda não definiu hábitos.</p>}
      {perms.habitos && h.map((x, i) => (
        <section key={x.id} className="card habit f-routine">
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
                  disabled={!isToday || !!x.week[j]} aria-label={isToday ? `Marcar ${x.name} hoje` : undefined} aria-pressed={isToday ? !!x.week[j] : undefined}
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
                    <span className="chip chip-ok" aria-label={`${m.name} tomado às ${taken[m.id]}`}>
                      <Icon name="check" size={13} stroke={2.4} /> {taken[m.id]}
                    </span>
                  ) : (
                    <button className="btn-sm" onClick={() => setTaken({ ...taken, [m.id]: nowHHMM() })}>Tomei</button>
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

// Patient only sends the file; the psychologist fills in the medicines and accepts it in the panel.
function Receitas({ rx, setRx }) {
  const send = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    if (!/^image\/|application\/pdf/.test(f.type)) { toast('Envie uma foto ou um PDF da receita', 'warn'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('Arquivo grande demais: envie uma foto ou PDF de até 2 MB', 'warn'); return; }
    const r = new FileReader();
    r.onload = () => {
      setRx([{ id: Date.now(), med: '', date: new Date().toLocaleDateString('pt-BR'), file: f.name, data: r.result, status: 'Nova' }, ...rx]);
      toast('Receita enviada à sua psicóloga');
    };
    r.onerror = () => toast('Não foi possível ler o arquivo. Tente de novo.', 'warn');
    r.readAsDataURL(f); // saved with the record so the psychologist can open it
  };
  return (
    <section className="card">
      <div className="row gap12">
        <span className="ico-tile tile-doc"><Icon name="file" size={18} /></span>
        <div className="grow">
          <h2 className="h3">Receitas</h2>
          <p className="muted sm">Envie a foto ou o PDF. Sua psicóloga cadastra os remédios e os horários.</p>
        </div>
      </div>
      <div className="rx-send">
        <label className="btn-primary file-btn block">
          <Icon name="upload" size={16} /> Enviar receita
          <input type="file" accept="image/*,application/pdf" onChange={send} />
        </label>
      </div>
      <ul className="list">
        {rx.map((r) => (
          <li key={r.id} className="list-row">
            <div className="grow">
              <p className="row-title">{r.med || r.file}</p>
              <p className="muted sm">{r.med && `${r.file} · `}enviada em {r.date}</p>
            </div>
            <span className={`chip ${r.status === 'Nova' ? 'chip-quiet' : 'chip-ok'}`}>{r.status === 'Nova' ? 'Enviada' : 'Aceita'}</span>
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

// Real login: entries and topics are saved in the patient record (the panel sees shared entries and the topics).
function DiarioTab({ store, perms, sub, setSub }) {
  const opts = [...(perms.diario ? [['diario', 'Diário']] : []), ...(perms.pauta ? [['pauta', 'Assuntos da sessão']] : [])];
  const cur = opts.some((o) => o[0] === sub) ? sub : opts[0][0];
  const [localEntries, setLocalEntries] = useState(store.demo ? INITIAL_ENTRIES : []);
  const [localTopics, setLocalTopics] = useState(store.demo ? INITIAL_TOPICS : []);
  const [entries, setEntries] = store.demo ? [localEntries, setLocalEntries] : [store.diary, store.setDiary];
  const [topics, setTopics] = store.demo ? [localTopics, setLocalTopics] : [store.topics, store.setTopics];
  const [writing, setWriting] = useState(null); // { t } prefill
  const save = (e) => {
    const now = new Date();
    setEntries([{ ...e, id: Date.now(), at: now.toISOString(), d: `${now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${nowHHMM()}` }, ...entries]);
    if (e.agenda) setTopics([...topics, { t: e.t, d: now.toLocaleDateString('pt-BR').slice(0, 5), from: 'veio do diário' }]);
    toast(e.agenda ? 'Salvo no diário e adicionado aos assuntos' : 'Salvo no diário');
    setWriting(null);
  };
  return (
    <>
      <Header title="Diário" right={cur === 'diario' && <button className="btn-icon" aria-label="Nova entrada" onClick={() => setWriting({ t: '' })}><Icon name="plus" size={20} /></button>} />
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
      <div className="filter-chips" role="radiogroup" aria-label="Filtrar entradas">
        {[['todos', 'Todos'], ['comp', 'Compartilhados'], ['eu', 'Só eu']].map(([k, l]) => (
          <button key={k} role="radio" aria-checked={f === k} className={`chip-sel sm ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
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
  const add = (e) => { e.preventDefault(); if (!draft.trim()) return; setTopics([...topics, { t: draft.trim(), d: new Date().toLocaleDateString('pt-BR').slice(0, 5) }]); setDraft(''); toast('Assunto adicionado'); };
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
  const mine = notas.filter((r) => r.pid === store.myId);
  const myDocs = docs.filter((d) => d.pid === (store.demo ? ME : store.myId) && d.status === 'Assinado');
  const [sending, setSending] = useState(false);
  const [f, setF] = useState('nf');
  const [view, setView] = useState(null);
  const [asking, setAsking] = useState(null);
  const notaText = (r) => `NFS-e ${r.n}\nTomador: ${patientPrefs.account.name}\nCompetência: ${r.comp}\nServiço: psicoterapia (${r.sessions} sessões)\nValor: ${brl(r.value)}`;
  const request = async () => {
    if (store.demo) setRequests([...requests, { id: Date.now(), name: patientPrefs.account.name, kind: asking.kind, why: asking.why }]);
    else {
      setSending(true);
      try { await api.requests.create(asking.kind, asking.why); } catch (e) { toast(e.message, 'warn'); return; } finally { setSending(false); }
    }
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
                <button className="icon-btn" aria-label={`Baixar ${d.title}`} onClick={() => downloadDoc(d, 'paciente', panelPrefs.account)}><Icon name="download" size={18} /></button>
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
          footer={<button className="btn-primary" onClick={() => downloadDoc(view, 'paciente', panelPrefs.account)}><Icon name="download" size={16} /> Baixar</button>}>
          <div className="paper-scale"><DocPaper title={view.title} body={view.body} account={panelPrefs.account} code={view.code} date={view.date} /></div>
        </Modal>
      )}
      {asking && (
        <Modal sheet title="Solicitar documento" sub="Sua psicóloga recebe o pedido e avisa quando o documento estiver aqui." onClose={() => setAsking(null)}
          footer={<><button className="btn-secondary" onClick={() => setAsking(null)}>Cancelar</button><button className="btn-primary" disabled={sending} onClick={request}>{sending ? "Enviando…" : "Enviar pedido"}</button></>}>
          <label className="field">Documento<select className="select" value={asking.kind} onChange={(e) => setAsking({ ...asking, kind: e.target.value })}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Para que você precisa (opcional)<textarea rows={3} value={asking.why} onChange={(e) => setAsking({ ...asking, why: e.target.value })} placeholder="Ex.: apresentar no trabalho" /></label>
        </Modal>
      )}
    </>
  );
}

/* ---------- MEUS REGISTROS ---------- */
// The patient's own history, computed from the saved log (src/records.js).
function MeusRegistros({ store }) {
  const log = store.log ?? emptyLog();
  const record = { log, plan: { habits: store.habits, meds: store.meds } };
  const days14 = lastDays(14);
  const days7 = lastDays(7);
  const moods = dailyMood(log, days14);
  const s = stats(record, { days: 14 });
  const w = stats(record, { days: 7 });
  const emo = Object.entries(s.emotions).sort((a, b) => b[1] - a[1]);
  const emoMax = emo[0]?.[1] || 1;
  const nights = days7.map((d) => [d, log.sleep[d]]);
  const water = days7.map((d) => [d, log.water[d] ?? 0]);
  const wd = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const filled = moods.reduce((acc, v) => [...acc, v ?? acc[acc.length - 1] ?? null], []);
  return (
    <>
      <Header title="Meus registros" sub="O que você registrou nos últimos dias" />
      <section className="card">
        <div className="row-between"><h2 className="h3">Humor · 14 dias</h2><span className="muted sm">Média <strong className="ink">{num(s.moodAvg)}</strong></span></div>
        {s.moodN ? <LineChart points={filled.map((v) => v ?? 3)} min={1} max={6} height={120} labels={[fmtDay(days14[0]), fmtDay(days14[7]), 'Hoje']} /> : <p className="hint mt8">Registre seu humor em Hoje para ver o gráfico.</p>}
      </section>
      <section className="card">
        <div className="row-between"><h2 className="h3">Sono · 7 noites</h2><span className="muted sm">Média <strong className="ink">{fmtH(w.sleepAvg)}</strong></span></div>
        <div className="bars">
          {nights.map(([d, n]) => (
            <div key={d} className="bar-col">
              <span className="xs muted">{n ? fmtH(sleepMin(n)) : '—'}</span>
              <div className="bar-track"><span className="bar-fill m5" style={{ height: `${n ? Math.min(100, (sleepMin(n) / 600) * 100) : 0}%` }} /></div>
              <span className="sm muted">{wd(d)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="row-between"><h2 className="h3">Água · 7 dias</h2><span className="muted sm">Meta {fmtL(store.waterGoal)}</span></div>
        <div className="bars">
          {water.map(([d, ml]) => (
            <div key={d} className="bar-col">
              <span className="xs muted">{ml ? fmtL(ml) : '—'}</span>
              <div className="bar-track"><span className="bar-fill m4" style={{ height: `${Math.min(100, (ml / store.waterGoal) * 100)}%` }} /></div>
              <span className="sm muted">{wd(d)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2 className="h3">Emoções · 14 dias</h2>
        {emo.length ? (
          <ul className="emo-bars mt8">
            {emo.map(([e, n]) => (
              <li key={e}><span className="sm">{e}</span><span className="emo-track"><span className={EMOTIONS.pos.includes(e) ? 'pos' : 'neg'} style={{ width: `${(n / emoMax) * 100}%` }} /></span><b className="sm">{n}</b></li>
            ))}
          </ul>
        ) : <p className="hint mt8">Nenhuma emoção registrada ainda.</p>}
      </section>
      <section className="card">
        <h2 className="h3">Rotina · 7 dias</h2>
        <div className="mini-stats">
          <div><p className="muted sm">Hábitos cumpridos</p><p className="kpi-value sm-kpi">{w.habitPct == null ? '—' : `${w.habitPct}%`}</p></div>
          <div><p className="muted sm">Remédios tomados</p><p className="kpi-value sm-kpi">{w.medPct == null ? '—' : `${w.medPct}%`}</p></div>
        </div>
      </section>
    </>
  );
}
