import { useEffect, useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, PageHead, Modal, toast } from '../ui';
import { ACCENTS, FEATURES } from '../data';
import { api } from '../api';
import { GoogleSync } from './Panel';

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

// [key, label, icon]
const SECTIONS = [
  ['conta', 'Conta', 'user'],
  ['aparencia', 'Aparência', 'palette'],
  ['atendimento', 'Atendimento', 'clock'],
  ['calendario', 'Calendário', 'calendar'],
  ['certificado', 'Certificado digital', 'shield'],
  ['notificacoes', 'Notificações', 'bell'],
  ['pacientes', 'Pacientes novos', 'users'],
  ['seguranca', 'Dados e segurança', 'lock'],
];

export default function PanelSettings({ store, prefs, setPrefs, onLogout }) {
  const set = (patch) => setPrefs((cur) => ({ ...cur, ...patch })); // functional: rapid changes must not overwrite each other
  const [sec, setSec] = useState('conta');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prefs.account);
  const [exported, setExported] = useState(false);
  const [logout, setLogout] = useState(false);
  const [sessions, setSessions] = useState(2);
  const a = prefs.account;
  const field = (k, label, type = 'text') => (
    <label className="field">{label}<input type={type} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>
  );

  return (
    <>
      <PageHead title="Perfil e configurações" sub="Seus dados, aparência do painel e padrões do consultório" />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções das configurações">
          {SECTIONS.map(([k, l, i]) => (
            <button key={k} className={sec === k ? 'on' : ''} aria-current={sec === k ? 'page' : undefined} onClick={() => setSec(k)}>
              <Icon name={i} size={16} /> {l}
            </button>
          ))}
        </nav>

        <div className="stack">
          {sec === 'conta' && (
            <section className="panel">
              <div className="panel-head">
                <div className="row gap12"><Avatar name={a.name} size={52} tone={4} /><div><h2 className="h3">{a.name}</h2><p className="muted sm">Psicóloga · {a.crp}</p></div></div>
                {!editing && <button className="btn-secondary sm-btn" onClick={() => { setDraft(a); setEditing(true); }}><Icon name="edit" size={14} /> Editar</button>}
              </div>
              {editing ? (
                <form className="acc-form" onSubmit={(e) => { e.preventDefault(); set({ account: draft }); setEditing(false); toast('Dados da conta salvos'); }}>
                  {field('name', 'Nome')}{field('crp', 'Registro profissional')}{field('email', 'E-mail', 'email')}{field('phone', 'Telefone', 'tel')}{field('doc', 'CPF ou CNPJ (notas fiscais)')}{field('address', 'Endereço do consultório')}
                  <div className="row gap8 form-actions"><button type="button" className="btn-secondary sm-btn" onClick={() => setEditing(false)}>Cancelar</button><button className="btn-primary sm-btn">Salvar</button></div>
                </form>
              ) : (
                <dl className="acc-list">
                  <div><dt>E-mail</dt><dd>{a.email}</dd></div>
                  <div><dt>Telefone</dt><dd>{a.phone}</dd></div>
                  <div><dt>Emissor das notas</dt><dd>{a.doc}</dd></div>
                  <div><dt>Consultório</dt><dd>{a.address}</dd></div>
                  <div><dt>Plano</dt><dd>KiWave Consultório · até 40 pacientes</dd></div>
                  <div><dt>Próxima cobrança</dt><dd>05/12/2026 · cartão final 4471</dd></div>
                </dl>
              )}
            </section>
          )}

          {sec === 'aparencia' && (
            <section className="panel">
              <h2 className="h3">Aparência</h2>
              <ul className="settings">
                <li><span>Tema</span><Segmented small options={[['light', 'Claro'], ['dark', 'Escuro']]} value={prefs.theme} onChange={(v) => set({ theme: v })} /></li>
                <li>
                  <span>Cor de destaque</span>
                  <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
                    {ACCENTS.map(([c, l]) => (
                      <button key={c} role="radio" aria-checked={prefs.accent === c} aria-label={l} className={prefs.accent === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ accent: c })}>
                        {prefs.accent === c && <Icon name="check" size={14} stroke={3} />}
                      </button>
                    ))}
                  </div>
                </li>
                <li><div><span>Modo compacto</span><p className="xs muted">Mais linhas por tela nas tabelas</p></div><Toggle label="Modo compacto" on={prefs.compact} onChange={(v) => set({ compact: v })} /></li>
                <li><span>Página inicial</span>
                  <select className="select" value={prefs.home} onChange={(e) => set({ home: e.target.value })} aria-label="Página inicial">
                    <option value="painel">Painel</option><option value="agenda">Agenda</option><option value="pacientes">Pacientes</option>
                  </select>
                </li>
              </ul>
            </section>
          )}

          {sec === 'atendimento' && (
            <section className="panel">
              <h2 className="h3">Atendimento</h2>
              <ul className="settings">
                <li><span>Duração padrão da sessão</span>
                  <select className="select" value={prefs.sessionMin} onChange={(e) => set({ sessionMin: +e.target.value })} aria-label="Duração padrão da sessão">
                    {[30, 40, 45, 50, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </li>
                <li><span>Valor padrão da sessão</span>
                  <div className="row gap8">
                    <button className="icon-btn bordered" aria-label="Diminuir valor" onClick={() => set({ price: Math.max(0, prefs.price - 10) })}><Icon name="minus" size={14} /></button>
                    <b className="tnum">{brl(prefs.price)}</b>
                    <button className="icon-btn bordered" aria-label="Aumentar valor" onClick={() => set({ price: prefs.price + 10 })}><Icon name="plus" size={14} /></button>
                  </div>
                </li>
              </ul>
            </section>
          )}

          {sec === 'calendario' && (
            <GoogleSync g={store.google} setG={store.setGoogle}
              reload={() => api.google.status().then((st) => store.setGoogle((g) => ({ ...g, status: 'ok', ...st })), () => store.setGoogle((g) => ({ ...g, status: 'offline' })))} />
          )}

          {sec === 'certificado' && <Certificate />}

          {sec === 'notificacoes' && (
            <section className="panel">
              <h2 className="h3">Notificações para você</h2>
              <ul className="settings">
                {[['receitas', 'Receita nova enviada por paciente'], ['ciencia', 'Paciente deu ciência em nota fiscal'], ['humor', 'Humor abaixo da média do paciente'], ['diario', 'Novo registro compartilhado no diário']].map(([k, l]) => (
                  <li key={k}><span>{l}</span><Toggle label={l} on={prefs.notif[k]} onChange={(v) => set({ notif: { ...prefs.notif, [k]: v } })} /></li>
                ))}
              </ul>
            </section>
          )}

          {sec === 'pacientes' && (
            <section className="panel">
              <h2 className="h3">Padrão para pacientes novos</h2>
              <p className="muted sm">Recursos do app ligados quando você cadastra um paciente. Depois dá para mudar em cada um.</p>
              <ul className="settings">
                {FEATURES.map(([k, l]) => (
                  <li key={k}><span>{l}</span><Toggle label={`Padrão: ${l}`} on={prefs.defaultPerms[k]} onChange={(v) => set({ defaultPerms: { ...prefs.defaultPerms, [k]: v } })} /></li>
                ))}
              </ul>
            </section>
          )}

          {sec === 'seguranca' && (
            <section className="panel">
              <h2 className="h3">Dados e segurança</h2>
              <ul className="settings">
                <li><div><span>Verificação em duas etapas</span><p className="xs muted">Código pelo app autenticador ao entrar</p></div><span className="chip chip-ok"><Icon name="shield" size={12} /> Ativa</span></li>
                <li><div><span>Sessões abertas</span><p className="xs muted">{sessions > 1 ? 'Este computador e mais 1 (celular · Safari)' : 'Só este computador'}</p></div><button className="btn-ghost-sm" disabled={sessions < 2} onClick={() => { setSessions(1); toast('Outras sessões encerradas'); }}>Encerrar outras</button></li>
                <li><div><span>Exportar dados do consultório</span><p className="xs muted">Pacientes, prontuários, documentos e notas</p></div>
                  {exported ? <span className="chip chip-ok">Link enviado por e-mail</span> : <button className="btn-secondary sm-btn" onClick={() => { setExported(true); toast('Exportação iniciada · o link chega por e-mail'); }}><Icon name="download" size={14} /> Exportar</button>}
                </li>
                <li><div><span>Sair</span></div><button className="btn-ghost-sm" onClick={() => setLogout(true)}><Icon name="logout" size={14} /> Sair da conta</button></li>
              </ul>
            </section>
          )}
        </div>
      </div>
      {logout && (
        <Modal title="Sair da conta?" sub="Você precisará entrar de novo com e-mail, senha e o código de verificação." onClose={() => setLogout(false)}
          footer={<><button className="btn-secondary" onClick={() => setLogout(false)}>Cancelar</button><button className="btn-primary" onClick={() => { setLogout(false); onLogout(); }}>Sair</button></>}>
          <p className="sm">Rascunhos de documentos já ficam salvos.</p>
        </Modal>
      )}
    </>
  );
}

