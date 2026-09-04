import React from 'react';

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

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="btn small secondary" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}