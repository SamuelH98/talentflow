import React, { useEffect, useState } from 'react';
import { api } from './api.js';

function MatchRow({ match, onView }) {
  const cls = match.score >= 70 ? 'high' : match.score >= 40 ? 'mid' : 'low';
  return (
    <tr onClick={() => onView(match.id)}>
      <td>
        <div className="row">
          <div className={`score-circle ${cls}`}>{match.score}</div>
          <div>
            <div className="bold">{match.name}</div>
            <div className="muted small">{match.title || '—'}</div>
          </div>
        </div>
      </td>
      <td>{match.years_experience} yrs</td>
      <td>{(match.skills || []).slice(0, 4).map((s) => <span key={s} className="pill">{s}</span>)}</td>
      <td><span className="muted small">{match.location || '—'}</span></td>
    </tr>
  );
}

export default function Dashboard({ companyName = 'your company', onNavigate }) {
  const [stats, setStats] = useState({ candidates: 0, jobs: 0, applications: 0, top: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [cands, jobs, apps, matches] = await Promise.all([
          api.candidates(), api.jobs(), api.applications(), api.matchesAll(),
        ]);
        const top = (matches || [])
          .flatMap((m) => (m.top_candidates || []).map((c) => ({ ...c, job_title: m.job.title })))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setStats({ candidates: cands.length, jobs: jobs.length, applications: apps.length, top });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Welcome to TalentFlow</h1>
          <p className="muted">{companyName} — find and rank the best candidates for your open roles.</p>
        </div>
      </div>

      {error && <div className="toast error" style={{ position: 'static', transform: 'none', boxShadow: 'none' }}>{error}</div>}

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Candidates</div>
          <div className="value">{loading ? '…' : stats.candidates}</div>
          <div className="sub">in your pipeline</div>
        </div>
        <div className="stat">
          <div className="label">Open Jobs</div>
          <div className="value">{loading ? '…' : stats.jobs}</div>
          <div className="sub">active roles</div>
        </div>
        <div className="stat">
          <div className="label">Applications</div>
          <div className="value">{loading ? '…' : stats.applications}</div>
          <div className="sub">shortlists created</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => onNavigate('candidates')}>Add candidate</button>
        <button className="btn secondary" onClick={() => onNavigate('jobs')}>Add job</button>
        <button className="btn secondary" onClick={() => onNavigate('matches')}>View ranked matches</button>
      </div>

      <div className="card">
        <div className="row between">
          <h2>🏆 Top candidates across all jobs</h2>
          <button className="btn small secondary" onClick={() => onNavigate('matches')}>View all</button>
        </div>
        {stats.top.length === 0 ? (
          <div className="empty">
            <h3>No matches yet</h3>
            <p>Add candidates and jobs to start ranking.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Candidate</th><th>Job</th><th>Score</th></tr>
            </thead>
            <tbody>
              {stats.top.map((c) => (
                <tr key={`${c.id}-${c.job_title}`}>
                  <td className="bold">{c.name}</td>
                  <td className="muted">{c.job_title}</td>
                  <td><span className={`badge ${c.score >= 70 ? 'green' : c.score >= 40 ? 'amber' : 'gray'}`}>{c.score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}