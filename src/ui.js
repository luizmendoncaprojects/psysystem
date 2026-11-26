import { useEffect, useRef, useState } from 'react';

// Shared UI primitives: icons (lucide-style strokes), mood faces, avatar.
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  check: 'M20 6 9 17l-5-5',
  checks: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  video: 'm22 8-6 4 6 4zM2 6h14v12H2z',
  pill: 'm10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7',
  wind: 'M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2',
  walk: 'M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M7 21l3-6 3 2v4M10 15l1-5 4 2 3 1M11 10 8 12l-1 3',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  drop: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5 12 2.5C11.5 5 10 7.4 8 9 6 10.6 5 13 5 15a7 7 0 0 0 7 7z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  palette: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22zM7.5 10.5h.01M10.5 7h.01M15 7.5h.01M17.5 11h.01',
  x: 'M18 6 6 18M6 6l12 12',
  heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  chevR: 'm9 18 6-6-6-6',
  chevL: 'm15 18-6-6 6-6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  file: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5zM14 2v6h6M9 13h6M9 17h6',
  chart: 'M3 3v18h18M7 16l4-5 4 3 5-7',
  sparkles: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM19 3v4M21 5h-4',
  shield: 'M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z',
  refresh: 'M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7l3-2.7M21 21v-5h-5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  send: 'm22 2-7 20-4-9-9-4zM22 2 11 13',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  alert: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
  pen: 'M15.2 3.8a2.8 2.8 0 1 1 4 4L7.5 19.5 2 21l1.5-5.5z',
  map: 'M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 1 1-4.2-4.2',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  trend: 'm22 7-8.5 8.5-5-5L2 17M16 7h6v6',
  logo: 'M4 20c3-8 6-12 8-12s3 4 8 12M8 20c1.5-3 3-5 4-5s2.5 2 4 5',
};

export function Icon({ name, size = 20, stroke = 1.8, className, label }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className}
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}
    >
      <path d={P[name]} />
    </svg>
  );
}

export const MOODS = [
  { v: 1, label: 'Muito mal', curve: -4 },
  { v: 2, label: 'Mal', curve: -2 },
  { v: 3, label: 'Ok', curve: 0 },
  { v: 4, label: 'Bem', curve: 2 },
  { v: 5, label: 'Muito bem', curve: 4 },
];

