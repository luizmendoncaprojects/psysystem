// Patient record (from /api/records) -> what the screens show, plus the simple rules that stand in for "AI":
// averages, trends, adherence and alerts computed from what the patient logged. Pure functions, unit-tested.
//
// record = { plan, clinical, rxStatus, log, diary, topics, rx }
// log = { mood: [{ at, v }], sleep: { day: { bed, wake, q, wakeups } }, water: { day: ml },
//         emotions: [{ at, list, intensity, influences }], habits: { day: [habitId] },
//         meds: { day: { medId: 'HH:MM' } }, dayEmotion: { day: name } }
import { EMOTIONS } from './data';

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const offsetKey = (off, now = new Date()) => dayKey(addDays(now, off));
// n day keys ending at `end` (offset 0 = today), oldest first.
export const lastDays = (n, now = new Date(), endOff = 0) => Array.from({ length: n }, (_, i) => offsetKey(endOff - n + 1 + i, now));
const fmtDay = (k) => k.split('-').reverse().slice(0, 2).join('/');

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
export const num = (v, d = 1) => (v == null ? '—' : v.toFixed(d).replace('.', ','));
export const sleepMin = (n) => { const t = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; }; return (t(n.wake) - t(n.bed) + 1440) % 1440; };
export const fmtH = (min) => (min == null ? '—' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`);
const FREQ_PER_WEEK = { 'Todos os dias': 7, 'Dias úteis': 5, '5 vezes por semana': 5, '3 vezes por semana': 3, '1 vez por semana': 1 };

export const emptyLog = () => ({ mood: [], sleep: {}, water: {}, emotions: [], habits: {}, meds: {}, dayEmotion: {} });
export const withLog = (record) => ({ ...emptyLog(), ...(record?.log ?? {}) });

// Average mood per day for the given day keys (null when nothing was logged that day).
export const dailyMood = (log, days) => days.map((d) => avg(log.mood.filter((m) => dayKey(new Date(m.at)) === d).map((m) => m.v)));

const loggedOn = (log, d) => log.mood.some((m) => dayKey(new Date(m.at)) === d) || log.sleep[d] || log.water[d] || log.habits[d]?.length
  || Object.keys(log.meds[d] ?? {}).length || log.dayEmotion[d] || log.emotions.some((e) => dayKey(new Date(e.at)) === d);

// Numbers for a window of `days` days ending `endOff` days from today.
export function stats(record, { days = 7, endOff = 0, now = new Date() } = {}) {
  const log = withLog(record);
  const plan = record?.plan ?? {};
  const keys = lastDays(days, now, endOff);
  const inWin = (at) => keys.includes(dayKey(new Date(at)));
  const moods = log.mood.filter((m) => inWin(m.at)).map((m) => m.v);
  const nights = keys.map((k) => log.sleep[k]).filter(Boolean);
  const waters = keys.map((k) => log.water[k]).filter((v) => v > 0);
  const counts = {};
  log.emotions.filter((e) => inWin(e.at)).forEach((e) => e.list.forEach((x) => { counts[x] = (counts[x] || 0) + 1; }));
  keys.forEach((k) => { const e = log.dayEmotion[k]; if (e) counts[e] = (counts[e] || 0) + 1; });
  const habits = plan.habits ?? [];
  const expected = habits.reduce((s, h) => s + (FREQ_PER_WEEK[h.freq] ?? 7) * (days / 7), 0);
  const done = keys.reduce((s, k) => s + (log.habits[k] ?? []).filter((id) => habits.some((h) => String(h.id) === String(id))).length, 0);
  const meds = plan.meds ?? [];
  const doses = keys.reduce((s, k) => s + Object.keys(log.meds[k] ?? {}).filter((id) => meds.some((m) => String(m.id) === String(id))).length, 0);
  const byHabit = habits.map((h) => ({ name: h.name, pct: Math.round((keys.filter((k) => (log.habits[k] ?? []).map(String).includes(String(h.id))).length / ((FREQ_PER_WEEK[h.freq] ?? 7) * days / 7)) * 100) }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    days: keys, moodAvg: avg(moods), moodN: moods.length,
    sleepAvg: avg(nights.map(sleepMin)), wakeups: nights.reduce((s, n) => s + (n.wakeups || 0), 0), nights: nights.length,
    waterAvg: avg(waters),
    habitPct: expected ? Math.min(100, Math.round((done / expected) * 100)) : null, byHabit,
    medPct: meds.length ? Math.min(100, Math.round((doses / (meds.length * days)) * 100)) : null,
    emotions: counts, topEmotion: top[0] ?? null,
    hard: top.filter(([e]) => !EMOTIONS.pos.includes(e)).reduce((s, [, n]) => s + n, 0),
    logDays: keys.filter((k) => loggedOn(log, k)).length,
  };
}

// What the panel shows for one patient, built from the record (falls back to defaults).
export function patientView(record, defaultPerms) {
  const plan = record?.plan ?? {};
  const log = withLog(record);
  const today = dayKey();
  const week = lastDays(7);
  const moods14 = dailyMood(log, lastDays(14)).filter((v) => v != null);
  const s14 = stats(record, { days: 14 });
  const rxStatus = record?.rxStatus ?? {};
  return {
    perms: { ...defaultPerms, ...(plan.perms ?? {}) },
    habits: (plan.habits ?? []).map((h) => ({ ...h, week: week.map((d) => ((log.habits[d] ?? []).map(String).includes(String(h.id)) ? 1 : 0)) })),
    meds: plan.meds ?? [],
    waterGoal: plan.waterGoal ?? 2000,
    cid: record?.clinical?.cid ?? '',
    risk: record?.clinical?.risk ?? 'Não definido',
    rx: (record?.rx ?? []).map((r) => ({ ...r, ...(rxStatus[r.id] ?? {}) })),
    mood: moods14.length >= 2 ? moods14 : moods14.length === 1 ? [moods14[0], moods14[0]] : null,
    use: Math.round((s14.logDays / 14) * 100),
    emotions: s14.emotions,
    diary: record?.diary ?? [],
    topics: record?.topics ?? [],
    log, record,
    todayMood: avg(log.mood.filter((m) => dayKey(new Date(m.at)) === today).map((m) => m.v)),
  };
}

const std = (xs) => { const m = avg(xs); return xs.length > 1 ? Math.sqrt(avg(xs.map((x) => (x - m) ** 2))) : 0; };
// Least-squares slope of y over x (points per day). null with fewer than 4 points.
const slope = (pts) => {
  if (pts.length < 4) return null;
  const mx = avg(pts.map((p) => p[0])); const my = avg(pts.map((p) => p[1]));
  const den = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  return den ? pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / den : null;
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Pre-session summary. Rules:
// - says how much data it is based on, and stays quiet about a measure with too few points;
// - mood: week mean vs previous week (a change counts only if ≥ 0,5 and larger than half the usual spread),
//   14-day trend by least squares, days ≤ 2, and spread (oscillation) when the std dev is ≥ 1,2;
// - sleep: mean, short nights (< 6 h), and mood after short vs normal nights (≥ 2 of each, gap ≥ 0,5);
// - emotions: most frequent, share of difficult ones, most cited influence;
// - habits/medicines: adherence, weakest habit, days with a missed dose; water vs goal.
export function summary(record, now = new Date()) {
  const log = withLog(record);
  const cur = stats(record, { now });
  const prev = stats(record, { endOff: -7, now });
  const out = [];
  if (!cur.logDays) return ['Sem registros no app nos últimos 7 dias.'];
  out.push(`Baseado em ${plural(cur.logDays, 'dia', 'dias')} com registro nos últimos 7.`);

  const d14 = lastDays(14, now);
  const daily = dailyMood(log, d14);
  const pts = daily.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (cur.moodN) {
    const spread = std(pts.map(([, v]) => v));
    const diff = prev.moodAvg != null ? cur.moodAvg - prev.moodAvg : null;
    const meaningful = diff != null && Math.abs(diff) >= 0.5 && Math.abs(diff) > spread / 2;
    let line = `Humor médio de ${num(cur.moodAvg)} (escala 1–6) em ${plural(cur.moodN, 'registro', 'registros')}`;
    line += diff == null ? '' : meaningful ? `, ${diff > 0 ? 'acima' : 'abaixo'} da semana anterior (${num(prev.moodAvg)})` : ', parecido com a semana anterior';
    out.push(`${line}.`);
    const sl = slope(pts);
    if (sl != null && Math.abs(sl * 7) >= 0.5) out.push(`Tendência de ${sl > 0 ? 'melhora' : 'piora'} em 14 dias: cerca de ${num(Math.abs(sl * 7))} ${Math.abs(sl * 7) >= 1.95 ? 'pontos' : 'ponto'} por semana.`);
    const low = daily.slice(-7).filter((v) => v != null && v <= 2).length;
    if (low) out.push(`${plural(low, 'dia', 'dias')} com humor “mal” ou “muito mal” nesta semana.`);
    if (pts.length >= 5 && spread >= 1.2) out.push(`Humor oscilou bastante (desvio de ${num(spread)} ponto).`);
  } else out.push('Sem registros de humor nesta semana.');

  if (cur.nights) {
    const short = cur.days.filter((d) => log.sleep[d] && sleepMin(log.sleep[d]) < 360).length;
    out.push(`Sono médio de ${fmtH(cur.sleepAvg)} em ${plural(cur.nights, 'noite', 'noites')}${short ? `, ${short} com menos de 6 h` : ''}${cur.wakeups ? `, ${plural(cur.wakeups, 'despertar', 'despertares')} no total` : ''}.`);
    const afterShort = []; const afterOk = [];
    d14.forEach((d, i) => { const n = log.sleep[d]; if (n && daily[i] != null) (sleepMin(n) < 360 ? afterShort : afterOk).push(daily[i]); });
    if (afterShort.length >= 2 && afterOk.length >= 2 && avg(afterOk) - avg(afterShort) >= 0.5) out.push(`Nos dias depois de noites curtas o humor foi menor (${num(avg(afterShort))} contra ${num(avg(afterOk))}).`);
  }

  if (cur.topEmotion) {
    const total = Object.values(cur.emotions).reduce((a, b) => a + b, 0);
    const infl = {};
    log.emotions.filter((e) => cur.days.includes(dayKey(new Date(e.at)))).forEach((e) => (e.influences ?? []).forEach((x) => { infl[x] = (infl[x] || 0) + 1; }));
    const topInf = Object.entries(infl).sort((a, b) => b[1] - a[1])[0];
    out.push(`Emoção mais registrada: ${cur.topEmotion[0].toLowerCase()} (${plural(cur.topEmotion[1], 'vez', 'vezes')}); ${Math.round((cur.hard / total) * 100)}% das emoções foram difíceis${topInf ? `. Influência mais citada: ${topInf[0].toLowerCase()}` : ''}.`);
  }
  if (cur.habitPct != null) {
    const sorted = [...cur.byHabit].sort((a, b) => a.pct - b.pct);
    const low = sorted[0]; const high = sorted[sorted.length - 1];
    out.push(`Hábitos: ${cur.habitPct}% do combinado${sorted.length > 1 && high.pct > low.pct ? `; melhor em “${high.name}” (${Math.min(100, high.pct)}%), menor em “${low.name}” (${low.pct}%)` : ''}.`);
  }
  if (cur.medPct != null) {
    const meds = record?.plan?.meds ?? [];
    const missed = cur.days.filter((d) => Object.keys(log.meds[d] ?? {}).length < meds.length).length;
    out.push(`Remédios: ${cur.medPct}% das doses marcadas${missed ? `; ${plural(missed, 'dia', 'dias')} com dose sem marcar` : ''}.`);
  }
  if (cur.waterAvg != null) {
    const goal = record?.plan?.waterGoal ?? 2000;
    const hit = cur.days.filter((d) => (log.water[d] ?? 0) >= goal).length;
    out.push(`Água: média de ${(cur.waterAvg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L por dia; meta atingida em ${plural(hit, 'dia', 'dias')}.`);
  }
  const topics = record?.topics ?? [];
  if (topics.length) {
    const prio = topics.find((t) => t.prio);
    out.push(`${topics.length} ${topics.length === 1 ? 'assunto' : 'assuntos'} na pauta${prio ? `; prioridade: “${prio.t}”` : ''}.`);
  }
  const shared = (record?.diary ?? []).filter((e) => e.shared && Date.now() - (e.at ? new Date(e.at) : 0) < 7 * 864e5).length;
  if (shared) out.push(`${shared} ${shared === 1 ? 'registro compartilhado' : 'registros compartilhados'} no diário nesta semana.`);
  return out;
}

// Rule-based alerts for the dashboard "Pedem atenção" list. Never infers risk.
export function alerts(p, now = new Date()) {
  if (!p.record) return [];
  const cur = stats(p.record, { now, days: 7 });
  const prev = stats(p.record, { now, days: 7, endOff: -7 });
  const out = [];
  if (cur.moodN >= 2 && cur.moodAvg <= 2.5) out.push([`Humor médio baixo na semana (${num(cur.moodAvg)})`, 'App · Humor', 'smile']);
  else if (cur.moodN && prev.moodN && prev.moodAvg - cur.moodAvg >= 0.8) out.push([`Humor caiu de ${num(prev.moodAvg)} para ${num(cur.moodAvg)}`, 'App · Humor', 'smile']);
  if (cur.hard >= 4) out.push([`${cur.hard} registros de emoções difíceis na semana`, 'App · Emoções', 'heart']);
  const recent = stats(p.record, { now, days: 3 });
  if (recent.medPct != null && recent.medPct < 70) out.push([`Só ${recent.medPct}% das doses marcadas nos últimos 3 dias`, 'App · Remédios', 'pill']);
  if (p.status?.startsWith('Ativ') && cur.logDays === 0) out.push(['Sem registros no app há 7 dias', 'App', 'clock']);
  const newRx = (p.rx ?? []).filter((r) => r.status === 'Nova').length;
  if (newRx) out.push([`Enviou ${newRx === 1 ? 'uma receita nova' : `${newRx} receitas novas`}`, 'App · Receitas', 'file']);
  const prio = (p.topics ?? []).find((t) => t.prio);
  if (prio) out.push([`Marcou como prioridade: “${prio.t}”`, 'App · Pauta', 'flag']);
  return out;
}

// Evolution for the "Copilot": first 30 days with data vs last 30 days.
export function evolution(record, now = new Date()) {
  const log = withLog(record);
  const firstAt = log.mood.map((m) => new Date(m.at)).sort((a, b) => a - b)[0];
  const spanDays = firstAt ? Math.ceil((now - firstAt) / 864e5) + 1 : 0;
  const win = Math.min(30, Math.max(7, Math.floor(spanDays / 2)));
  const last = stats(record, { days: win, now });
  const first = stats(record, { days: win, endOff: -(spanDays - win), now });
  const better = []; const worse = [];
  const cmp = (a, b, label, fmt, up = true) => {
    if (a == null || b == null || a === b) return;
    const s = `${label}: ${fmt(a)} → ${fmt(b)}`;
    ((b > a) === up ? better : worse).push(s);
  };
  cmp(first.moodAvg, last.moodAvg, 'Humor médio', (v) => num(v));
  cmp(first.habitPct, last.habitPct, 'Hábitos cumpridos', (v) => `${v}%`);
  cmp(first.sleepAvg, last.sleepAvg, 'Sono médio', fmtH);
  cmp(first.hard, last.hard, 'Emoções difíceis registradas', (v) => String(v), false);
  const low = [...last.byHabit].sort((a, b) => a.pct - b.pct)[0];
  if (low && low.pct < 50) worse.push(`“${low.name}” é o hábito com menor adesão: ${low.pct}% no período.`);
  const months = {};
  log.mood.forEach((m) => { const d = new Date(m.at); const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; (months[k] ??= []).push(m.v); });
  const monthly = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([k, vs]) => [k, avg(vs)]);
  const suggestions = [];
  const prio = (record?.topics ?? []).find((t) => t.prio) ?? (record?.topics ?? [])[0];
  if (prio) suggestions.push(`Começar pela pauta: “${prio.t}”.`);
  if (last.topEmotion) suggestions.push(`Explorar o que está por trás de “${last.topEmotion[0].toLowerCase()}”, a emoção mais registrada (${last.topEmotion[1]}×).`);
  if (low && low.pct < 50) suggestions.push(`Revisar o hábito “${low.name}”: combinar uma meta menor ou outro horário.`);
  if (last.sleepAvg != null && last.sleepAvg < 6 * 60) suggestions.push(`Conversar sobre sono: média de ${fmtH(last.sleepAvg)} por noite.`);
  return { spanDays, win, first, last, better, worse, monthly, suggestions };
}

// Keyword answers over the computed numbers (the "ask the Copilot" box).
export function answer(question, record, now = new Date()) {
  const q = question.toLowerCase();
  const s = stats(record, { days: 14, now });
  if (/humor|ânimo|animo/.test(q)) return s.moodN ? `Humor médio de ${num(s.moodAvg)} nos últimos 14 dias, em ${s.moodN} registros.` : 'Sem registros de humor nos últimos 14 dias.';
  if (/sono|dorm/.test(q)) return s.nights ? `Sono médio de ${fmtH(s.sleepAvg)} em ${s.nights} noites registradas, com ${s.wakeups} despertares.` : 'Sem registros de sono nos últimos 14 dias.';
  if (/h[aá]bit/.test(q)) return s.habitPct != null ? `Hábitos: ${s.habitPct}% do combinado. ${s.byHabit.map((h) => `${h.name}: ${h.pct}%`).join(' · ')}.` : 'Nenhum hábito definido no plano.';
  if (/rem[eé]d|dose|medica/.test(q)) return s.medPct != null ? `${s.medPct}% das doses marcadas como tomadas nos últimos 14 dias.` : 'Nenhum remédio cadastrado.';
  if (/emo[cç]|sent/.test(q)) return s.topEmotion ? `Emoções nos últimos 14 dias: ${Object.entries(s.emotions).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} (${n})`).join(', ')}.` : 'Sem emoções registradas nos últimos 14 dias.';
  if (/pauta|assunto/.test(q)) { const t = record?.topics ?? []; return t.length ? `Pauta: ${t.map((x) => `${x.prio ? '[prioridade] ' : ''}${x.t}`).join('; ')}.` : 'Nenhum assunto na pauta.'; }
  if (/resum|semana|evolu/.test(q)) return summary(record, now).join(' ');
  return 'Pergunte sobre humor, sono, hábitos, remédios, emoções, pauta ou peça um resumo da semana.';
}

export { fmtDay };
