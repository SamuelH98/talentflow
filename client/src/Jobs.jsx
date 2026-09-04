import React, { useCallback, useEffect, useState } from 'react';
import { api, formatSalary } from './api.js';
import { ChipsInput, Modal } from './ui.jsx';

const empty = { title: '', department: '', location: '', description: '', requirements: [], skills: [], years_required: 0, min_salary: null, max_salary: null };

function JobForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...empty, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title={initial?.id ? 'Edit job' : 'Add job'} onClose={onClose}>
      <div className="form-grid">
        <div className="field required"><label>Job title</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label>Department</label><input value={form.department} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="field"><label>Location</label><input value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field"><label>Years experience required</label><input type="number" min="0" step="0.5" value={form.years_required} onChange={(e) => set('years_required', e.target.value)} /></div>
        <div className="field"><label>Min salary (USD)</label><input type="number" min="0" value={form.min_salary || ''} onChange={(e) => set('min_salary', e.target.value)} /></div>
        <div className="field"><label>Max salary (USD)</label><input type="number" min="0" value={form.max_salary || ''} onChange={(e) => set('max_salary', e.target.value)} /></div>
        <div className="field full"><label>Description</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="field full"><label>Required skills</label><ChipsInput value={form.skills} onChange={(v) => set('skills', v)} /></div>
        <div className="field full"><label>Requirements<span className="hint"> short phrases, used for experience-matching</span></label><ChipsInput value={form.requirements} onChange={(v) => set('requirements', v)} /></div>
      </div>
      <div className="footer">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)}>Save job</button>
      </div>
    </Modal>
  );
}

export default function Jobs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await api.jobs()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    try {
      if (editingId) await api.updateJob(editingId, form);
      else await api.createJob(form);
      setEditingId(null); setAdding(false); await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    try { await api.deleteJob(id); await load(); } catch (e) { setError(e.message); }
  };

  const toggleMatch = (id) => { window.location.hash = `/matches?job=${id}`; };

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">{items.length} job{(items.length === 1 ? '' : 's')}</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ Add job</button>
      </div>

      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty"><h3>No jobs yet</h3><p>Add a job to start matching candidates.</p></div>
      )}

      <div className="grid jobs">
        {items.map((j) => (
          <div className="card" key={j.id}>
            <div className="row between">
              <div className="bold" style={{ fontSize: 16 }}>{j.title}</div>
              <span className={`badge ${j.status === 'open' ? 'green' : 'gray'}`}>{j.status}</span>
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              {[j.department, j.location, j.years_required ? `${j.years_required}+ yrs` : null, formatSalary(j.min_salary, j.max_salary)].filter(Boolean).join(' · ')}
            </div>
            {j.description && <p className="small" style={{ margin: '8px 0' }}>{j.description}</p>}
            <div style={{ marginTop: 8 }}>
              {(j.skills || []).slice(0, 6).map((s) => <span key={s} className="pill">{s}</span>)}
            </div>
            <div className="actions-row">
              <button className="btn small" onClick={() => toggleMatch(j.id)}>Find best candidates</button>
              <button className="btn small secondary" onClick={() => setEditingId(j.id)}>Edit</button>
              <button className="btn small danger" onClick={() => remove(j.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {adding && <JobForm onSave={save} onClose={() => setAdding(false)} />}
      {editingId && <JobForm initial={items.find((j) => j.id === editingId)} onSave={save} onClose={() => setEditingId(null)} />}
    </div>
  );
}