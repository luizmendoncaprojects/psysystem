import { analyze, compareMood } from './insights';
import { demoRecord } from './demoRecord';
import { INITIAL_PATIENTS } from './data';

const NOW = new Date('2026-11-27T15:00:00');
const camila = INITIAL_PATIENTS.find((p) => p.id === 'camila');

test('compareMood needs enough days on both sides', () => {
  const days = ['a', 'b', 'c', 'd', 'e', 'f'];
  expect(compareMood([5, 5, 5, 2, 2, 2], days, (_, i) => i < 3)).toMatchObject({ yes: 5, no: 2, gap: 3 });
  expect(compareMood([5, 5, 2, 2, 2, 2], days, (_, i) => i < 2)).toBeNull();
  expect(compareMood([5, null, 5, 2, 2, 2], days, (_, i) => (i === 0 ? null : i < 3))).toBeNull();
});

test('finds the patterns planted in the demo record', () => {
  const ins = analyze(demoRecord(camila, NOW), { now: NOW });
  const text = ins.findings.map((f) => f.text).join('\n');
  expect(text).toMatch(/caiu de .* nesta semana/); // recent dip
  expect(text).toMatch(/mais baixo às segundas/); // weekday
  expect(text).toMatch(/noites com menos de 6 h, humor médio/); // sleep vs mood
  expect(text).toMatch(/Nos dias com “Caminhada”/); // habit vs mood
  expect(text).toMatch(/“Trabalho” foi citado/); // influence tied to difficult emotions
  expect(text).toMatch(/prioridade: “Conversa difícil com o gestor”/);
  expect(ins.findings[0].weight).toBeGreaterThanOrEqual(ins.findings[ins.findings.length - 1].weight);
  expect(ins.suggestions.length).toBeGreaterThan(0);
  expect(ins.suggestions.length).toBeLessThanOrEqual(4);
  expect(ins.snapshot.map((s) => s.key)).toEqual(['humor', 'sono', 'rotina', 'remedios', 'agua', 'emocoes']);
  expect(ins.evolution.better.join(' ')).toMatch(/Humor médio/); // months of slow improvement
});

test('stays quiet without data and never mentions risk or diagnosis', () => {
  expect(analyze({}, { now: NOW }).findings[0].text).toMatch(/Ainda não há registros/);
  const all = analyze(demoRecord(camila, NOW), { now: NOW }).findings.map((f) => f.text).join(' ');
  expect(all).not.toMatch(/risco|diagn/i);
});
