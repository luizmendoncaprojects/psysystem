// Demo data shared by the patient app and the psychologist panel.

// [key, label, description, icon]
export const FEATURES = [
  ['humor', 'Humor', 'Registro rápido de 1 a 5, quantas vezes quiser', 'smile'],
  ['emocoes', 'Emoções', 'Escolher o que está sentindo e o que influenciou', 'heart'],
  ['habitos', 'Hábitos', 'Rotina combinada na sessão', 'checks'],
  ['sono', 'Sono', 'Horário de deitar e acordar, despertares e qualidade', 'moon'],
  ['agua', 'Água', 'Copos de água bebidos no dia', 'drop'],
  ['remedios', 'Remédios', 'Lembretes dos remédios cadastrados por você', 'pill'],
  ['receitas', 'Envio de receitas', 'Paciente envia foto ou PDF da receita', 'file'],
  ['diario', 'Diário', 'Textos livres; o paciente escolhe o que compartilhar', 'book'],
  ['pauta', 'Assuntos da sessão', 'Aba no Diário com os assuntos para a próxima sessão', 'flag'],
];
export const INITIAL_PERMS = Object.fromEntries(FEATURES.map(([k]) => [k, true]));

export const EMOTIONS = {
  pos: ['Calma', 'Alegria', 'Gratidão', 'Esperança', 'Alívio', 'Orgulho'],
  neg: ['Ansiedade', 'Medo', 'Tristeza', 'Irritação', 'Culpa', 'Solidão', 'Cansaço', 'Vergonha'],
};
// Counts over the last 14 days.
export const INITIAL_EMOTION_LOG = { Ansiedade: 9, Cansaço: 7, Calma: 6, Tristeza: 4, Gratidão: 4, Irritação: 3, Alegria: 3, Medo: 2, Alívio: 1 };

export const INITIAL_MEDS = [
  { id: 1, name: 'Sertralina 50 mg', time: '08:00', instr: '1 comprimido · em jejum', by: 'psiquiatra' },
  { id: 2, name: 'Vitamina D 2.000 UI', time: '12:00', instr: '1 cápsula · com o almoço', by: 'clínico geral' },
  { id: 3, name: 'Melatonina 3 mg', time: '22:30', instr: '1 comprimido · antes de dormir', by: 'psiquiatra' },
];

export const INITIAL_RX = [
  { id: 1, med: 'Melatonina 3 mg', date: '14/11/2026', file: 'receita-melatonina.pdf', status: 'Nova' },
  { id: 2, med: 'Sertralina 50 mg', date: '03/10/2026', file: 'receita-sertralina.jpg', status: 'Arquivada' },
];

// Habits are set by the psychologist. week = last 7 days, index 6 = today.
export const HABIT_ICONS = [['wind', 'Respiração'], ['walk', 'Atividade física'], ['moon', 'Sono'], ['book', 'Leitura/escrita'], ['heart', 'Autocuidado'], ['users', 'Social']];
export const INITIAL_HABITS = [
  { id: 1, icon: 'wind', name: 'Respiração guiada', detail: '5 min', freq: 'Todos os dias', reminder: '07:30', week: [1, 1, 1, 1, 1, 1, 1] },
  { id: 2, icon: 'walk', name: 'Caminhada', detail: '20 min', freq: '5 vezes por semana', reminder: '18:30', week: [1, 0, 1, 1, 0, 1, 0] },
  { id: 3, icon: 'moon', name: 'Dormir antes das 23h', detail: '', freq: 'Todos os dias', reminder: '22:15', week: [1, 0, 0, 1, 0, 1, 0] },
];
export const habitSub = (h, withReminder = true) => [h.detail, h.freq.toLowerCase(), withReminder && h.reminder && `lembrete às ${h.reminder}`].filter(Boolean).join(' · ');

