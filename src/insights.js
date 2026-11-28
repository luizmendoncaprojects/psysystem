// Patient insight engine: reads everything the patient logged and turns it into findings the psychologist can use.
// Deterministic rules over src/records.js numbers, no model. Every finding says what it is based on and stays
// silent when there are too few data points. It never infers diagnosis or risk.
//
// analyze(record, { now }) -> {
//   coverage   how much data there is (days with logs, streak, gap since last log)
//   snapshot   one tile per area: this week vs last week, plus a 30-day series
//   findings   ranked list: { tone: 'atencao'|'melhora'|'padrao'|'info', area, text, ask? }
//   weekday    mean mood per weekday (90 days)          timeOfDay  mean mood morning/afternoon/evening
//   habits     adherence and mood gap per habit         influences  what the patient tied to emotions
//   evolution  first period vs latest (records.evolution)            suggestions  prompts for the next session
// }
import { EMOTIONS } from './data';
import { stats, withLog, dayKey, lastDays, dailyMood, sleepMin, fmtH, num, evolution, avg, std, slope, plural, loggedOn, FREQ_PER_WEEK } from './records';

const MIN_EACH = 3; // days needed on each side before comparing two groups
const GAP = 0.5; // smallest mood difference (1–6 scale) worth reporting
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados'];
const isHard = (e) => !EMOTIONS.pos.includes(e);
const dateOf = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

// Mood on days where cond(day) is true vs false. cond returns null to skip a day.
export function compareMood(daily, days, cond) {
  const yes = []; const no = [];
  days.forEach((d, i) => {
    const v = daily[i];
    if (v == null) return;
    const c = cond(d, i);
    if (c == null) return;
    (c ? yes : no).push(v);
  });
  if (yes.length < MIN_EACH || no.length < MIN_EACH) return null;
  return { yes: avg(yes), no: avg(no), nYes: yes.length, nNo: no.length, gap: avg(yes) - avg(no) };
}

