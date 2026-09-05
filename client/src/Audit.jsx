import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Icon } from './Icons.jsx';
import { EmptyState, Spinner, timeAgo } from './ui.jsx';

const ACTION_LABELS = {
  'auth.login': 'Sign-in',
  'candidate.create': 'Candidate added',
  'candidate.update': 'Candidate updated',
  'candidate.delete': 'Candidate deleted',
  'candidate.resume_download': 'Resume downloaded',
  'candidate.erasure': 'Candidate data erased (self-service)',
  'job.create': 'Job published',
  'job.update': 'Job updated',
  'job.delete': 'Job deleted',
  'application.create': 'Application created',
  'application.status': 'Stage changed',
};

function short(msg) {
  const cut = msg && msg.length > 64 ? `${msg.slice(0, 64)}…` : msg;
  return cut;
}

export default function Audit({ companyName }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setRows(await api.auditLog(100)); }
      catch (e) { setError(e.message); }
    })();
  }, []);

  if (error) return <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: '#f5c2c2', color: '#991b1b' }}><Icon name="shield" />{error}</div>;
  if (!rows) return <Spinner label="Loading activity…" />;
  if (rows.length === 0) {
    return (
      <div>
        <h1 className="view-title">Activity log</h1>
        <EmptyState icon="clock" title="No activity recorded yet" message="Recruiter actions — sign-ins, candidates, jobs, and stage changes — will appear here." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="view-title">Activity log</h1>
      <p className="muted small" style={{ marginTop: -8, marginBottom: 18 }}>
        Recent recruiter actions within {companyName || 'your company'}. Immutable audit trail — confident candidate/self-service erasures are included.
      </p>
      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted small nowrap" style={{ whiteSpace: 'nowrap' }} title={r.created_at}>{timeAgo(r.created_at)}</td>
                <td>{r.user_email || <span className="muted small">system</span>}</td>
                <td>
                  <span className="pill" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    {ACTION_LABELS[r.action] || r.action}
                  </span>
                </td>
                <td className="muted small">{short(r.detail)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}