// CID-10 codes the psychologist can assign. '' = not defined.
export const CIDS = [
  ['', 'Não definido'],
  ['F41.1', 'Ansiedade generalizada'],
  ['F41.0', 'Transtorno de pânico'],
  ['F41.2', 'Transtorno misto ansioso e depressivo'],
  ['F32.0', 'Episódio depressivo leve'],
  ['F32.1', 'Episódio depressivo moderado'],
  ['F33.1', 'Transtorno depressivo recorrente, episódio moderado'],
  ['F40.1', 'Fobia social'],
  ['F42', 'Transtorno obsessivo-compulsivo'],
  ['F43.1', 'Transtorno de estresse pós-traumático'],
  ['F43.2', 'Transtorno de adaptação'],
  ['F50.2', 'Bulimia nervosa'],
  ['F60.3', 'Transtorno de personalidade emocionalmente instável'],
  ['F90.0', 'TDAH'],
  ['Z73.0', 'Esgotamento (burnout)'],
];
export const cidLabel = (c) => CIDS.find(([k]) => k === c)?.[1] ?? c;

const m = (s) => s.split('').map(Number); // mood string "34432..." → [3,4,4,3,2,...]
// [id, name, age, status, last, next, appUse%, risk, mood14 | null, cid, mode]
const ROWS = [
  ['luiz', 'Luiz Mendonça', 34, 'Ativo', '12/11', '19/11 · 18:00', 92, 'Baixo', '34434432323223', 'F41.1', 'Online'],
  ['camila', 'Camila Rocha', 32, 'Ativa', '12/11', '19/11 · 18:00', 92, 'Baixo', '34434432323223', 'F41.1', 'Online'],
  ['rafael', 'Rafael Nunes', 41, 'Ativo', '09/11', 'Hoje · 10:00', 64, 'Moderado', '22323323332333', 'F32.1', 'Presencial'],
  ['beatriz', 'Beatriz Lima', 27, 'Ativa', '10/11', 'Hoje · 14:00', 88, 'Baixo', '33444344544454', 'F40.1', 'Online'],
  ['juliana', 'Juliana Prado', 29, 'Ativa', '13/11', '20/11 · 09:00', 75, 'Baixo', '43344343443444', 'F43.2', 'Presencial'],
  ['lucas', 'Lucas Ferreira', 46, 'Ativo', '11/11', 'Hoje · 16:00', 53, 'Não definido', '32332332333233', '', 'Online'],
  ['ana', 'Ana Clara Souza', 24, 'Ativa', '—', 'Hoje · 17:00', 0, 'Não definido', null, '', 'Presencial'],
  ['pedro', 'Pedro Henrique Dias', 38, 'Ativo', '09/11', 'Hoje · 19:00', 71, 'Baixo', '33343344343434', 'Z73.0', 'Online'],
  ['gustavo', 'Gustavo Reis', 52, 'Ativo', '10/11', '17/11 · 09:00', 46, 'Moderado', '22232232322323', 'F33.1', 'Presencial'],
  ['sofia', 'Sofia Martins', 19, 'Ativa', '10/11', '17/11 · 11:00', 95, 'Baixo', '34444454445444', 'F90.0', 'Online'],
  ['marcos', 'Marcos Vieira', 44, 'Ativo', '10/11', '17/11 · 18:00', 38, 'Moderado', '22322232233232', 'F43.1', 'Presencial'],
  ['fernanda', 'Fernanda Lopes', 35, 'Ativa', '11/11', '18/11 · 08:00', 82, 'Baixo', '33434434443443', 'F41.0', 'Presencial'],
  ['bruno', 'Bruno Castro', 31, 'Ativo', '11/11', '18/11 · 10:00', 67, 'Baixo', '33333434333434', 'F41.2', 'Online'],
  ['larissa', 'Larissa Melo', 26, 'Ativa', '11/11', '18/11 · 18:00', 90, 'Alto', '21222122212112', 'F60.3', 'Presencial'],
  ['diego', 'Diego Santos', 33, 'Ativo', '12/11', '19/11 · 10:00', 58, 'Baixo', '34333433343343', 'F42', 'Presencial'],
  ['vinicius', 'Vinícius Araújo', 28, 'Ativo', '12/11', '19/11 · 16:00', 79, 'Baixo', '33444343444434', 'F32.0', 'Online'],
  ['renata', 'Renata Alves', 47, 'Ativa', '13/11', '20/11 · 11:00', 61, 'Moderado', '23232323322332', 'F50.2', 'Presencial'],
  ['carolina', 'Carolina Teixeira', 36, 'Ativa', '06/11', '23/11 · 15:00', 73, 'Baixo', '33343443434443', 'F41.1', 'Online'],
  ['eduardo', 'Eduardo Pires', 58, 'Ativo', '05/11', '26/11 · 10:00', 22, 'Não definido', '33233323', 'F43.2', 'Presencial'],
  ['isabela', 'Isabela Cardoso', 22, 'Ativa', '07/11', '21/11 · 14:00', 86, 'Baixo', '44344454444454', 'F40.1', 'Online'],
  ['mateus', 'Mateus Ribeiro', 30, 'Ativo', '04/11', '25/11 · 19:00', 49, 'Baixo', '33323333433333', '', 'Online'],
  ['patricia', 'Patrícia Gomes', 50, 'Ativa', '03/11', '24/11 · 09:00', 69, 'Baixo', '34343443443434', 'F32.0', 'Presencial'],
  ['thiago', 'Thiago Moreira', 35, 'Em pausa', '21/10', '—', 12, 'Não definido', null, 'F43.2', 'Online'],
  ['leticia', 'Letícia Barros', 40, 'Em pausa', '14/10', '—', 0, 'Baixo', null, 'F41.1', 'Presencial'],
  ['rodrigo', 'Rodrigo Nascimento', 43, 'Alta', '30/10', '—', 0, 'Baixo', null, 'F43.2', 'Online'],
];
const RICH = ['camila', 'luiz']; // demo patients with a full plan
const DEFAULT_HABITS = [{ id: 1, icon: 'wind', name: 'Respiração guiada', detail: '5 min', freq: 'Todos os dias', reminder: '08:00', week: [1, 0, 1, 1, 0, 1, 0] }];
export const INITIAL_PATIENTS = ROWS.map(([id, name, age, status, last, next, use, risk, mood, cid, mode]) => ({
  id, name, age, status, last, next, use, risk, mood: mood && m(mood), cid, mode,
  perms: { ...INITIAL_PERMS },
  habits: RICH.includes(id) ? INITIAL_HABITS : DEFAULT_HABITS,
  meds: RICH.includes(id) ? INITIAL_MEDS : [],
  rx: RICH.includes(id) ? INITIAL_RX : [],
  waterGoal: 2000,
}));
export const ME = 'luiz'; // patient record shown in the patient app demo (linked to the logged-in patient)