export function analyze(record, { now = new Date() } = {}) {
  const log = withLog(record);
  const plan = record?.plan ?? {};
  const habits = plan.habits ?? [];
  const meds = plan.meds ?? [];
  const goal = plan.waterGoal ?? 2000;
  const d90 = lastDays(90, now);
  const d30 = d90.slice(-30);
  const d14 = d90.slice(-14);
  const daily90 = dailyMood(log, d90);
  const daily30 = daily90.slice(-30);
  const daily14 = daily90.slice(-14);
  const cur = stats(record, { now });
  const prev = stats(record, { now, endOff: -7 });
  const s14 = stats(record, { now, days: 14 });
  const prev14 = stats(record, { now, days: 14, endOff: -14 });

  const findings = [];
  const add = (weight, tone, area, text, ask) => findings.push({ weight, tone, area, text, ask });

  // ---------- coverage ----------
  const logged = d90.map((d) => Boolean(loggedOn(log, d)));
  const lastIdx = logged.lastIndexOf(true);
  const gap = lastIdx < 0 ? null : d90.length - 1 - lastIdx;
  let streak = 0;
  for (let i = d90.length - 1 - (logged[d90.length - 1] ? 0 : 1); i >= 0 && logged[i]; i -= 1) streak += 1;
  const coverage = {
    logDays7: cur.logDays, logDays30: logged.slice(-30).filter(Boolean).length,
    firstDay: d90[logged.indexOf(true)] ?? null, lastDay: lastIdx < 0 ? null : d90[lastIdx], gap, streak,
  };
  if (lastIdx < 0) {
    return { coverage, snapshot: [], findings: [{ tone: 'info', area: 'app', text: 'Ainda não há registros no app.' }], weekday: [], timeOfDay: [], habits: [], influences: [], evolution: null, suggestions: [], series: {} };
  }
  if (gap >= 3) add(85, 'atencao', 'app', `Sem registros no app há ${gap} dias (último em ${dateOf(coverage.lastDay).toLocaleDateString('pt-BR')}).`, 'Entender a pausa nos registros e se o app ainda faz sentido na rotina.');
  else if (cur.logDays >= 6) add(15, 'melhora', 'app', `Registrou em ${cur.logDays} dos últimos 7 dias${streak >= 7 ? ` (${streak} dias seguidos)` : ''}.`);
  else if (prev.logDays - cur.logDays >= 3) add(45, 'atencao', 'app', `Registrou menos nesta semana: ${cur.logDays} dias contra ${prev.logDays} na anterior.`);

  // ---------- mood ----------
  const pts14 = daily14.map((v, i) => [i, v]).filter(([, v]) => v != null);
  const spread = std(pts14.map(([, v]) => v));
  if (cur.moodN && prev.moodN) {
    const diff = cur.moodAvg - prev.moodAvg;
    if (Math.abs(diff) >= GAP && Math.abs(diff) > spread / 2) {
      if (diff < 0) add(90, 'atencao', 'humor', `Humor médio caiu de ${num(prev.moodAvg)} para ${num(cur.moodAvg)} nesta semana.`, `Explorar o que mudou nesta semana: o humor médio caiu ${num(-diff)} ponto.`);
      else add(55, 'melhora', 'humor', `Humor médio subiu de ${num(prev.moodAvg)} para ${num(cur.moodAvg)} nesta semana.`, 'Reconhecer a melhora e identificar com o paciente o que ajudou.');
    }
  }
  const sl = slope(pts14);
  if (sl != null && Math.abs(sl * 7) >= GAP) add(sl < 0 ? 70 : 40, sl < 0 ? 'atencao' : 'melhora', 'humor', `Tendência de ${sl < 0 ? 'piora' : 'melhora'} em 14 dias: cerca de ${num(Math.abs(sl * 7))} ponto por semana.`);
  const lowDays = daily14.slice(-7).filter((v) => v != null && v <= 2).length;
  if (lowDays >= 2) add(75 + lowDays * 3, 'atencao', 'humor', `${plural(lowDays, 'dia', 'dias')} com humor “mal” ou “muito mal” nos últimos 7.`, 'Retomar os dias de humor mais baixo da semana.');
  if (pts14.length >= 5 && spread >= 1.2) add(40, 'padrao', 'humor', `Humor oscilou bastante em 14 dias (desvio de ${num(spread)} ponto).`, 'Investigar o que acontece nos dias de virada de humor.');

  // weekday pattern over 90 days
  const byWd = WEEKDAYS.map(() => []);
  d90.forEach((d, i) => { if (daily90[i] != null) byWd[dateOf(d).getDay()].push(daily90[i]); });
  const all90 = daily90.filter((v) => v != null);
  const weekday = byWd.map((xs, i) => ({ label: WEEKDAYS[i], avg: xs.length >= MIN_EACH ? avg(xs) : null, n: xs.length }));
  const rated = weekday.map((w, i) => [w, i]).filter(([w]) => w.avg != null);
  if (rated.length >= 5 && all90.length >= 21) {
    const [worst, wi] = rated.reduce((a, b) => (b[0].avg < a[0].avg ? b : a));
    const mean = avg(all90);
    if (mean - worst.avg >= GAP) add(50, 'padrao', 'humor', `Humor costuma ser mais baixo ${WEEKDAYS_LONG[wi]}: ${num(worst.avg)} contra ${num(mean)} na média (${worst.n} dias).`, `Perguntar sobre a rotina ${WEEKDAYS_LONG[wi]}.`);
  }

  // time of day over 90 days
  const tod = [['Manhã', (h) => h < 12], ['Tarde', (h) => h >= 12 && h < 18], ['Noite', (h) => h >= 18]].map(([label, test]) => {
    const xs = log.mood.filter((m) => d90.includes(dayKey(new Date(m.at))) && test(new Date(m.at).getHours())).map((m) => m.v);
    return { label, avg: xs.length >= 5 ? avg(xs) : null, n: xs.length };
  });
  const todRated = tod.filter((t) => t.avg != null);
  if (todRated.length >= 2) {
    const lo = todRated.reduce((a, b) => (b.avg < a.avg ? b : a));
    const hi = todRated.reduce((a, b) => (b.avg > a.avg ? b : a));
    if (hi.avg - lo.avg >= 0.6) add(35, 'padrao', 'humor', `Registros ${lo.label === 'Manhã' ? 'da manhã' : lo.label === 'Tarde' ? 'da tarde' : 'da noite'} têm humor mais baixo: ${num(lo.avg)} contra ${num(hi.avg)} ${hi.label === 'Manhã' ? 'de manhã' : hi.label === 'Tarde' ? 'à tarde' : 'à noite'}.`);
  }

  // ---------- sleep ----------
  if (cur.nights) {
    const short = cur.days.filter((d) => log.sleep[d] && sleepMin(log.sleep[d]) < 360).length;
    if (cur.sleepAvg < 360) add(65, 'atencao', 'sono', `Sono médio de ${fmtH(cur.sleepAvg)} por noite nesta semana.`, `Conversar sobre sono: média de ${fmtH(cur.sleepAvg)} por noite.`);
    else if (short >= 2) add(50, 'atencao', 'sono', `${plural(short, 'noite', 'noites')} com menos de 6 h nesta semana.`);
    if (prev.nights && Math.abs(cur.sleepAvg - prev.sleepAvg) >= 45) add(35, cur.sleepAvg > prev.sleepAvg ? 'melhora' : 'atencao', 'sono', `Sono médio foi de ${fmtH(prev.sleepAvg)} para ${fmtH(cur.sleepAvg)}.`);
    const wake = cur.wakeups / cur.nights;
    if (wake >= 1.5) add(40, 'atencao', 'sono', `Média de ${num(wake)} despertares por noite nesta semana.`, 'Explorar os despertares noturnos e o que vem à cabeça nesses momentos.');
  }
  const sleepMood = compareMood(daily30, d30, (d) => (log.sleep[d] ? sleepMin(log.sleep[d]) < 360 : null));
  if (sleepMood && sleepMood.no - sleepMood.yes >= GAP) add(60, 'padrao', 'sono', `Depois de noites com menos de 6 h, humor médio de ${num(sleepMood.yes)} contra ${num(sleepMood.no)} nas outras (${sleepMood.nYes} e ${sleepMood.nNo} dias).`, 'Mostrar ao paciente a ligação entre noites curtas e o humor do dia seguinte.');

  // ---------- habits ----------
  const habitRows = habits.map((h) => {
    const done = (d) => (log.habits[d] ?? []).map(String).includes(String(h.id));
    const pct = Math.min(100, Math.round((d14.filter(done).length / ((FREQ_PER_WEEK[h.freq] ?? 7) * 2)) * 100));
    const mood = compareMood(daily30, d30, (d) => (loggedOn(log, d) ? done(d) : null));
    return { id: h.id, name: h.name, icon: h.icon, pct, mood, week: lastDays(7, now).map((d) => (done(d) ? 1 : 0)) };
  });
  if (s14.habitPct != null && prev14.habitPct != null && Math.abs(s14.habitPct - prev14.habitPct) >= 15) {
    add(40, s14.habitPct > prev14.habitPct ? 'melhora' : 'atencao', 'rotina', `Hábitos: ${s14.habitPct}% do combinado em 14 dias, contra ${prev14.habitPct}% nos 14 anteriores.`);
  }
  const lowHabit = [...habitRows].sort((a, b) => a.pct - b.pct)[0];
  if (lowHabit && lowHabit.pct < 50 && cur.logDays) add(45, 'atencao', 'rotina', `“${lowHabit.name}” teve ${lowHabit.pct}% de adesão em 14 dias.`, `Revisar o hábito “${lowHabit.name}”: meta menor ou outro horário.`);
  habitRows.filter((h) => h.mood && h.mood.gap >= GAP).sort((a, b) => b.mood.gap - a.mood.gap).slice(0, 2).forEach((h, i) => {
    add(58 - i * 8, 'padrao', 'rotina', `Nos dias com “${h.name}”, humor médio de ${num(h.mood.yes)} contra ${num(h.mood.no)} nos outros.`, `Reforçar “${h.name}”: nos dias em que acontece, o humor é melhor.`);
  });

  // ---------- medicines ----------
  if (meds.length && s14.medPct != null && cur.logDays) {
    if (s14.medPct < 80) add(60, 'atencao', 'remedios', `${s14.medPct}% das doses marcadas como tomadas em 14 dias.`, 'Checar a adesão aos remédios e combinar com o médico que prescreveu, se for o caso.');
    const allTaken = (d) => (loggedOn(log, d) ? Object.keys(log.meds[d] ?? {}).length >= meds.length : null);
    const medMood = compareMood(daily30, d30, allTaken);
    if (medMood && medMood.yes - medMood.no >= GAP) add(45, 'padrao', 'remedios', `Em dias com alguma dose sem marcar, humor médio de ${num(medMood.no)} contra ${num(medMood.yes)} quando todas foram marcadas.`);
  }

  // ---------- water ----------
  if (cur.waterAvg != null) {
    const hit = cur.days.filter((d) => (log.water[d] ?? 0) >= goal).length;
    if (cur.waterAvg < goal * 0.7) add(20, 'info', 'agua', `Água: média de ${(cur.waterAvg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L por dia; meta atingida em ${plural(hit, 'dia', 'dias')}.`);
  }

  // ---------- emotions and influences (30 days) ----------
  const share = (s) => { const t = Object.values(s.emotions).reduce((a, b) => a + b, 0); return t ? Math.round((s.hard / t) * 100) : null; };
  const shCur = share(s14); const shPrev = share(prev14);
  if (shCur != null && shPrev != null && Math.abs(shCur - shPrev) >= 20) add(50, shCur > shPrev ? 'atencao' : 'melhora', 'emocoes', `Emoções difíceis: ${shCur}% dos registros em 14 dias, contra ${shPrev}% antes.`);
  if (s14.topEmotion) add(30, 'info', 'emocoes', `Emoção mais registrada em 14 dias: ${s14.topEmotion[0].toLowerCase()} (${plural(s14.topEmotion[1], 'vez', 'vezes')}).`, `Explorar o que está por trás de “${s14.topEmotion[0].toLowerCase()}”.`);
  const inf = {};
  log.emotions.filter((e) => d30.includes(dayKey(new Date(e.at)))).forEach((e) => {
    const hard = (e.list ?? []).some(isHard);
    (e.influences ?? []).forEach((x) => { inf[x] ??= { name: x, n: 0, hard: 0 }; inf[x].n += 1; if (hard) inf[x].hard += 1; });
  });
  const influences = Object.values(inf).sort((a, b) => b.n - a.n);
  const heavy = influences.filter((x) => x.n >= 3 && x.hard / x.n >= 0.7)[0];
  if (heavy) add(55, 'padrao', 'emocoes', `“${heavy.name}” foi citado em ${heavy.n} registros de emoção, ${heavy.hard} deles com emoções difíceis.`, `Explorar a relação com “${heavy.name.toLowerCase()}”.`);

  // ---------- diary and agenda ----------
  const recentShared = (record?.diary ?? []).filter((e) => e.shared && e.at && now - new Date(e.at) < 7 * 864e5);
  const lowShared = recentShared.filter((e) => e.mood && e.mood <= 2).length;
  if (lowShared) add(70, 'atencao', 'diario', `${plural(lowShared, 'entrada compartilhada', 'entradas compartilhadas')} no diário com humor baixo nesta semana.`, 'Ler com o paciente as entradas do diário que ele compartilhou.');
  else if (recentShared.length) add(25, 'info', 'diario', `${plural(recentShared.length, 'entrada compartilhada', 'entradas compartilhadas')} no diário nesta semana.`);
  const topics = record?.topics ?? [];
  const prio = topics.find((t) => t.prio);
  if (topics.length) add(prio ? 95 : 60, 'info', 'pauta', `${plural(topics.length, 'assunto', 'assuntos')} na pauta${prio ? `; prioridade: “${prio.t}”` : ''}.`, `Começar pela pauta: “${(prio ?? topics[0]).t}”.`);

  findings.sort((a, b) => b.weight - a.weight);
  const suggestions = [...new Set(findings.filter((f) => f.ask && f.tone !== 'melhora').map((f) => f.ask))].slice(0, 4);

  const arrow = (a, b, good = 'up', tol = 0) => (a == null || b == null || Math.abs(a - b) <= tol ? 'flat' : (b > a) === (good === 'up') ? 'better' : 'worse');
  const snapshot = [
    { key: 'humor', label: 'Humor', value: cur.moodAvg, prev: prev.moodAvg, text: num(cur.moodAvg), sub: cur.moodN ? `${plural(cur.moodN, 'registro', 'registros')}` : 'sem registros', trend: arrow(prev.moodAvg, cur.moodAvg, 'up', 0.2), series: daily30 },
    { key: 'sono', label: 'Sono', value: cur.sleepAvg, prev: prev.sleepAvg, text: fmtH(cur.sleepAvg), sub: cur.nights ? `${plural(cur.nights, 'noite', 'noites')}` : 'sem registros', trend: arrow(prev.sleepAvg, cur.sleepAvg, 'up', 20), series: d30.map((d) => (log.sleep[d] ? sleepMin(log.sleep[d]) / 60 : null)) },
    { key: 'rotina', label: 'Hábitos', value: cur.habitPct, prev: prev.habitPct, text: cur.habitPct == null ? '—' : `${cur.habitPct}%`, sub: 'do combinado', trend: arrow(prev.habitPct, cur.habitPct, 'up', 5), series: d30.map((d) => (log.habits[d] ?? []).length) },
    { key: 'remedios', label: 'Remédios', value: cur.medPct, prev: prev.medPct, text: cur.medPct == null ? '—' : `${cur.medPct}%`, sub: 'doses marcadas', trend: arrow(prev.medPct, cur.medPct, 'up', 5), series: d30.map((d) => Object.keys(log.meds[d] ?? {}).length) },
    { key: 'agua', label: 'Água', value: cur.waterAvg, prev: prev.waterAvg, text: cur.waterAvg == null ? '—' : `${(cur.waterAvg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`, sub: `meta ${(goal / 1000).toLocaleString('pt-BR')} L`, trend: arrow(prev.waterAvg, cur.waterAvg, 'up', 150), series: d30.map((d) => (log.water[d] ? log.water[d] / 1000 : null)) },
    { key: 'emocoes', label: 'Emoções difíceis', value: cur.hard, prev: prev.hard, text: String(cur.hard), sub: 'registros na semana', trend: arrow(prev.hard, cur.hard, 'down', 1), series: d30.map((d) => log.emotions.filter((e) => dayKey(new Date(e.at)) === d && (e.list ?? []).some(isHard)).length) },
  ];

  return {
    coverage, snapshot, findings, weekday, timeOfDay: tod, habits: habitRows, influences, suggestions,
    evolution: evolution(record, now),
    series: { days30: d30, days90: d90, mood30: daily30, mood90: daily90 },
  };
}
