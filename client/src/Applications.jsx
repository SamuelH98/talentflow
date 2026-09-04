import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const STATUSES = ['matched', 'in_review', 'interview', 'hired', 'rejected'];

export default function Applications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Applications</h1>
          <p className="muted">{items.length} shortlists — move candidates through your pipeline.</p>
        </div>
      </div>
      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card empty"><h3>No applications yet</h3><p>Shortlist a candidate from the Best Candidates view.</p></div>
      )}

      <div className="card applications-list">
        {items.map((a) => (
          <div className="app-row" key={a.id}>
            <span className={`badge ${badgeCls(a.status)}`}>{a.status.replace('_', ' ')}</span>
            <div style={{ flex: 1 }}>
              <div className="bold">{a.candidate_name}</div>
              <div className="muted small">for {a.job_title}</div>
              {a.notes && <div className="muted small" style={{ marginTop: 2 }}>{a.notes}</div>}
            </div>
            {a.score != null && <span className="bold" style={{ fontSize: 16 }}>{Math.round(a.score)}</span>}
            <div style={{ maxWidth: 180 }}>{(a.candidate_skills || []).slice(0, 3).map((s) => <span key={s} className="pill">{s}</span>)}</div>
            <select className="status-select" value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}