/* ---------- Certificado digital (A1) ---------- */
const toBase64 = (file) => new Promise((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]); // drop the "data:...;base64," prefix
  r.onerror = () => bad(new Error('Não foi possível ler o arquivo.'));
  r.readAsDataURL(file);
});

function Certificate() {
  const [info, setInfo] = useState(undefined); // undefined = loading, null = none saved
  const [loadError, setLoadError] = useState('');
  const [file, setFile] = useState(null);
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [reveal, setReveal] = useState(null); // { login, error, shown }
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    api.certificate.get().then(({ certificate }) => setInfo(certificate), (e) => { setInfo(null); setLoadError(e.message); });
  }, []);

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !pass) { setError('Escolha o arquivo e digite a senha do certificado.'); return; }
    setBusy(true); setError('');
    try {
      const { certificate } = await api.certificate.upload(file.name, await toBase64(file), pass);
      setInfo(certificate); setFile(null); setPass(''); setReplacing(false);
      toast('Certificado salvo');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const doReveal = async (e) => {
    e.preventDefault();
    setReveal({ ...reveal, busy: true, error: '' });
    try { const { password } = await api.certificate.reveal(reveal.login); setReveal({ login: '', shown: password }); } catch (err) { setReveal({ ...reveal, busy: false, error: err.message }); }
  };
  const remove = async () => {
    try { await api.certificate.remove(); setInfo(null); setRemoving(false); toast('Certificado removido'); } catch (err) { toast(err.message, 'warn'); }
  };

  const expired = info?.validUntil && new Date(info.validUntil) < new Date();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2 className="h3">Certificado digital</h2><p className="muted sm">Certificado ICP-Brasil tipo A1 (.pfx ou .p12), usado para assinar documentos.</p></div>
      </div>
      {info === undefined && <p className="muted sm">Carregando…</p>}
      {loadError && <p className="field-err" role="alert">{loadError}</p>}

      {info && !replacing && (
        <>
          <dl className="acc-list">
            <div><dt>Titular</dt><dd>{info.subject}</dd></div>
            <div><dt>Emissor</dt><dd>{info.issuer || '—'}</dd></div>
            <div><dt>Válido até</dt><dd>{fmtDate(info.validUntil)} {expired ? <span className="chip chip-danger">Vencido</span> : <span className="chip chip-ok">Válido</span>}</dd></div>
            <div><dt>Arquivo</dt><dd>{info.fileName} · enviado em {fmtDate(info.uploadedAt)}</dd></div>
            <div><dt>Senha</dt><dd className="row gap8">
              <code className="cert-pass">{reveal?.shown ?? '••••••••••'}</code>
              {reveal?.shown
                ? <button className="btn-ghost-sm" onClick={() => setReveal(null)}><Icon name="eyeOff" size={14} /> Ocultar</button>
                : <button className="btn-ghost-sm" onClick={() => setReveal({ login: '' })}><Icon name="eye" size={14} /> Ver senha</button>}
            </dd></div>
          </dl>
          <div className="row gap8 mt12">
            <button className="btn-secondary sm-btn" onClick={() => setReplacing(true)}><Icon name="upload" size={14} /> Trocar certificado</button>
            <button className="btn-ghost-sm" onClick={() => setRemoving(true)}><Icon name="trash" size={14} /> Remover</button>
          </div>
        </>
      )}

      {info !== undefined && (!info || replacing) && (
        <form className="stack-12" onSubmit={upload} noValidate>
          <label className="field">Arquivo do certificado (.pfx ou .p12)
            <input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} />
          </label>
          <label className="field">Senha do certificado
            <span className="pass-row">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => { setPass(e.target.value); setError(''); }} autoComplete="off" />
              <button type="button" className="icon-btn" aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPass(!showPass)}><Icon name={showPass ? 'eyeOff' : 'eye'} size={16} /></button>
            </span>
          </label>
          {error && <p className="field-err" role="alert">{error}</p>}
          <p className="xs muted"><Icon name="lock" size={12} /> Arquivo e senha ficam criptografados. A senha só é mostrada de novo depois de você confirmar sua senha de login.</p>
          <div className="row gap8">
            {replacing && <button type="button" className="btn-secondary sm-btn" onClick={() => setReplacing(false)}>Cancelar</button>}
            <button className="btn-primary sm-btn" disabled={busy}>{busy ? 'Verificando…' : 'Salvar certificado'}</button>
          </div>
        </form>
      )}

      {reveal && !reveal.shown && (
        <Modal title="Ver senha do certificado" sub="Por segurança, confirme a senha que você usa para entrar no KiWave." onClose={() => setReveal(null)}
          footer={<><button className="btn-secondary" onClick={() => setReveal(null)}>Cancelar</button><button className="btn-primary" form="reveal-form" disabled={reveal.busy || !reveal.login}>{reveal.busy ? 'Confirmando…' : 'Mostrar senha'}</button></>}>
          <form id="reveal-form" onSubmit={doReveal}>
            <label className="field">Sua senha de login<input type="password" autoComplete="current-password" value={reveal.login} onChange={(e) => setReveal({ ...reveal, login: e.target.value, error: '' })} /></label>
            {reveal.error && <p className="field-err" role="alert">{reveal.error}</p>}
          </form>
        </Modal>
      )}
      {removing && (
        <Modal title="Remover certificado?" sub="O arquivo e a senha são apagados do KiWave. Para assinar de novo, será preciso enviar o certificado." onClose={() => setRemoving(false)}
          footer={<><button className="btn-secondary" onClick={() => setRemoving(false)}>Cancelar</button><button className="btn-primary" onClick={remove}>Remover</button></>}>
          <p className="sm">Documentos já assinados continuam válidos.</p>
        </Modal>
      )}
    </section>
  );
}
