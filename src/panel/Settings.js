import { useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, PageHead, Modal, toast } from '../ui';
import { ACCENTS, FEATURES } from '../data';

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PanelSettings({ prefs, setPrefs, onLogout }) {
  const set = (patch) => setPrefs((cur) => ({ ...cur, ...patch })); // functional: rapid changes must not overwrite each other
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
      <div className="settings-grid">
        <div className="stack">
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
        </div>

        <div className="stack">
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

          <section className="panel">
            <h2 className="h3">Notificações para você</h2>
            <ul className="settings">
              {[['receitas', 'Receita nova enviada por paciente'], ['ciencia', 'Paciente deu ciência em nota fiscal'], ['humor', 'Humor abaixo da média do paciente'], ['diario', 'Novo registro compartilhado no diário']].map(([k, l]) => (
                <li key={k}><span>{l}</span><Toggle label={l} on={prefs.notif[k]} onChange={(v) => set({ notif: { ...prefs.notif, [k]: v } })} /></li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2 className="h3">Padrão para pacientes novos</h2>
            <p className="muted sm">Recursos do app ligados quando você cadastra um paciente. Depois dá para mudar em cada um.</p>
            <ul className="settings">
              {FEATURES.map(([k, l]) => (
                <li key={k}><span>{l}</span><Toggle label={`Padrão: ${l}`} on={prefs.defaultPerms[k]} onChange={(v) => set({ defaultPerms: { ...prefs.defaultPerms, [k]: v } })} /></li>
              ))}
            </ul>
          </section>
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
