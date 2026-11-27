import { useRef, useState } from 'react';
import { Icon, Segmented, Chip, PageHead, Modal, toast, downloadText, usePaged, Pager } from '../ui';
import { PLACEHOLDERS, fillDoc, TODAY_STR, ME } from '../data';

const STATUS_KIND = { Assinado: 'ok', 'Para assinar': 'warn', Rascunho: 'quiet', 'Rascunho da IA': 'ai', 'Em revisão': 'warn' };
const makeCode = () => `KW-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const dateLong = (d) => {
  const M = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const [dd, mm, yy] = d.split('/');
  return `${+dd} de ${M[+mm - 1]} de ${yy}`;
};

/* ---------- Paper preview (also used by the patient app) ---------- */
export function DocPaper({ title, body, account, date = TODAY_STR, code, print }) {
  const blocks = body.split(/\n{2,}/);
  return (
    <div className={`paper ${print ? 'print-area' : ''}`}>
      <p className="paper-head">{account.name} · Psicóloga {account.crp}</p>
      <h3 className="paper-title">{(title || 'Documento').toUpperCase()}</h3>
      {blocks.map((b, i) => (
        <div key={i} className="paper-block">
          {b.split('\n').map((line, j) => (
            /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}$/.test(line.trim()) ? <p key={j} className="paper-h">{line}</p> : <p key={j}>{line || ' '}</p>
          ))}
        </div>
      ))}
      <p className="paper-place">Goiânia, {dateLong(date)}.</p>
      <div className="paper-sign"><span className="sig">{account.name}</span><p>Psicóloga · {account.crp}</p></div>
      {code
        ? <div className="paper-cert"><Icon name="shield" size={16} /><p>Assinado digitalmente em {date}<br />Certificado ICP-Brasil · código de verificação <code>{code}</code></p></div>
        : <div className="paper-cert draft"><Icon name="pen" size={16} /><p>Rascunho · ainda não assinado</p></div>}
    </div>
  );
}

/* ---------- Editor with live preview ---------- */
// start: { docId } to open an existing document, or { tpl, pid, title } for a new one.
export function DocEditor({ start, store, onClose }) {
  const { templates, docs, setDocs, patients, panelPrefs } = store;
  const existing = start.docId ? docs.find((d) => d.id === start.docId) : null;
  const firstTpl = templates.find((t) => t.id === (existing?.tpl ?? start.tpl)) ?? templates[0];
  const [tplId, setTplId] = useState(firstTpl.id);
  const [pid, setPid] = useState(existing?.pid ?? start.pid ?? (patients.some((p) => p.id === ME) ? ME : patients[0]?.id));
  const [title, setTitle] = useState(existing?.title ?? start.title ?? firstTpl.name);
  const [body, setBody] = useState(existing?.body ?? start.body ?? firstTpl.body);
  const ta = useRef(null);
  const locked = existing?.status === 'Assinado';
  const patient = patients.find((p) => p.id === pid);
  const ctx = { patient, account: panelPrefs.account, price: panelPrefs.price };
  const filled = fillDoc(body, ctx);
  const blanks = (filled.match(/___/g) || []).length;

  const pickTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    setTplId(id); setBody(t.body); setTitle(t.name);
  };
  const insert = (key) => {
    const el = ta.current;
    const tag = `{{${key}}}`;
    const at = el?.selectionStart ?? body.length;
    setBody(body.slice(0, at) + tag + body.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + tag.length, at + tag.length); });
  };
  const save = (status) => {
    if (!patient) { toast('Cadastre um paciente antes de emitir documentos.', 'warn'); return; }
    const doc = {
      id: existing?.id ?? Date.now(), tpl: tplId, pid, name: patient.name, date: TODAY_STR, title, body: filled, status,
      delivery: status === 'Assinado' ? 'No app' : '—', code: status === 'Assinado' ? makeCode() : null,
    };
    setDocs(existing ? docs.map((d) => (d.id === existing.id ? doc : d)) : [doc, ...docs]);
    toast(status === 'Assinado' ? `Assinado e enviado ao app de ${patient.name.split(' ')[0]}` : 'Rascunho salvo');
    onClose();
  };
  const newVersion = () => {
    const doc = { ...existing, id: Date.now(), status: 'Rascunho', delivery: '—', code: null, date: TODAY_STR, title: `${existing.title} (nova versão)` };
    setDocs([doc, ...docs]);
    toast('Nova versão criada como rascunho');
    onClose();
  };

  return (
    <Modal
      wide title={existing ? (locked ? 'Documento assinado' : 'Editar documento') : 'Novo documento'}
      sub={locked ? `Código ${existing.code} · não pode ser alterado` : 'O texto à esquerda vira o documento à direita. Campos entre {{ }} são preenchidos sozinhos.'}
      onClose={onClose}
      footer={locked ? (
        <>
          <button className="btn-secondary" onClick={() => window.print()}><Icon name="download" size={16} /> Baixar PDF</button>
          <button className="btn-primary" onClick={newVersion}><Icon name="copy" size={16} /> Criar nova versão</button>
        </>
      ) : (
        <>
          {blanks > 0 && <span className="foot-note"><Icon name="alert" size={14} /> {blanks} {blanks === 1 ? 'trecho' : 'trechos'} “___” para completar</span>}
          <button className="btn-secondary" onClick={() => window.print()}><Icon name="download" size={16} /> Baixar PDF</button>
          <button className="btn-secondary" onClick={() => save('Rascunho')}>Salvar rascunho</button>
          <button className="btn-primary" disabled={blanks > 0} onClick={() => save('Assinado')}><Icon name="pen" size={16} /> Assinar e enviar ao app</button>
        </>
      )}
    >
      <div className="editor">
        <div className="editor-left">
          <div className="grid-2f">
            <label className="field">Modelo
              <select className="select" value={tplId} disabled={locked} onChange={(e) => pickTemplate(e.target.value)}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.custom ? ' · seu modelo' : ''}</option>)}
              </select>
            </label>
            <label className="field">Paciente
              <select className="select" value={pid} disabled={locked} onChange={(e) => setPid(e.target.value)}>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Título<input value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} /></label>
          {!locked && (
            <div className="ph-chips" aria-label="Inserir campo automático">
              {PLACEHOLDERS.map(([k, l]) => <button key={k} type="button" className="ph-chip" title={l} onClick={() => insert(k)}>{`{{${k}}}`}</button>)}
            </div>
          )}
          <label className="field grow-area">Texto
            <textarea ref={ta} value={locked ? existing.body : body} readOnly={locked} onChange={(e) => setBody(e.target.value)} spellCheck="true" />
          </label>
        </div>
        <div className="editor-right">
          <p className="xs muted center">Pré-visualização · A4</p>
          <DocPaper print title={title} body={locked ? existing.body : filled} account={panelPrefs.account} code={existing?.code} date={existing?.date} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Upload a template ---------- */
export function UploadTemplateModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('Declaração');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const found = [...new Set((body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, '')))];

  const readFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // shortcut: only plain text and HTML are read in the prototype; .docx needs a parser (e.g. mammoth) when the backend exists.
    if (!/\.(txt|md|html?)$/i.test(f.name)) { setError('Use um arquivo .txt ou .html. Para Word, copie o texto e cole abaixo.'); e.target.value = ''; return; }
    const raw = await f.text();
    const text = /\.html?$/i.test(f.name)
      ? new DOMParser().parseFromString(raw.replace(/<\/(p|div|h\d|li)>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n'), 'text/html').body.textContent.replace(/\n{3,}/g, '\n\n').trim()
      : raw.trim();
    setError(''); setBody(text);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };
  const save = () => {
    if (!name.trim() || !body.trim()) { setError('Dê um nome e coloque o texto do modelo.'); return; }
    onSave({ id: `custom-${Date.now()}`, name: name.trim(), kind, body, custom: true });
  };

  return (
    <Modal
      title="Subir modelo de documento" sub="Envie um .txt ou .html, ou cole o texto. Use {{paciente}}, {{data}} e outros campos para o preenchimento automático."
      onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar modelo</button></>}
    >
      <div className="grid-2f">
        <label className="field">Nome do modelo<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Declaração para empresa" /></label>
        <label className="field">Tipo
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {['Declaração', 'Atestado', 'Relatório', 'Laudo', 'Parecer', 'Recibo', 'Outro'].map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
      </div>
      <label className="file-drop">
        <Icon name="upload" size={18} /><span>Escolher arquivo (.txt ou .html)</span>
        <input type="file" accept=".txt,.md,.html,.htm,text/plain,text/html" onChange={readFile} aria-label="Arquivo do modelo" />
      </label>
      <label className="field">Texto do modelo<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Declaro, para os devidos fins, que {{paciente}} …" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="ph-chips">
        <span className="xs muted">Campos disponíveis:</span>
        {PLACEHOLDERS.map(([k, l]) => <span key={k} className={`ph-chip static ${found.includes(k) ? 'on' : ''}`} title={l}>{`{{${k}}}`}</span>)}
      </div>
    </Modal>
  );
}

/* ---------- Documents page ---------- */
export function DocumentosOficiais({ store, openEditor }) {
  const { docs, setDocs, templates, setTemplates, panelPrefs } = store;
  const [f, setF] = useState('todos');
  const [sel, setSel] = useState(docs[0]?.id);
  const [upload, setUpload] = useState(false);
  const count = (fn) => docs.filter(fn).length;
  const isDraft = (d) => d.status.startsWith('Rascunho') || d.status === 'Em revisão';
  const rows = docs.filter((d) => f === 'todos' || (f === 'para' ? d.status === 'Para assinar' : f === 'ass' ? d.status === 'Assinado' : isDraft(d)));
  const pg = usePaged(rows, 8);
  const cur = docs.find((d) => d.id === sel) ?? rows[0];
  const sign = (d) => {
    setDocs(docs.map((x) => (x.id === d.id ? { ...x, status: 'Assinado', delivery: 'No app', code: makeCode(), date: TODAY_STR } : x)));
    toast(`Assinado e enviado ao app de ${d.name.split(' ')[0]}`);
  };

  return (
    <>
      <PageHead
        title="Documentos oficiais" sub="Crie a partir de um modelo, edite o texto, assine e entregue no app do paciente"
        actions={<><button className="btn-secondary" onClick={() => setUpload(true)}><Icon name="upload" size={16} /> Subir modelo</button><button className="btn-primary" onClick={() => openEditor({})}><Icon name="plus" size={16} /> Novo documento</button></>}
      />
      <div className="templates">
        {templates.map((t) => (
          <button key={t.id} className="tpl" onClick={() => openEditor({ tpl: t.id })}>
            <Icon name="file" size={18} /><span>{t.name}</span>{t.custom && <span className="tpl-badge">Seu modelo</span>}
          </button>
        ))}
      </div>
      <div className="grid-3-2">
        <section className="panel">
          <div className="panel-head">
            <h2 className="h3">Documentos</h2>
            <Segmented small value={f} onChange={setF} options={[['todos', 'Todos', docs.length], ['para', 'Para assinar', count((d) => d.status === 'Para assinar')], ['rasc', 'Rascunhos', count(isDraft)], ['ass', 'Assinados', count((d) => d.status === 'Assinado')]]} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Documento</th><th>Data</th><th>Status</th><th className="right">Ação</th></tr></thead>
              <tbody>
                {pg.rows.map((d) => (
                  <tr key={d.id} className={`clickable ${cur?.id === d.id ? 'selected' : ''}`} onClick={() => setSel(d.id)}>
                    <td><p className="row-title">{d.title}</p><p className="xs muted">{d.name}{d.delivery !== '—' && ` · entregue ${d.delivery.toLowerCase()}`}</p></td>
                    <td>{d.date}</td>
                    <td><Chip kind={STATUS_KIND[d.status] ?? 'quiet'}>{d.status}</Chip></td>
                    <td className="right">
                      <div className="row gap6 end">
                        {d.status === 'Para assinar' && <button className="btn-primary sm-btn" onClick={(e) => { e.stopPropagation(); sign(d); }}><Icon name="pen" size={14} /> Assinar</button>}
                        <button className="btn-ghost-sm" onClick={(e) => { e.stopPropagation(); openEditor({ docId: d.id }); }}>{d.status === 'Assinado' ? 'Abrir' : 'Editar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager p={pg} noun="documentos" />
        </section>
        {cur && (
          <section className="panel preview">
            <div className="panel-head"><h2 className="h3">Pré-visualização</h2><span className="muted sm">{cur.name}</span></div>
            <DocPaper title={cur.title} body={cur.body} account={panelPrefs.account} code={cur.code} date={cur.date} />
            <div className="row gap8 mt12">
              <button className="btn-secondary grow" onClick={() => downloadText(`${cur.title} - ${cur.name}.txt`, `${cur.title.toUpperCase()}\n\n${cur.body}\n\n${panelPrefs.account.name} · ${panelPrefs.account.crp}${cur.code ? `\nCódigo: ${cur.code}` : ''}`)}><Icon name="download" size={16} /> Baixar</button>
              {cur.status === 'Assinado'
                ? <button className="btn-primary grow" onClick={() => toast(`Reenviado ao app de ${cur.name.split(' ')[0]}`)}><Icon name="send" size={16} /> Reenviar ao app</button>
                : <button className="btn-primary grow" onClick={() => openEditor({ docId: cur.id })}><Icon name="edit" size={16} /> Editar texto</button>}
            </div>
          </section>
        )}
      </div>
      {upload && <UploadTemplateModal onClose={() => setUpload(false)} onSave={(t) => { setTemplates([...templates, t]); setUpload(false); toast(`Modelo “${t.name}” salvo`); openEditor({ tpl: t.id }); }} />}
    </>
  );
}
