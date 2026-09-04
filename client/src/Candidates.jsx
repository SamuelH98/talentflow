import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { ChipsInput, Modal } from './ui.jsx';

const empty = { name: '', email: '', phone: '', location: '', title: '', summary: '', years_experience: 0, skills: [], experience: [], education: [], resume_text: '' };

function CandidateForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...empty, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title={initial?.id ? 'Edit candidate' : 'Add candidate'} onClose={onClose}>
      <div className="form-grid">
        <div className="field required"><label>Name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>Email</label><input value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Current / target title</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label>Location</label><input value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label>Years of experience</label><input type="number" min="0" step="0.5" value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} /></div>
        <div className="field full"><label>Summary</label><textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} /></div>
        <div className="field full"><label>Skills</label><ChipsInput value={form.skills} onChange={(v) => set('skills', v)} /></div>
        <div className="field full"><label>Work experience <span className="hint">one item per line</span></label><ChipsInput value={form.experience} onChange={(v) => set('experience', v)} /></div>
        <div className="field full"><label>Education</label><ChipsInput value={form.education} onChange={(v) => set('education', v)} /></div>
        <div className="field full"><label>Resume / bio text <span className="hint">optional, used for experience-matching</span></label><textarea value={form.resume_text} onChange={(e) => set('resume_text', e.target.value)} /></div>
      </div>
      <div className="footer">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)}>Save candidate</button>
      </div>
    </Modal>
  );
}

export default function Candidates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api.candidates());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    try {
      if (editingId) await api.updateCandidate(editingId, form);
      else await api.createCandidate(form);
      setEditingId(null); setAdding(false);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this candidate?')) return;
    try { await api.deleteCandidate(id); await load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Candidates</h1>
          <p className="muted">{items.length} candidate{(items.length === 1 ? '' : 's')} in your pipeline</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ Add candidate</button>
      </div>

      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty">
          <div style={{ fontSize: 40 }}>👩‍💻</div>
          <h3>No candidates yet</h3>
          <p>Click "Add candidate" to get started.</p>
        </div>
      )}

      <div className="grid candidates">
        {items.map((c) => (
          <div className="card" key={c.id}>
            <div className="row between">
              <div>
                <div className="bold" style={{ fontSize: 16 }}>{c.name}</div>
                <div className="muted small">{c.title || 'No title'}</div>
              </div>
              <span className={`badge ${c.status === 'active' ? 'green' : 'gray'}`}>{c.status}</span>
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>📍 {c.location || '—'} · ⏳ {c.years_experience} yrs</div>
            {c.summary && <p className="small" style={{ margin: '8px 0' }}>{c.summary}</p>}
            <div style={{ marginTop: 8 }}>
              {(c.skills || []).slice(0, 6).map((s) => <span key={s} className="pill">{s}</span>)}
            </div>
            <div className="actions-row">
              <button className="btn small secondary" onClick={() => setEditingId(c.id)}>Edit</button>
              <button className="btn small danger" onClick={() => remove(c.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {adding && <CandidateForm onSave={save} onClose={() => setAdding(false)} />}
      {editingId && (
        <CandidateForm
          initial={items.find((c) => c.id === editingId)}
          onSave={save}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}