// Settings (Configurações). Account data is demo data, CPF masked on screen.
export const ACCENTS = [['#5b4fe0', 'Violeta'], ['#2f6fd6', 'Azul'], ['#2f7a5b', 'Verde'], ['#c2457a', 'Rosa'], ['#b8621b', 'Âmbar']];
export const INITIAL_PATIENT_PREFS = {
  theme: 'light', accent: '#5b4fe0', text: 'normal', colorblind: false,
  quiet: true, hideNotif: true, lock: false, swipe: true,
  account: { name: 'Luiz Mendonça', email: 'luiz.mendonca@gmail.com', phone: '(62) 99812-4471', cpf: '***.482.917-**', birth: '14/03/1992' },
};
export const INITIAL_PANEL_PREFS = {
  theme: 'light', accent: '#5b4fe0', compact: false, home: 'painel', sessionMin: 50, price: 200,
  notif: { receitas: true, ciencia: true, humor: true, diario: false },
  defaultPerms: { ...INITIAL_PERMS },
  account: { name: 'Débora Mendonça', crp: 'CRP 09/[NÚMERO]', email: 'debora@consultorio-exemplo.com', phone: '(62) 3241-0090', doc: 'CNPJ 12.345.678/0001-90', address: 'Av. T-63, 1200, sala 804 · Goiânia/GO' },
};

