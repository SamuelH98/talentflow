import React, { useCallback, useEffect, useState } from 'react';
import { api, formatSalary } from './api.js';
import { Icon } from './Icons.jsx';
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

function JobQuestions({ job, onClose }) {
  const [rows, setRows] = useState(null);
  const [inherited, setInherited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.jobScreening(job.id);
        setRows(cfg.questions);
        setInherited(cfg.inherited);
      } catch (e) { setErr(e.message); }
    })();
  }, [job.id]);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    setRows((r) => { const next = [...r]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  };
  const setFlag = (i, k, v) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api.saveJobScreening(job.id, rows.map((q) => ({ question_id: q.id, enabled: q.enabled, required: q.required })));
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const enabledCount = (rows || []).filter((q) => q.enabled).length;

  return (
    <Modal title={`Screening questions — ${job.title}`} icon="filter" width={640} onClose={onClose}>
      {err && <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}><Icon name="shield" />{err}</div>}
      {!rows && <div className="muted">Loading…</div>}
      {rows && (
        <>
          <div className="banner" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <Icon name="filter" />
            {inherited
              ? `Inheriting company defaults — ${enabledCount} question${enabledCount === 1 ? '' : 's'} will appear for this job. Saving below overrides the defaults for this job.`
              : `${enabledCount} enabled for this job (custom set, no longer inherited).`}
          </div>
          <div className="jsq-list">
            {rows.map((q, i) => (
              <div key={q.id} className={`jsq-row ${q.enabled ? '' : 'off'}`}>
                <div style={{ flex: 1 }}>
                  <div className={q.enabled ? 'bold' : 'muted'} style={{ fontSize: 14 }}>{q.label}</div>
                  {!q.enabled && <div className="muted small">Not asked on this job's apply form</div>}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><Icon name="chevronUp" size={15} /></button>
                  <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Move down"><Icon name="chevronDown" size={15} /></button>
                </div>
                <label className="check-row no-grow"><input type="checkbox" checked={q.required} onChange={(e) => setFlag(i, 'required', e.target.checked)} disabled={!q.enabled} /> Required</label>
                <label className="switch"><input type="checkbox" checked={q.enabled} onChange={(e) => setFlag(i, 'enabled', e.target.checked)} /><span /></label>
              </div>
            ))}
          </div>
          {saved && <div className="banner" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)', color: 'var(--success)' }}><Icon name="check" />Saved — candidates will see the new set.</div>}
        </>
      )}
      <div className="footer">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy || !rows || saved}>{busy ? 'Saving…' : 'Save for this job'}</button>
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
  const [questionsJob, setQuestionsJob] = useState(null);

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
              <button className="btn small secondary" onClick={() => setQuestionsJob(j)}>Questions</button>
              <button className="btn small secondary" onClick={() => setEditingId(j.id)}>Edit</button>
              <button className="btn small danger" onClick={() => remove(j.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {adding && <JobForm onSave={save} onClose={() => setAdding(false)} />}
      {editingId && <JobForm initial={items.find((j) => j.id === editingId)} onSave={save} onClose={() => setEditingId(null)} />}
      {questionsJob && <JobQuestions job={questionsJob} onClose={() => setQuestionsJob(null)} />}
    </div>
  );
}