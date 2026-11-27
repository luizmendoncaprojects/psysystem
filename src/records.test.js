import { dayKey, offsetKey, stats, patientView, summary, alerts, evolution, answer } from './records';

const NOW = new Date('2026-11-27T15:00:00');
const at = (off, h = 10) => { const d = new Date(NOW); d.setDate(d.getDate() + off); d.setHours(h); return d.toISOString(); };
const record = {
  plan: { perms: { humor: true }, habits: [{ id: 1, name: 'Caminhada', freq: 'Todos os dias' }], meds: [{ id: 9, name: 'Sertralina', time: '08:00' }], waterGoal: 2000 },
  clinical: { cid: 'F41.1', risk: 'Baixo' },
  log: {
    mood: [{ at: at(0), v: 2 }, { at: at(-1), v: 2 }, { at: at(-8), v: 5 }, { at: at(-9), v: 5 }],
    sleep: { [offsetKey(0, NOW)]: { bed: '23:00', wake: '07:00', q: 3, wakeups: 2 } },
    water: { [offsetKey(0, NOW)]: 1500 },
    emotions: [{ at: at(0), list: ['Ansiedade', 'Medo'] }, { at: at(-1), list: ['Ansiedade'] }],
    habits: { [offsetKey(0, NOW)]: [1], [offsetKey(-1, NOW)]: [1] },
    meds: { [offsetKey(0, NOW)]: { 9: '08:10' } },
    dayEmotion: { [offsetKey(0, NOW)]: 'Tristeza' },
  },
  topics: [{ t: 'Conversa com o gestor', prio: true }],
};

test('stats averages the window and counts adherence', () => {
  const s = stats(record, { now: NOW });
  expect(s.moodAvg).toBe(2);
  expect(s.sleepAvg).toBe(480);
  expect(s.habitPct).toBe(29); // 2 of 7 days
  expect(s.medPct).toBe(14); // 1 of 7 doses
  expect(s.topEmotion).toEqual(['Ansiedade', 2]);
  expect(s.logDays).toBe(2);
  expect(stats(record, { now: NOW, endOff: -7 }).moodAvg).toBe(5);
});

test('summary, alerts and evolution are built from the numbers', () => {
  const lines = summary(record, NOW).join(' ');
  expect(lines).toMatch(/Humor médio de 2,0 .* abaixo da semana anterior \(5,0\)/);
  expect(lines).toMatch(/2 dias com humor/);
  expect(lines).toMatch(/prioridade: “Conversa com o gestor”/);
  const p = { ...patientView(record, {}), status: 'Ativo' };
  expect(alerts(p, NOW).map((a) => a[0]).join(' | ')).toMatch(/Humor médio baixo/);
  const ev = evolution(record, NOW);
  expect(ev.worse.join(' ')).toMatch(/Humor médio/);
  expect(answer('como está o sono?', record, NOW)).toMatch(/8h00/);
});

test('patientView maps plan, clinical and habit checks of the last 7 days', () => {
  const v = patientView({ ...record, log: { ...record.log, habits: { [dayKey()]: [1] } } }, { agua: true });
  expect(v.perms).toEqual({ agua: true, humor: true });
  expect(v.habits[0].week[6]).toBe(1);
  expect(v.cid).toBe('F41.1');
  expect(patientView(undefined, {}).mood).toBeNull();
});
