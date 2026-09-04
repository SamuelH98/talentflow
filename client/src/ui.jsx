import React from 'react';
import { Icon } from './Icons.jsx';

export function ThemeToggle({ theme, toggle }) {
  const dark = theme === 'dark';
  return (
    <button className="theme-toggle" onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle color theme">
      <Icon name={dark ? 'sun' : 'moon'} size={16} />
    </button>
  );
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const TONES = ['tone-0', 'tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5', 'tone-6', 'tone-7'];

export function toneFor(str, seedNum) {
  if (seedNum != null) return TONES[seedNum % TONES.length];
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return TONES[h % TONES.length];
}

export function Avatar({ name, size = 'md', className = '', seed }) {
  return (
    <span className={`avatar ${size !== 'md' ? size : ''} ${toneFor(name, seed)} ${className}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Badge({ status }) {
  const map = {
    active: { cls: 'green', label: 'Active' },
    archived: { cls: 'gray', label: 'Archived' },
    open: { cls: 'green', label: 'Open' },
    closed: { cls: 'gray', label: 'Closed' },
    matched: { cls: 'gray', label: 'Matched' },
    in_review: { cls: 'amber', label: 'In review' },
    interview: { cls: 'primary', label: 'Interview' },
    hired: { cls: 'green', label: 'Hired' },
    rejected: { cls: 'red', label: 'Rejected' },
  };
  const meta = map[status] || { cls: 'gray', label: status };
  return <span className={`badge ${meta.cls}`}><span className="dot" />{meta.label}</span>;
}

export function ChipsInput({ value = [], onChange, placeholder = 'Type & press Enter' }) {
  const add = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && !value.includes(v)) onChange([...value, v]);
      e.target.value = '';
    }
  };
  return (
    <div className="skills-input">
      <div className="chips">
        {value.map((s) => (
          <span key={s} className="chip">
            {s}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`}>×</button>
          </span>
        ))}
      </div>
      <input placeholder={placeholder} onKeyDown={add} />
    </div>
  );
}

export function Modal({ title, icon, onClose, children, footer, width }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="row" style={{ gap: 10 }}>
            {icon && <Icon name={icon} size={20} />}
            {title}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        {children}
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title = 'Nothing here yet', message = '', action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="empty" style={{ padding: 32 }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border-strong)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      {label && <p style={{ fontSize: 13 }}>{label}</p>}
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const t = new Date(String(dateStr).includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export const STAGE_LABELS = {
  matched: 'Application received',
  in_review: 'Under review',
  interview: 'Interview scheduled',
  hired: 'Offer accepted',
  rejected: 'Not selected',
};