export function MoodFace({ v, size = 40 }) {
  const c = MOODS[v - 1].curve;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill={`var(--mood-${v})`} />
      <circle cx="14" cy="16" r="2" fill="var(--mood-ink)" />
      <circle cx="26" cy="16" r="2" fill="var(--mood-ink)" />
      <path d={`M12 ${26 - c / 2} Q20 ${26 + c} 28 ${26 - c / 2}`} stroke="var(--mood-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MoodPicker({ value, onChange, size = 44 }) {
  return (
    <div className="mood-picker" role="radiogroup" aria-label="Como você está">
      {MOODS.map((m) => (
        <button
          key={m.v} type="button" role="radio" aria-checked={value === m.v}
          className={`mood-opt ${value === m.v ? 'on' : ''}`} onClick={() => onChange(m.v)}
        >
          <MoodFace v={m.v} size={size} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 36, tone }) {
  const ini = name.split(' ').filter((w) => w.length > 2 || w === name.split(' ')[0]).map((w) => w[0]).slice(0, 2).join('');
  const t = tone ?? (name.charCodeAt(0) + name.length) % 5;
  return (
    <span className={`avatar tone-${t}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {ini}
    </span>
  );
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`seg ${small ? 'seg-sm' : ''}`} role="tablist">
      {options.map((o) => {
        const [key, label, count] = Array.isArray(o) ? o : [o, o];
        return (
          <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>
            {label}{count != null && <span className="seg-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

// Simple line chart in SVG. points: number[] (1–5 scale), marks: indexes with vertical lines.
export function LineChart({ points, height = 140, marks = [], bands = [], labels = [], min = 1, max = 5, area = true }) {
  const w = 600, h = height, pad = 8;
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v) => pad + ((max - v) * (h - pad * 2)) / (max - min);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Gráfico de humor">
        {bands.map(([a, b, cls]) => <rect key={cls} x={x(a) - 12} width={x(b) - x(a) + 24} y="0" height={h} className={cls} />)}
        {[0, 1, 2, 3, 4, 5].filter((g) => g >= min && g <= max).map((g) => (
          <line key={g} x1="0" x2={w} y1={y(g)} y2={y(g)} className="grid-line" />
        ))}
        {marks.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1="0" y2={h} className="mark-line" />)}
        {area && <path d={`${d} L${x(points.length - 1)} ${h} L${x(0)} ${h}Z`} className="area" />}
        <path d={d} className="line" vectorEffect="non-scaling-stroke" />
      </svg>
      {labels.length > 0 && <div className="chart-labels">{labels.map((l) => <span key={l}>{l}</span>)}</div>}
    </div>
  );
}

export const Chip = ({ kind = 'quiet', children }) => <span className={`chip chip-${kind}`}>{children}</span>;
export const RISK = { Baixo: 'ok', Moderado: 'warn', Alto: 'danger', 'Não definido': 'quiet' };
export const STATUS = { Ativa: 'ok', Ativo: 'ok', 'Em pausa': 'quiet', Alta: 'accent', 'Aguardando vínculo': 'warn' };

export function PageHead({ title, sub, actions }) {
  return (
    <div className="page-head">
      <div><h1 className="d-title">{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {actions && <div className="row gap8">{actions}</div>}
    </div>
  );
}

export function Spark({ d }) {
  if (!d) return <span className="muted sm">Sem registros</span>;
  const w = 80, h = 26, x = (i) => (i * w) / (d.length - 1), y = (v) => h - 2 - ((v - 1) * (h - 4)) / 4;
  return <svg width={w} height={h} className="spark" aria-hidden="true"><path d={d.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')} /></svg>;
}

/* ---------- Modal ---------- */
// sheet: bottom sheet inside the phone frame (patient app); otherwise a centered dialog.
export function Modal({ title, sub, onClose, children, footer, wide, sheet }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('input, select, textarea, button:not(.modal-x)');
    first?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className={`modal-backdrop ${sheet ? 'sheet' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div><h2 className="h3">{title}</h2>{sub && <p className="muted sm">{sub}</p>}</div>
          <button className="icon-btn modal-x" aria-label="Fechar" onClick={onClose}><Icon name="x" size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
// Fire-and-forget feedback: toast('Salvo'). <Toaster /> renders them.
export const toast = (msg, kind = 'ok') => window.dispatchEvent(new CustomEvent('trilha-toast', { detail: { msg, kind, id: Date.now() + Math.random() } }));

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      setItems((xs) => [...xs, e.detail]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== e.detail.id)), 3200);
    };
    window.addEventListener('trilha-toast', on);
    return () => window.removeEventListener('trilha-toast', on);
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}><Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={16} stroke={2.4} />{t.msg}</div>)}
    </div>
  );
}

/* ---------- Mock download ---------- */
// Saves a small text file so "Baixar" buttons do something real in the prototype.
export function downloadText(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Baixado: ${filename}`);
}

/* ---------- Pagination ---------- */
// Client-side paging for in-memory lists. Resets to page 1 when the list size changes (filters).
export function usePaged(rows, size = 10) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages - 1);
  return { rows: rows.slice(cur * size, cur * size + size), page: cur, pages, setPage, total: rows.length, size };
}

export function Pager({ p, noun = 'itens' }) {
  if (p.total <= p.size) return null;
  const from = p.page * p.size + 1;
  const to = Math.min(p.total, from + p.size - 1);
  const nums = Array.from({ length: p.pages }, (_, i) => i).filter((i) => p.pages <= 7 || i === 0 || i === p.pages - 1 || Math.abs(i - p.page) <= 1);
  return (
    <nav className="pager" aria-label="Paginação">
      <span className="sm muted">Mostrando {from}–{to} de {p.total} {noun}</span>
      <div className="row gap4">
        <button className="icon-btn" aria-label="Página anterior" disabled={p.page === 0} onClick={() => p.setPage(p.page - 1)}><Icon name="chevL" size={16} /></button>
        {nums.map((i, k) => (
          <span key={i} className="row gap4">
            {k > 0 && i - nums[k - 1] > 1 && <span className="muted sm">…</span>}
            <button className={`pg ${i === p.page ? 'on' : ''}`} aria-current={i === p.page ? 'page' : undefined} aria-label={`Página ${i + 1}`} onClick={() => p.setPage(i)}>{i + 1}</button>
          </span>
        ))}
        <button className="icon-btn" aria-label="Próxima página" disabled={p.page === p.pages - 1} onClick={() => p.setPage(p.page + 1)}><Icon name="chevR" size={16} /></button>
      </div>
    </nav>
  );
}
