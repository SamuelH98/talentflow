import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Icon } from './Icons.jsx';

const STATUSES = ['matched', 'in_review', 'interview', 'hired', 'rejected'];

export default function Applications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await api.applications()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.updateApplicationStatus(id, { status });
      await load();
    } catch (e) { setError(e.message); }
  };

  const badgeCls = (s) => ({ matched: 'gray', in_review: 'amber', interview: 'primary', hired: 'green', rejected: 'red' }[s] || 'gray');
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Applications</h1>
          <p className="muted">{items.length} shortlists — click a row to review screening answers.</p>
        </div>
      </div>
      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty"><h3>No applications yet</h3><p>Shortlist a candidate from the Best Candidates view.</p></div>
      )}

      <div className="card applications-list">
        {items.map((a) => (
          <div className="app-card" key={a.id}>
            <button className={`app-row ${open[a.id] ? 'open' : ''}`} onClick={() => toggle(a.id)}>
              <Icon name={open[a.id] ? 'chevronDown' : 'chevronRight'} size={15} className="tog" />
              <span className={`badge ${badgeCls(a.status)}`}>{a.status.replace('_', ' ')}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div className="bold">{a.candidate_name}</div>
                <div className="muted small">for {a.job_title}</div>
                {a.notes && <div className="muted small" style={{ marginTop: 2 }}>{a.notes}</div>}
              </div>
              {a.score != null && <span className="bold" style={{ fontSize: 16 }}>{Math.round(a.score)}</span>}
              <div style={{ maxWidth: 180 }}>{(a.candidate_skills || []).slice(0, 3).map((s) => <span key={s} className="pill">{s}</span>)}</div>
              <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{(a.screening_answers || []).length} answers</span>
              <select className="status-select" value={a.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateStatus(a.id, e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </button>
            {open[a.id] && (
              <div className="app-detail">
                <div className="app-detail-lbl"><Icon name="filter" size={13} /> Screening answers</div>
                {(a.screening_answers || []).length === 0 && <div className="muted small">No screening answers submitted.</div>}
                {(a.screening_answers || []).map((sa) => (
                  <div className="qa" key={sa.question}>
                    <div className="qa-q">{sa.question}</div>
                    {sa.answer ? <div className="qa-a">{sa.answer}</div> : <div className="qa-a none">—</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}