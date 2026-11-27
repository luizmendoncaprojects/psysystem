import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';

const SESSIONS = {
  psicologa: { id: 'u-psi', role: 'psicologa', name: 'Débora Mendonça', email: 'deboramenpsi@gmail.com' },
  paciente: { id: 'u-pac', role: 'paciente', name: 'Luiz Mendonça', email: 'luiz.mendonca@gmail.com', patientId: 'luiz', psychologistId: 'u-psi' },
};
// Minimal fake API: routes map "METHOD /path" to [status, body].
const fakeApi = (routes) => jest.fn(async (url, opts = {}) => {
  const key = `${opts.method || 'GET'} ${url.replace(/\?.*$/, '')}`;
  const [status, body] = routes[key] ?? [404, { error: 'not found' }];
  return { ok: status < 400, status, json: async () => (typeof body === 'function' ? body(JSON.parse(opts.body || '{}')) : body) };
});

// Navigate like the browser does: change the path and fire popstate (App listens to it).
const go = (path) => act(() => { window.history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
const toPanel = () => go('/painel');
const toApp = () => go('/app');

beforeEach(() => { window.history.replaceState(null, '', '/app'); delete global.fetch; });

test('psychologist turns off Diário and it disappears from the patient app', () => {
  render(<App initialSessions={SESSIONS} />);
  expect(screen.getByRole('button', { name: 'Diário' })).toBeInTheDocument();
  toPanel();
  fireEvent.click(screen.getByRole('button', { name: /Pacientes/ }));
  fireEvent.change(screen.getByLabelText('Buscar por nome ou CID'), { target: { value: 'Luiz' } });
  fireEvent.click(screen.getByText('Luiz Mendonça'));
  fireEvent.click(screen.getByRole('tab', { name: 'Permissões do app' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Diário' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Assuntos da sessão' }));
  toApp();
  expect(screen.queryByRole('button', { name: 'Diário' })).not.toBeInTheDocument();
});

test('renders patient app and switches to panel', () => {
  render(<App initialSessions={SESSIONS} />);
  expect(screen.getByText('Olá, Luiz')).toBeInTheDocument();
  toPanel();
  expect(screen.getByText(/^(Bom dia|Boa tarde|Boa noite), Débora$/)).toBeInTheDocument();
});

test('swiping left moves to the next tab, swiping right goes back', () => {
  render(<App initialSessions={SESSIONS} />);
  const content = screen.getByTestId('patient-content');
  fireEvent.touchStart(content, { touches: [{ clientX: 300, clientY: 200 }] });
  fireEvent.touchEnd(content, { changedTouches: [{ clientX: 120, clientY: 210 }] });
  expect(screen.getByRole('button', { name: 'Humor' })).toHaveAttribute('aria-current', 'page');
  fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 200 }] });
  fireEvent.touchEnd(content, { changedTouches: [{ clientX: 300, clientY: 190 }] });
  expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');
  // mostly vertical drag is a scroll, not a swipe
  fireEvent.touchStart(content, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(content, { changedTouches: [{ clientX: 120, clientY: 400 }] });
  expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');
});

