import { useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';
import { isoOf, parseIso, todayIso, fmtDay } from '../api.js';

const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const monthName = (d) => { const s = new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); };

/**
 * Kalender waarin je per dag aanduidt: tik 1× = kan, 2× = kan niet, 3× = leeg.
 * value = { available: [iso], unavailable: [iso] }
 */
export function DatePicker({ value, onChange, maxMonths = 4 }) {
  const today = todayIso();
  const [offset, setOffset] = useState(0);
  const first = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); }, [offset]);
  const [mode, setMode] = useState('kan');

  const days = useMemo(() => {
    const lead = (first.getDay() + 6) % 7; // maandag = 0
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => isoOf(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  }, [first]);

  const stateOf = (iso) => (value.available.includes(iso) ? 'kan' : value.unavailable.includes(iso) ? 'niet' : '');
  const set = (iso) => {
    const cur = stateOf(iso);
    const available = value.available.filter((d) => d !== iso);
    const unavailable = value.unavailable.filter((d) => d !== iso);
    // Tik op een dag in de gekozen modus zet hem aan; nogmaals tikken maakt hem leeg
    if (cur !== mode) (mode === 'kan' ? available : unavailable).push(iso);
    onChange({ available: available.sort(), unavailable: unavailable.sort() });
  };
  const clear = () => onChange({ available: [], unavailable: [] });

  return (
    <div className="cal">
      <div className="cal-modes" role="radiogroup" aria-label="Wat duid je aan?">
        <button type="button" role="radio" aria-checked={mode === 'kan'} className={`cal-mode kan${mode === 'kan' ? ' on' : ''}`} onClick={() => setMode('kan')}>
          <span className="swatch" />Ik kan
        </button>
        <button type="button" role="radio" aria-checked={mode === 'niet'} className={`cal-mode niet${mode === 'niet' ? ' on' : ''}`} onClick={() => setMode('niet')}>
          <span className="swatch" />Ik kan niet
        </button>
      </div>

      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o - 1)} disabled={offset === 0} aria-label="Vorige maand"><Icon name="chevL" /></button>
        <strong aria-live="polite">{monthName(first)}</strong>
        <button type="button" className="icon-btn" onClick={() => setOffset((o) => o + 1)} disabled={offset >= maxMonths - 1} aria-label="Volgende maand"><Icon name="chevR" /></button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
        {days.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />;
          const past = iso < today;
          const st = stateOf(iso);
          const d = parseIso(iso);
          return (
            <button type="button" key={iso} disabled={past} onClick={() => set(iso)}
              className={`cal-day${st ? ` ${st}` : ''}${iso === today ? ' today' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' we' : ''}`}
              aria-pressed={!!st} aria-label={`${fmtDay(iso)}${st === 'kan' ? ', kan' : st === 'niet' ? ', kan niet' : ''}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="cal-summary">
        <span><span className="dot kan" />{value.available.length} {value.available.length === 1 ? 'dag' : 'dagen'} kan</span>
        <span><span className="dot niet" />{value.unavailable.length} kan niet</span>
        {(value.available.length > 0 || value.unavailable.length > 0) && <button type="button" className="link-btn" onClick={clear}>Wissen</button>}
      </div>
    </div>
  );
}

/** Alleen-lezen weergave van aangeduide dagen (voor status- en beheerpagina). */
export function DateChips({ dates, kind, onPick }) {
  if (!dates?.length) return <span className="muted">—</span>;
  return (
    <div className="chips">
      {dates.map((d) => (onPick
        ? <button type="button" key={d} className={`chip ${kind}`} onClick={() => onPick(d)}>{fmtDay(d)}</button>
        : <span key={d} className={`chip ${kind}`}>{fmtDay(d)}</span>))}
    </div>
  );
}
