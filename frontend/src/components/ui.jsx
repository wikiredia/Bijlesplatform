import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { Icon } from './Icon.jsx';
import { api } from '../api.js';

export function Field({ label, hint, error, required, children, optional }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}{required && <span className="req" aria-hidden="true"> *</span>}
          {optional && <span className="opt"> (optioneel)</span>}
        </label>
      )}
      {child}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Rij met keuzeknoppen (radio of meerkeuze). */
export function Choice({ options, value, onChange, multiple = false, name, className = '', columns }) {
  const isOn = (v) => (multiple ? (value || []).includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    const cur = value || [];
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  return (
    <div className={`choice ${className}`} role={multiple ? 'group' : 'radiogroup'} aria-label={name}
      style={columns ? { '--cols': columns } : undefined}>
      {Object.entries(options).map(([v, label]) => (
        <button type="button" key={v} className={`choice-btn${isOn(v) ? ' on' : ''}`}
          role={multiple ? 'checkbox' : 'radio'} aria-checked={isOn(v)} onClick={() => toggle(v)}>
          {multiple && <span className="tick"><Icon name="check" size={14} /></span>}
          {label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, error }) {
  return (
    <div className={`check-wrap${error ? ' has-error' : ''}`}>
      <label className="check">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="check-box" aria-hidden="true"><Icon name="check" size={15} /></span>
        <span className="check-text">{children}</span>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Alert({ kind = 'info', children }) {
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Spinner({ label = 'Laden…' }) {
  return <div className="spinner" role="status"><span className="spinner-dot" />{label}</div>;
}

/** Toont kinderen pas als ze in beeld scrollen (respecteert reduced motion via CSS). */
export function Reveal({ children, as: Tag = 'div', className = '', delay = 0, ...rest }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal${seen ? ' in' : ''} ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>{children}</Tag>;
}

export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await api(path), error: null, loading: false }); } catch (e) { setState({ data: null, error: e, loading: false }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function useTitle(t) {
  useEffect(() => { document.title = t ? `${t} – Bijles` : 'Bijles – wiskunde, fysica en programmeren'; }, [t]);
}

export function Initials({ name, className = '' }) {
  const ini = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return <span className={`avatar ${className}`} aria-hidden="true">{ini}</span>;
}