export const INITIAL_SLEEP = {
  [-1]: { bed: '23:40', wake: '06:50', q: 2, wakeups: 2 },
  [-2]: { bed: '00:10', wake: '07:00', q: 3, wakeups: 1 },
  [-3]: { bed: '23:20', wake: '06:40', q: 2, wakeups: 2 },
  [-4]: { bed: '22:50', wake: '06:45', q: 4, wakeups: 0 },
  [-5]: { bed: '23:00', wake: '07:10', q: 4, wakeups: 0 },
};

export const fmtL = (ml) => `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`;

// Notas fiscais: issued outside KiWave (prefeitura/contador); the psychologist uploads the PDF. ack = date the patient confirmed.
export const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nf = (id, n, pid, name, comp, sessions, value, sent, ack) => ({ id, n, pid, name, comp, sessions, value, sent, ack, file: `nfse-${n}.pdf` });
export const INITIAL_NOTAS = [
  nf(8, '000188', 'luiz', 'Luiz Mendonça', 'Outubro/2026', 4, 800, '31/10/2026', null),
  nf(9, '000162', 'luiz', 'Luiz Mendonça', 'Setembro/2026', 4, 800, '30/09/2026', '01/10/2026'),
  nf(1, '000184', 'camila', 'Camila Rocha', 'Outubro/2026', 4, 800, '31/10/2026', null),
  nf(2, '000186', 'rafael', 'Rafael Nunes', 'Outubro/2026', 4, 800, '31/10/2026', '02/11/2026'),
  nf(3, '000185', 'beatriz', 'Beatriz Lima', 'Outubro/2026', 4, 720, '31/10/2026', null),
  nf(4, '000183', 'lucas', 'Lucas Ferreira', 'Outubro/2026', 5, 1000, '31/10/2026', '01/11/2026'),
  nf(5, '000182', 'juliana', 'Juliana Prado', 'Outubro/2026', 4, 800, '31/10/2026', null),
  nf(6, '000161', 'camila', 'Camila Rocha', 'Setembro/2026', 4, 800, '30/09/2026', '01/10/2026'),
  nf(7, '000139', 'camila', 'Camila Rocha', 'Agosto/2026', 5, 1000, '31/08/2026', '02/09/2026'),
];

// Document templates. {{campo}} is replaced when the document is filled (see fillDoc).
export const PLACEHOLDERS = [
  ['paciente', 'Nome do paciente'], ['cpf_paciente', 'CPF do paciente'], ['data', 'Data (dd/mm/aaaa)'], ['data_extenso', 'Data por extenso'],
  ['horario', 'Horário da sessão'], ['psicologa', 'Seu nome'], ['crp', 'Seu CRP'], ['cidade', 'Cidade'], ['valor', 'Valor'], ['cid', 'CID do paciente'],
];
const T = (id, name, kind, body) => ({ id, name, kind, body, custom: false });
export const INITIAL_TEMPLATES = [
  T('declaracao', 'Declaração', 'Declaração', 'Declaro, para os devidos fins, que {{paciente}} compareceu a atendimento psicológico no dia {{data_extenso}}, das {{horario}}.'),
  T('atestado', 'Atestado psicológico', 'Atestado', 'Atesto, para os devidos fins, que {{paciente}}, CPF {{cpf_paciente}}, encontra-se em acompanhamento psicológico comigo e necessita de afastamento de suas atividades por ___ dias, a partir de {{data}}, por motivo de saúde.'),
  T('relatorio', 'Relatório psicológico', 'Relatório', 'IDENTIFICAÇÃO\nAutora: {{psicologa}}, {{crp}}.\nInteressado: {{paciente}}.\nAssunto: ___\n\nDESCRIÇÃO DA DEMANDA\n___\n\nPROCEDIMENTO\nAtendimentos semanais de 50 minutos, com acompanhamento de registros diários pelo app KiWave.\n\nANÁLISE\n___\n\nCONCLUSÃO\n___'),
  T('laudo', 'Laudo psicológico', 'Laudo', 'IDENTIFICAÇÃO\nAutora: {{psicologa}}, {{crp}}.\nInteressado: {{paciente}}.\nFinalidade: ___\n\nDESCRIÇÃO DA DEMANDA\n___\n\nPROCEDIMENTOS\n___\n\nANÁLISE\n___\n\nCONCLUSÃO\n___'),
  T('parecer', 'Parecer psicológico', 'Parecer', 'IDENTIFICAÇÃO\nParecerista: {{psicologa}}, {{crp}}.\nSolicitante: ___\n\nEXPOSIÇÃO DE MOTIVOS\n___\n\nANÁLISE\n___\n\nCONCLUSÃO\n___'),
  T('recibo', 'Recibo', 'Recibo', 'Recebi de {{paciente}}, CPF {{cpf_paciente}}, a importância de {{valor}}, referente a sessões de psicoterapia realizadas no período de ___.'),
];