test('profile opens settings and dark theme applies to the phone', () => {
  render(<App initialSessions={SESSIONS} />);
  fireEvent.click(screen.getByRole('button', { name: 'Perfil e configurações' }));
  expect(screen.getByText('Perfil e configurações')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Escuro' }));
  expect(screen.getByLabelText('App do paciente')).toHaveClass('theme-dark');
});

test('psychologist uploads a PDF invoice and it shows up for the patient; non-PDF is refused', () => {
  render(<App initialSessions={SESSIONS} />);
  toPanel();
  fireEvent.click(screen.getByRole('button', { name: /Documentos e notas/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Notas fiscais' }));
  fireEvent.click(screen.getByRole('button', { name: /Enviar nota/ }));
  const input = screen.getByLabelText('PDF da nota fiscal');
  fireEvent.change(input, { target: { files: [new File(['x'], 'nota.png', { type: 'image/png' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('Envie a nota em PDF.');
  fireEvent.change(input, { target: { files: [new File(['%PDF'], 'nfse-000190.pdf', { type: 'application/pdf' })] } });
  fireEvent.change(screen.getByLabelText(/Nº da nota/), { target: { value: '000190' } });
  fireEvent.click(screen.getByRole('button', { name: /Enviar ao app do paciente/ }));
  toApp();
  fireEvent.click(screen.getByRole('button', { name: /^Mais: documentos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Documentos' }));
  expect(screen.getByText(/Nota 000190/)).toBeInTheDocument();
});


test('new patient: psychologist generates a link code without typing a name', async () => {
  global.fetch = fakeApi({
    'POST /api/patients': [201, () => ({ patient: { id: '7b1e2c3d-0000-4000-8000-000000000001', name: 'Novo paciente', linked: false, code: 'K7M2QX', link: 'http://localhost:3000/?codigo=K7M2QX#paciente', codeExpiresAt: '2026-12-03T00:00:00Z' } })],
  });
  render(<App initialSessions={SESSIONS} />);
  toPanel();
  fireEvent.click(screen.getByRole('button', { name: /Novo paciente/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Gerar código de vínculo' }));
  expect(await screen.findByText('K7M2QX')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir paciente' }));
  expect(screen.getByRole('heading', { name: 'Novo paciente' })).toBeInTheDocument();
  expect(screen.getByText(/Aguardando o paciente criar a conta/)).toBeInTheDocument();
});

test('document editor fills placeholders, signs and delivers to the patient app', () => {
  render(<App initialSessions={SESSIONS} />);
  toPanel();
  fireEvent.click(screen.getByRole('button', { name: /Documentos e notas/ }));
  fireEvent.click(screen.getByRole('button', { name: /Novo documento/ }));
  const text = screen.getByLabelText('Texto');
  fireEvent.change(text, { target: { value: 'Declaro que {{paciente}} esteve em atendimento em {{data}}.' } });
  expect(screen.getAllByText(`Declaro que Luiz Mendonça esteve em atendimento em ${new Date().toLocaleDateString('pt-BR')}.`).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Declaração de teste' } });
  fireEvent.click(screen.getByRole('button', { name: /Assinar e enviar ao app/ }));
  toApp();
  fireEvent.click(screen.getByRole('button', { name: /^Mais: documentos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Documentos' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Declarações' }));
  expect(screen.getByText('Declaração de teste')).toBeInTheDocument();
});

test('patient writes a diary entry in a modal and sends it to the session agenda', () => {
  render(<App initialSessions={SESSIONS} />);
  fireEvent.click(screen.getByRole('button', { name: 'Diário' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Caminhada boa' } });
  fireEvent.change(screen.getByLabelText('O que aconteceu'), { target: { value: 'Fui até o parque.' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Levar para a próxima sessão' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(screen.getByText('Fui até o parque.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Assuntos da sessão' }));
  expect(screen.getByText('Caminhada boa')).toBeInTheDocument();
});

test('patient logs in, enters the link code, confirms and reaches the app', async () => {
  const unlinked = { ...SESSIONS.paciente, psychologistId: null, patientId: null };
  global.fetch = fakeApi({
    'GET /api/auth/me': [401, { error: 'Sem sessão.' }],
    'POST /api/auth/login': [200, { user: unlinked }],
    'GET /api/link/preview': [200, { psychologistName: 'Débora Mendonça', patientName: 'Luiz Mendonça' }],
    'POST /api/link': [200, { user: SESSIONS.paciente, psychologistName: 'Débora Mendonça' }],
  });
  render(<App />);
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'luiz.mendonca@gmail.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'uma-senha-longa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  fireEvent.change(await screen.findByLabelText(/Código de vínculo/), { target: { value: 'k7m-2qx' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Débora Mendonça')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculo' }));
  expect(await screen.findByText('Olá, Luiz')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/link', expect.objectContaining({ body: JSON.stringify({ code: 'K7M2QX' }) }));
});

test('psychologist login shows the API error message', async () => {
  global.fetch = fakeApi({ 'GET /api/auth/me': [401, {}], 'POST /api/auth/login': [401, { error: 'E-mail ou senha incorretos.' }] });
  window.history.replaceState(null, '', '/painel');
  render(<App />);
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'deboramenpsi@gmail.com' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada-errada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  await waitFor(() => expect(screen.queryByText(/^(Bom dia|Boa tarde|Boa noite), Débora$/)).not.toBeInTheDocument());
});

test('real login (no demo data) starts with an empty panel and does not crash', async () => {
  global.fetch = fakeApi({
    'GET /api/auth/me': [200, { user: SESSIONS.psicologa }],
    'GET /api/patients': [200, { patients: [] }],
    'GET /api/google/status': [200, { configured: false, connected: false }],
  });
  window.history.replaceState(null, '', '/painel');
  render(<App />);
  expect(await screen.findByText(/Nenhuma sessão hoje/)).toBeInTheDocument();
  expect(screen.queryByText('Rafael Nunes')).not.toBeInTheDocument();
  for (const page of [/Agenda/, /Pacientes/, /Relatórios/, /Documentos e notas/, /Copilot/]) {
    fireEvent.click(screen.getAllByRole('button', { name: page })[0]);
  }
  expect(screen.getByText(/Copilot de evolução/)).toBeInTheDocument();
});
