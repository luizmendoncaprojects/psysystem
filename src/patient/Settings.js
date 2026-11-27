import { useState } from 'react';
import { Icon, Avatar, Segmented, Toggle, MoodFace, Modal, toast } from '../ui';
import { ACCENTS } from '../data';

const CUPS = [150, 200, 250, 300, 400, 500];

export default function Settings({ prefs, setPrefs, onBack, onLogout }) {
  const set = (patch) => setPrefs((cur) => ({ ...cur, ...patch })); // functional: rapid changes must not overwrite each other
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prefs.account);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exported, setExported] = useState(false);
  const [sheet, setSheet] = useState(null); // terms | logout
  const a = prefs.account;

  return (
    <>
      <header className="p-head back-head">
        <button className="icon-btn bordered" aria-label="Voltar" onClick={onBack}><Icon name="chevL" size={18} /></button>
        <h1 className="p-title grow">Perfil e configurações</h1>
      </header>

      <section className="card">
        <div className="row gap12">
          <Avatar name={a.name} size={52} tone={2} />
          <div className="grow"><p className="row-title">{a.name}</p><p className="muted sm">{a.email}</p></div>
          {!editing && <button className="btn-secondary sm-btn" onClick={() => { setDraft(a); setEditing(true); }}><Icon name="edit" size={14} /> Editar</button>}
        </div>
        {editing ? (
          <form className="acc-form" onSubmit={(e) => { e.preventDefault(); set({ account: draft }); setEditing(false); toast('Dados salvos'); }}>
            <label className="field">Nome<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
            <label className="field">E-mail<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required /></label>
            <label className="field">Telefone<input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
            <div className="row gap8 form-actions"><button type="button" className="btn-secondary sm-btn" onClick={() => setEditing(false)}>Cancelar</button><button className="btn-primary sm-btn">Salvar</button></div>
          </form>
        ) : (
          <dl className="acc-list">
            <div><dt>Telefone</dt><dd>{a.phone}</dd></div>
            <div><dt>CPF</dt><dd>{a.cpf}</dd></div>
            <div><dt>Nascimento</dt><dd>{a.birth}</dd></div>
            <div><dt>Psicóloga</dt><dd>Débora Mendonça · CRP 09/[NÚMERO]</dd></div>
            <div><dt>Em acompanhamento desde</dt><dd>março de 2025</dd></div>
          </dl>
        )}
      </section>

      <p className="section-label">Registros</p>
      <section className="card set-list">
        <div className="set-row col">
          <span className="row gap8"><Icon name="drop" size={18} /> Tamanho do seu copo</span>
          <Segmented small options={CUPS.map((ml) => [ml, `${ml} ml`])} value={prefs.cupMl ?? 250} onChange={(v) => set({ cupMl: v })} />
          <p className="xs muted">Cada toque em “Copo” soma esta quantidade de água.</p>
        </div>
      </section>

      <p className="section-label">Aparência</p>
      <section className="card set-list">
        <div className="set-row col">
          <span className="row gap8"><Icon name="sun" size={18} /> Tema</span>
          <Segmented small options={[['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']]} value={prefs.theme} onChange={(v) => set({ theme: v })} />
        </div>
        <div className="set-row col">
          <span className="row gap8"><Icon name="palette" size={18} /> Cor do app</span>
          <div className="swatches" role="radiogroup" aria-label="Cor do app">
            {ACCENTS.map(([c, l]) => (
              <button key={c} role="radio" aria-checked={prefs.accent === c} aria-label={l} className={prefs.accent === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ accent: c })}>
                {prefs.accent === c && <Icon name="check" size={14} stroke={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row col">
          <span>Tamanho do texto</span>
          <Segmented small options={[['normal', 'Normal'], ['large', 'Grande']]} value={prefs.text} onChange={(v) => set({ text: v })} />
        </div>
        <div className="set-row">
          <div className="grow"><span>Cores para daltonismo</span><p className="xs muted">Troca a escala vermelho–verde por laranja–azul</p></div>
          <Toggle label="Cores para daltonismo" on={prefs.colorblind} onChange={(v) => set({ colorblind: v })} />
        </div>
        <div className="mood-preview" aria-hidden="true">{[1, 2, 3, 4, 5].map((v) => <MoodFace key={v} v={v} size={28} />)}</div>
        <div className="set-row">
          <div className="grow"><span>Deslizar para trocar de aba</span><p className="xs muted">Passe o dedo para o lado para ir à próxima aba</p></div>
          <Toggle label="Deslizar para trocar de aba" on={prefs.swipe} onChange={(v) => set({ swipe: v })} />
        </div>
      </section>

      <p className="section-label">Notificações e privacidade</p>
      <section className="card set-list">
        <div className="set-row">
          <div className="grow"><span>Silêncio noturno</span><p className="xs muted">Sem lembretes entre 22h e 7h, exceto remédios</p></div>
          <Toggle label="Silêncio noturno" on={prefs.quiet} onChange={(v) => set({ quiet: v })} />
        </div>
        <div className="set-row">
          <div className="grow"><span>Ocultar texto nas notificações</span><p className="xs muted">Mostra só “KiWave: você tem um lembrete”</p></div>
          <Toggle label="Ocultar texto nas notificações" on={prefs.hideNotif} onChange={(v) => set({ hideNotif: v })} />
        </div>
        <div className="set-row">
          <div className="grow"><span>Bloquear com senha ou biometria</span><p className="xs muted">Pede ao abrir o app</p></div>
          <Toggle label="Bloquear com senha ou biometria" on={prefs.lock} onChange={(v) => set({ lock: v })} />
        </div>
      </section>

      <p className="section-label">Seus dados</p>
      <section className="card set-list">
        <button className="set-row link-row" onClick={() => { setExported(true); toast('Seus dados serão enviados para ' + a.email); }}>
          <Icon name="download" size={18} /><span className="grow">Exportar meus dados</span>
          {exported ? <span className="chip chip-ok">Enviado por e-mail</span> : <Icon name="chevR" size={16} />}
        </button>
        <button className="set-row link-row" onClick={() => setSheet('terms')}><Icon name="shield" size={18} /><span className="grow">Termos e política de privacidade</span><Icon name="chevR" size={16} /></button>
        <button className="set-row link-row" onClick={() => setSheet('logout')}><Icon name="logout" size={18} /><span className="grow">Sair da conta</span></button>
        {confirmDelete ? (
          <div className="danger-box">
            <p className="sm"><strong>Excluir a conta apaga seus registros do app.</strong> Documentos e notas fiscais continuam com a sua psicóloga, como exige a lei. Não dá para desfazer.</p>
            <div className="row gap8 mt8"><button className="btn-secondary sm-btn" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn-danger sm-btn" onClick={() => { setConfirmDelete(false); toast('No app real, a conta seria excluída. No protótipo, nada foi apagado.', 'warn'); }}>Excluir conta</button></div>
          </div>
        ) : (
          <button className="set-row link-row danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} /><span className="grow">Excluir conta</span></button>
        )}
      </section>
      {sheet === 'terms' && (
        <Modal sheet title="Termos e privacidade" onClose={() => setSheet(null)} footer={<button className="btn-primary" onClick={() => setSheet(null)}>Entendi</button>}>
          <p className="sm"><b>O que coletamos:</b> os registros que você faz no app (humor, emoções, sono, água, hábitos, remédios, diário) e os documentos que sua psicóloga envia.</p>
          <p className="sm"><b>Quem vê:</b> só você e a sua psicóloga. Entradas do diário marcadas “Só eu” ficam só com você.</p>
          <p className="sm"><b>Seus direitos (LGPD):</b> ver, corrigir, exportar e excluir seus dados a qualquer momento, aqui nas configurações.</p>
          <p className="sm"><b>Não vendemos</b> nem compartilhamos dados com anunciantes.</p>
        </Modal>
      )}
      {sheet === 'logout' && (
        <Modal sheet title="Sair da conta?" sub="Seus registros continuam salvos." onClose={() => setSheet(null)}
          footer={<><button className="btn-secondary" onClick={() => setSheet(null)}>Cancelar</button><button className="btn-primary" onClick={() => { setSheet(null); onLogout(); }}>Sair</button></>}>
          <p className="sm">Para entrar de novo, use seu e-mail e o código que enviamos.</p>
        </Modal>
      )}
      <p className="hint center">KiWave 1.0 · seus dados ficam com a sua psicóloga e não são vendidos.</p>
    </>
  );
}