const D = (id, tpl, pid, name, date, status, delivery, body, title) => ({ id, tpl, pid, name, date, status, delivery, body, title, code: status === 'Assinado' ? `KW-${(id * 7919).toString(36).toUpperCase().padStart(4, 'X')}-${(id * 104729).toString(36).toUpperCase().slice(-4)}` : null });
export const INITIAL_DOCS = [
  D(9, 'declaracao', 'luiz', 'Luiz Mendonça', '12/11/2026', 'Assinado', 'No app', 'Declaro, para os devidos fins, que Luiz Mendonça compareceu a atendimento psicológico no dia 12 de novembro de 2026, das 18h00 às 18h50.', 'Declaração de comparecimento'),
  D(1, 'declaracao', 'camila', 'Camila Rocha', '12/11/2026', 'Assinado', 'No app', 'Declaro, para os devidos fins, que Camila Rocha compareceu a atendimento psicológico no dia 12 de novembro de 2026, das 18h00 às 18h50.', 'Declaração de comparecimento'),
  D(2, 'relatorio', 'rafael', 'Rafael Nunes', '14/11/2026', 'Para assinar', '—', 'IDENTIFICAÇÃO\nAutora: Débora Mendonça, CRP 09/[NÚMERO].\nInteressado: Rafael Nunes.\nAssunto: acompanhamento psicológico solicitado pelo médico assistente.\n\nDESCRIÇÃO DA DEMANDA\nHumor deprimido há cerca de oito meses, com perda de interesse e alteração do sono.\n\nPROCEDIMENTO\n23 atendimentos semanais de 50 minutos e registros diários pelo app KiWave.\n\nANÁLISE\nMelhora gradual do humor (PHQ-9 de 18 para 13). Adesão irregular aos registros de medicação.\n\nCONCLUSÃO\nIndica-se a continuidade do acompanhamento psicológico semanal.', 'Relatório psicológico'),
  D(3, 'declaracao', 'lucas', 'Lucas Ferreira', '16/11/2026', 'Para assinar', '—', 'Declaro, para os devidos fins, que Lucas Ferreira compareceu a atendimento psicológico no dia 11 de novembro de 2026, das 16h00 às 16h50.', 'Declaração de comparecimento'),
  D(4, 'laudo', 'thiago', 'Thiago Moreira', '30/10/2026', 'Assinado', 'Por e-mail', 'IDENTIFICAÇÃO\nAutora: Débora Mendonça, CRP 09/[NÚMERO].\nInteressado: Thiago Moreira.\nFinalidade: instruir pedido de afastamento.\n\nCONCLUSÃO\nQuadro compatível com transtorno de adaptação, em acompanhamento.', 'Laudo psicológico'),
  D(5, 'atestado', 'camila', 'Camila Rocha', '28/10/2026', 'Assinado', 'No app', 'Atesto, para os devidos fins, que Camila Rocha encontra-se em acompanhamento psicológico comigo e necessitou de afastamento de suas atividades no dia 28/10/2026, por motivo de saúde.', 'Atestado psicológico'),
  D(6, 'recibo', 'camila', 'Camila Rocha', '31/10/2026', 'Assinado', 'No app', 'Recebi de Camila Rocha a importância de R$ 800,00 (oitocentos reais), referente a 4 sessões de psicoterapia realizadas em outubro de 2026.', 'Recibo das sessões · outubro'),
  D(7, 'relatorio', 'camila', 'Camila Rocha', '15/11/2026', 'Rascunho da IA', '—', 'IDENTIFICAÇÃO\nAutora: Débora Mendonça, CRP 09/[NÚMERO].\nInteressado: Camila Rocha.\nAssunto: evolução mensal de outubro.\n\nANÁLISE\nHumor médio no app de 3,6 em outubro. Respiração guiada feita todos os dias. GAD-7 em 10 (leve).\n\nCONCLUSÃO\nEvolução favorável; manter frequência semanal.', 'Evolução mensal · outubro'),
  D(8, 'parecer', 'juliana', 'Juliana Prado', '08/11/2026', 'Rascunho', '—', 'IDENTIFICAÇÃO\nParecerista: Débora Mendonça, CRP 09/[NÚMERO].\nSolicitante: ___\n\nANÁLISE\n___', 'Parecer psicológico'),
];
export const REPORT_KINDS = ['relatorio', 'laudo', 'parecer'];

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const TODAY_STR = '16/11/2026';
export function fillDoc(body, { patient, account, price }) {
  const [d, mo, y] = TODAY_STR.split('/');
  const map = {
    paciente: patient?.name ?? '___', cpf_paciente: patient?.cpf ?? '___', cid: patient?.cid || '___',
    data: TODAY_STR, data_extenso: `${+d} de ${MONTHS_PT[+mo - 1]} de ${y}`, horario: '18h00 às 18h50',
    psicologa: account.name, crp: account.crp, cidade: 'Goiânia', valor: brl(price ?? 200),
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => map[k] ?? m);
}

