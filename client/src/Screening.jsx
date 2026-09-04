import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Icon } from './Icons.jsx';
import { Modal } from './ui.jsx';

const TYPE_LABELS = {
  text: 'Short answer',
  paragraph: 'Paragraph / long answer',
  single: 'Single choice',
  multiple: 'Multiple choice',
};

function emptyQuestion() {
  return { label: '', description: '', type: 'text', options: [], default_enabled: true, default_required: false };
}

function QuestionForm({ initial, onSave, onClose }) {
  const [q, setQ] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));

  const setOption = (i, k, v) => {
    const options = [...q.options];
    options[i] = { ...options[i], [k]: v };
    if (k === 'label' && !options[i].value) options[i].value = v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    set('options', options);
  };

  const save = async () => {
    setErr('');
    if (!q.label.trim()) { setErr('Question text is required.'); return; }
    if ((q.type === 'single' || q.type === 'multiple') && q.options.filter((o) => o.label.trim() && o.value.trim()).length < 2) {
      setErr('Choice questions need at least two options.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        label: q.label.trim(),
        description: q.description.trim() || null,
        type: q.type,
        options: q.type === 'single' || q.type === 'multiple' ? q.options.filter((o) => o.label.trim() && o.value.trim()).map((o) => ({ value: o.value.trim(), label: o.label.trim() })) : [],
        default_enabled: q.default_enabled,
        default_required: q.default_required,
      };
      if (q.id) await api.updateScreeningQuestion(q.id, payload);
      else await api.createScreeningQuestion(payload);
      await onSave();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choices = q.type === 'single' || q.type === 'multiple';
  return (
    <Modal title={q.id ? 'Edit question' : 'Add question'} icon="filter" onClose={onClose}>
      <div className="form-grid">
        <div className="field full required"><label>Question</label>
          <input value={q.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Are you available to start immediately?" />
        </div>
        <div className="field full"><label>Description<span className="hint">optional</span></label>
          <input value={q.description} onChange={(e) => set('description', e.target.value)} placeholder="Extra context shown to candidates" />
        </div>
        <div className="field full"><label>Answer type</label>
          <select value={q.type} onChange={(e) => { set('type', e.target.value); if (e.target.value === 'text' || e.target.value === 'paragraph') set('options', []); }}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {choices && (
          <div className="field full">
            <label>Answer options</label>
            {q.options.map((o, i) => (
              <div className="option-row" key={i}>
                <input value={o.value} placeholder="key" onChange={(e) => setOption(i, 'value', e.target.value)} className="option-key" disabled />
                <input value={o.label} placeholder="Option label" onChange={(e) => setOption(i, 'label', e.target.value)} />
                <button type="button" className="icon-btn" onClick={() => set('options', q.options.filter((_, j) => j !== i))} title="Remove"><Icon name="trash" size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn small secondary" onClick={() => set('options', [...q.options, { value: '', label: '' }])}>+ Add option</button>
          </div>
        )}
        <label className="check-row"><input type="checkbox" checked={q.default_enabled} onChange={(e) => set('default_enabled', e.target.checked)} /> Apply to all jobs by default</label>
        <label className="check-row"><input type="checkbox" checked={q.default_required} onChange={(e) => set('default_required', e.target.checked)} /> Required by default</label>
      </div>
      {err && <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}><Icon name="shield" />{err}</div>}
      <div className="footer">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
      </div>
    </Modal>
  );
}

export default function Screening() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await api.screeningQuestions()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (q) => {
    if (!window.confirm(`Delete "${q.label}"? It will be removed from every job that uses it; past answers stay on file.`)) return;
    try { await api.deleteScreeningQuestion(q.id); await load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Screening questions</h1>
          <p className="muted">Build a reusable question library. Each job lets you pick which questions apply, mark them required, and set the order.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ Add question</button>
      </div>

      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty"><h3>No screening questions yet</h3><p>Add a question and it'll show on the candidate portal apply form — on every job by default, or just the jobs you choose.</p></div>
      )}

      <div className="screen-list">
        {items.map((q) => (
          <div className="card screen-card" key={q.id}>
            <div className="row between">
              <div className="bold" style={{ fontSize: 15 }}>{q.label}</div>
              <div className="row" style={{ gap: 6 }}>
                <span className={`badge ${q.default_enabled ? 'green' : 'gray'}`}>{q.default_enabled ? 'On by default' : 'Manual'}</span>
                {q.default_required && <span className="badge amber">Required</span>}
              </div>
            </div>
            {q.description && <p className="muted small" style={{ margin: '6px 0' }}>{q.description}</p>}
            <div className="small muted" style={{ marginTop: 6 }}>
              <span className="pill">{TYPE_LABELS[q.type] || q.type}</span>
              {q.type === 'single' || q.type === 'multiple' ? q.options.map((o) => <span key={o.value} className="pill ghost">{o.label}</span>) : null}
            </div>
            <div className="actions-row">
              <button className="btn small" onClick={() => { setAdding(false); setEditing(q); }}>Edit</button>
              <button className="btn small danger" onClick={() => remove(q)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {adding && <QuestionForm initial={emptyQuestion()} onSave={async () => { setAdding(false); await load(); }} onClose={() => setAdding(false)} />}
      {editing && <QuestionForm initial={editing} onSave={async () => { setEditing(null); await load(); }} onClose={() => setEditing(null)} />}
    </div>
  );
}