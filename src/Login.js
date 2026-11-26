import { useState } from 'react';
import { Icon, toast } from './ui';
import { api } from './api';

const maskCpf = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskPhone = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2');

function Field({ label, error, children }) {
  return <label className="field">{label}{children}{error && <span className="field-err">{error}</span>}</label>;
}

function Password({ value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} required />
      <button type="button" className="pw-toggle" aria-label={show ? 'Esconder senha' : 'Mostrar senha'} onClick={() => setShow(!show)}><Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>
    </span>
  );
}

function LoginForm({ role, onLogin, onSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPsi = role === 'psicologa';
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Informe e-mail e senha.'); return; }
    setBusy(true); setError('');
    try { onLogin((await api.login(role, email, password)).user); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="login-form" onSubmit={submit} noValidate>
      <div>
        <p className="eyebrow">{isPsi ? 'Painel da psicóloga' : 'App do paciente'}</p>
        <h1 className="login-title">{isPsi ? 'Entre no consultório' : 'Que bom te ver'}</h1>
        <p className="muted sm">{isPsi ? 'Acesse agenda, pacientes e documentos.' : 'Entre para registrar seu dia.'}</p>
      </div>
      <Field label="E-mail"><input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="Senha"><Password value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn-primary block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" className="link center" onClick={() => toast('Recuperação de senha chega na próxima versão. Fale com o suporte.', 'warn')}>Esqueci minha senha</button>
      {!isPsi && <p className="sm center">Primeira vez aqui? <button type="button" className="link" onClick={onSignup}>Criar conta</button></p>}
      <p className="xs muted center row gap6 login-foot"><Icon name="lock" size={12} /> Seus dados de saúde ficam só com você e sua psicóloga</p>
    </form>
  );
}

function SignupForm({ onDone, onBack }) {
  const [d, setD] = useState({ name: '', email: '', phone: '', birth: '', cpf: '', password: '', password2: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, fn = (v) => v) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : fn(e.target.value) });
  const submit = async (e) => {
    e.preventDefault();
    if (d.password !== d.password2) { setError('As senhas não conferem.'); return; }
    setBusy(true); setError('');
    try { onDone((await api.signup({ name: d.name, email: d.email, phone: d.phone, birth: d.birth, cpf: d.cpf, password: d.password, consent: d.consent })).user); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="login-form" onSubmit={submit} noValidate>
      <div>
        <button type="button" className="link sm" onClick={onBack}><Icon name="chevL" size={14} /> Voltar</button>
        <h1 className="login-title">Criar conta</h1>
        <p className="muted sm">Depois você digita o código que sua psicóloga enviou.</p>
      </div>
      <Field label="Nome completo"><input autoComplete="name" value={d.name} onChange={set('name')} required /></Field>
      <Field label="E-mail"><input type="email" autoComplete="email" inputMode="email" value={d.email} onChange={set('email')} required /></Field>
      <div className="grid-2f">
        <Field label="Celular"><input type="tel" autoComplete="tel" inputMode="tel" placeholder="(62) 9…" value={d.phone} onChange={set('phone', maskPhone)} required /></Field>
        <Field label="Nascimento"><input type="date" autoComplete="bday" value={d.birth} onChange={set('birth')} required /></Field>
      </div>
      <Field label="CPF"><input inputMode="numeric" placeholder="000.000.000-00" value={d.cpf} onChange={set('cpf', maskCpf)} required /></Field>
      <Field label="Senha (mínimo 10 caracteres)"><Password value={d.password} onChange={set('password')} autoComplete="new-password" /></Field>
      <Field label="Repita a senha"><Password value={d.password2} onChange={set('password2')} autoComplete="new-password" /></Field>
      <label className="consent">
        <input type="checkbox" checked={d.consent} onChange={set('consent')} />
        <span className="sm">Li e aceito os termos. Autorizo o uso dos meus dados de saúde para o meu acompanhamento psicológico, compartilhados apenas com a psicóloga a quem eu me vincular (LGPD, art. 11).</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn-primary block" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
    </form>
  );
}

// Login (and sign-up for patients). Patient: inside the phone frame. Psychologist: split screen.
export default function Login({ role, onLogin }) {
  const [mode, setMode] = useState('login');
  if (role === 'paciente') {
    return (
      <div className="phone login-phone" aria-label="Entrar no app do paciente">
        <div className="phone-status"><span>09:41</span><span className="notch" /><span>5G ▮▮▮</span></div>
        <main className="phone-scroll">
          <div className="login-brand"><span className="brand-mark lg"><Icon name="logo" size={26} stroke={2.2} /></span><b>KiWave</b></div>
          {mode === 'login'
            ? <LoginForm role={role} onLogin={onLogin} onSignup={() => setMode('signup')} />
            : <SignupForm onDone={(u) => { toast('Conta criada'); onLogin(u); }} onBack={() => setMode('login')} />}
        </main>
      </div>
    );
  }
  return (
    <div className="login-desk">
      <aside className="login-hero">
        <div className="brand"><span className="brand-mark"><Icon name="logo" size={18} stroke={2.2} /></span> KiWave <span className="brand-sub">Consultório</span></div>
        <div>
          <h2 className="hero-title">Acompanhe cada paciente entre as sessões.</h2>
          <ul className="login-points">
            <li><Icon name="checks" size={16} /> Registros do app com consentimento do paciente</li>
            <li><Icon name="calendar" size={16} /> Agenda sincronizada com o Google</li>
            <li><Icon name="shield" size={16} /> Documentos assinados e entregues no app</li>
          </ul>
        </div>
        <p className="xs on-dark-muted">CID, risco e adesão ficam visíveis só para você.</p>
      </aside>
      <main className="login-main"><LoginForm role={role} onLogin={onLogin} /></main>
    </div>
  );
}

// Patient enters the code from the psychologist; confirms who they are linking to.
export function LinkScreen({ user, onLinked, onLogout }) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('codigo') ?? '');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const check = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { setPreview(await api.linkPreview(clean)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.link(clean);
      window.history.replaceState(null, '', `${window.location.pathname}#paciente`); // drop ?codigo from the URL
      toast(`Vinculado a ${r.psychologistName}`);
      onLinked(r.user);
    } catch (err) { setError(err.message); setPreview(null); } finally { setBusy(false); }
  };
  return (
    <div className="phone login-phone" aria-label="Vincular à psicóloga">
      <div className="phone-status"><span>09:41</span><span className="notch" /><span>5G ▮▮▮</span></div>
      <main className="phone-scroll">
        <div className="login-brand"><span className="brand-mark lg"><Icon name="logo" size={26} stroke={2.2} /></span><b>KiWave</b></div>
        <form className="login-form" onSubmit={check} noValidate>
          <div>
            <p className="eyebrow">Olá, {user.name.split(' ')[0]}</p>
            <h1 className="login-title">Vincule-se à sua psicóloga</h1>
            <p className="muted sm">Digite o código de 6 caracteres que ela enviou. Se você abriu o link dela, ele já está preenchido.</p>
          </div>
          <label className="field">Código de vínculo
            <input className="code-input" value={clean} onChange={(e) => { setCode(e.target.value); setPreview(null); }} autoComplete="one-time-code" autoCapitalize="characters" spellCheck="false" maxLength={8} placeholder="7F3K2A" aria-describedby="code-help" />
            <span id="code-help" className="xs muted">Letras e números, sem 0, O, 1 ou I.</span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {preview ? (
            <div className="link-preview">
              <p className="sm">Você vai se vincular a</p>
              <p className="row-title">{preview.psychologistName}</p>
              <p className="xs muted">Cadastro dela: “{preview.patientName}”. Ela passa a ver os registros que você fizer no app.</p>
              <button type="button" className="btn-primary block mt12" disabled={busy} onClick={confirm}>{busy ? 'Vinculando…' : 'Confirmar vínculo'}</button>
            </div>
          ) : (
            <button className="btn-primary block" disabled={busy || clean.length !== 6}>{busy ? 'Verificando…' : 'Continuar'}</button>
          )}
          <button type="button" className="link center" onClick={onLogout}>Sair</button>
        </form>
      </main>
    </div>
  );
}