// Sessions in the agenda. day: 0 = Mon 16/11 … 4 = Fri 20/11 (repeats weekly). kind: in | on | first | g
const E = (id, day, start, dur, title, sub, kind, pid) => ({ id, day, start, dur, title, sub, kind, pid });
export const INITIAL_EVENTS = [
  E(1, 0, 10, 1, 'Rafael Nunes', 'Presencial', 'in', 'rafael'), E(2, 0, 12, 1, 'Almoço', 'Google Agenda', 'g'), E(3, 0, 14, 1, 'Beatriz Lima', 'Online', 'on', 'beatriz'),
  E(4, 0, 16, 1, 'Lucas Ferreira', 'Online', 'on', 'lucas'), E(5, 0, 17, 1, 'Ana Clara Souza', '1ª sessão', 'first', 'ana'), E(6, 0, 19, 1, 'Pedro Henrique Dias', 'Online', 'on', 'pedro'),
  E(7, 1, 9, 1, 'Gustavo Reis', 'Presencial', 'in', 'gustavo'), E(8, 1, 11, 1, 'Sofia Martins', 'Online', 'on', 'sofia'), E(9, 1, 15, 1.5, 'Supervisão clínica', 'Google Agenda', 'g'), E(10, 1, 18, 1, 'Marcos Vieira', 'Presencial', 'in', 'marcos'),
  E(11, 2, 8, 1, 'Fernanda Lopes', 'Presencial', 'in', 'fernanda'), E(12, 2, 10, 1, 'Bruno Castro', 'Online', 'on', 'bruno'), E(13, 2, 14, 2, 'Bloqueio · estudo', 'Google Agenda', 'g'), E(14, 2, 18, 1, 'Larissa Melo', 'Presencial', 'in', 'larissa'),
  E(15, 3, 10, 1, 'Diego Santos', 'Presencial', 'in', 'diego'), E(16, 3, 16, 1, 'Vinícius Araújo', 'Online', 'on', 'vinicius'), E(17, 3, 18, 1, 'Camila Rocha', 'Online · 3 assuntos', 'on', 'camila'),
  E(18, 4, 9, 1, 'Juliana Prado', 'Presencial', 'in', 'juliana'), E(19, 4, 11, 1, 'Renata Alves', 'Presencial', 'in', 'renata'), E(20, 4, 13, 1.5, 'Compromisso pessoal', 'Google Agenda', 'g'),
];
