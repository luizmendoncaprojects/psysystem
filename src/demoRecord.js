// Demo only: a believable 120-day app record for a demo patient, so the panel runs the same analysis as for real
// patients. Deterministic per patient id. Planted patterns the insight engine should find:
// mood improves over months, dips in the last week (work), is lower on Mondays and after short nights,
// is better on days with the walking habit; "Trabalho" comes with difficult emotions.
import { dayKey, addDays } from './records';
import { EMOTIONS } from './data';

const rng = (seed) => { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
const clamp = (v) => Math.max(1, Math.min(6, Math.round(v)));
const hhmm = (min) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(Math.round(min) % 60).padStart(2, '0')}`;
const at = (day, h, m = 0) => { const d = new Date(day); d.setHours(h, m, 0, 0); return d.toISOString(); };

export function demoRecord(p, now = new Date(), days = 120) {
  if (!p.mood) return null; // patients who never used the app stay empty
  const r = rng(p.id);
  const base = p.mood.reduce((a, b) => a + b, 0) / p.mood.length;
  const habits = (p.habits ?? []).map(({ week, ...h }) => h);
  const meds = p.meds ?? [];
  const log = { mood: [], sleep: {}, water: {}, emotions: [], habits: {}, meds: {}, dayEmotion: {} };
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(now, -i);
    const k = dayKey(day);
    if (r() < 0.1 && i > 0) continue; // ~10% of days without any log
    const walk = r() < 0.6;
    const short = r() < (i < 8 ? 0.45 : 0.2);
    const bed = 23 * 60 + (short ? 50 : 0) + (r() - 0.5) * 70;
    const sleepLen = short ? 300 + r() * 50 : 400 + r() * 80;
    log.sleep[k] = { bed: hhmm(bed), wake: hhmm(bed + sleepLen), q: short ? 2 : 3 + Math.round(r()), wakeups: short || i < 8 ? 1 + Math.round(r() * 2) : Math.round(r() * 0.8) };
    let mood = base - 0.6 + ((days - i) / days) * 1.1; // slow improvement
    if (day.getDay() === 1) mood -= 0.8;
    if (short) mood -= 0.9;
    if (walk) mood += 0.7;
    if (i < 8) mood -= 1; // recent dip
    mood += (r() - 0.5) * 0.8;
    log.mood.push({ at: at(day, 9, Math.round(r() * 50)), v: clamp(mood + 0.2) });
    if (r() < 0.6) log.mood.push({ at: at(day, 20, Math.round(r() * 50)), v: clamp(mood - 0.4) });
    const done = habits.filter((h) => (h.name === 'Caminhada' ? walk : h.name.startsWith('Dormir') ? !short : r() < 0.75)).map((h) => h.id);
    if (done.length) log.habits[k] = done;
    const taken = {};
    meds.forEach((m) => { if (r() < (i < 8 ? 0.8 : 0.95)) taken[m.id] = m.time; });
    if (Object.keys(taken).length) log.meds[k] = taken;
    log.water[k] = Math.round((1100 + r() * 1100) / 250) * 250;
    if (r() < 0.75) {
      const hard = clamp(mood) <= 3;
      const pool = hard ? ['Ansiedade', 'Ansiedade', 'Cansaço', 'Tristeza', 'Irritação'] : ['Calma', 'Alegria', 'Gratidão', 'Alívio'];
      const list = [pool[Math.floor(r() * pool.length)]];
      const influences = hard ? (r() < 0.75 ? ['Trabalho'] : ['Sono']) : [r() < 0.5 ? 'Família' : 'Exercício'];
      log.emotions.push({ at: at(day, 19), list, intensity: hard ? 4 : 2, influences });
      if (r() < 0.5) log.dayEmotion[k] = hard ? list[0] : EMOTIONS.neg[Math.floor(r() * 3)];
    }
  }
  const ago = (n, h) => at(addDays(now, -n), h);
  return {
    plan: { perms: p.perms, habits, meds, waterGoal: p.waterGoal ?? 2000 },
    clinical: { cid: p.cid, risk: p.risk },
    log,
    diary: [
      { id: 1, at: ago(1, 4), d: 'madrugada de ontem', t: 'Acordei às 4h de novo', b: 'Fiquei repassando a conversa da reunião. Fiz a respiração e consegui voltar a dormir lá pelas 5h.', mood: 2, shared: true },
      { id: 2, at: ago(4, 20), d: 'há 4 dias', t: 'Reunião com o gestor', b: 'Saí da reunião com o coração acelerado. Quero levar isso para a sessão.', mood: 2, shared: true, agenda: true },
      { id: 3, at: ago(6, 21), d: 'há 6 dias', t: 'Almoço com a família', b: 'Foi leve. Ri bastante e quase não pensei no trabalho.', mood: 5, shared: true },
    ],
    topics: [
      { t: 'Conversa difícil com o gestor', d: '', prio: true },
      { t: 'Voltei a acordar de madrugada', d: '' },
      { t: 'Viagem de dezembro', d: '' },
    ],
    rx: p.rx ?? [],
  };
}
