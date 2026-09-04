import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Icon } from './Icons.jsx';
import { Avatar, Badge, Spinner, timeAgo } from './ui.jsx';

function Kpi({ icon, tone, label, value, sub, trend }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="label">{label}</span>
        <span className={`icon-chip ${tone || ''}`}><Icon name={icon} /></span>
      </div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
      {trend && <div className={`trend ${trend.dir}`}>{trend.text}</div>}
    </div>
  );
}

export default function Dashboard({ companyName = 'your company', onNavigate }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [cands, jobs, applications, matches] = await Promise.all([
          api.candidates(), api.jobs(), api.applications(), api.matchesAll(),
        ]);
        const top = (matches || [])
          .flatMap((m) => (m.top_candidates || []).map((c) => ({ ...c, job_title: m.job.title, job_id: m.job.id })))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        const interviewCount = applications.filter((a) => a.status === 'interview').length;
        const hiredCount = applications.filter((a) => a.status === 'hired').length;
        setStats({
          candidates: cands.length,
          activeCandidates: cands.filter((c) => c.status !== 'archived').length,
          jobs: jobs.length,
          openJobs: jobs.filter((j) => j.status === 'open').length,
          applications: applications.length,
          interviewCount,
          hiredCount,
          top,
        });
        setRecent(
          [...applications]
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, 6)
            .map((a) => ({ kind: 'app', ...a }))
        );
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Good morning, recruiter.</h1>
          <p>{companyName} — here's your hiring workspace at a glance.</p>
        </div>
        <div className="content-header-actions">
          <button className="btn secondary" onClick={() => onNavigate('candidates')}><Icon name="plus" size={16} /> Add candidate</button>
          <button className="btn secondary" onClick={() => onNavigate('jobs')}><Icon name="briefcase" size={16} /> Add job</button>
        </div>
      </div>

      {error && <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: '#f5c2c2', color: '#991b1b' }}><Icon name="shield" />{error}</div>}

      {!stats ? <Spinner /> : (
        <>
          <div className="stat-grid">
            <Kpi icon="users" label="Candidates" value={stats.candidates} sub={`${stats.activeCandidates} active in pipeline`} />
            <Kpi icon="briefcase" tone="green" label="Open jobs" value={stats.openJobs} sub={`${stats.jobs} total roles`} />
            <Kpi icon="inbox" tone="amber" label="Applications" value={stats.applications} sub="across all shortlists" />
            <Kpi icon="calendar" tone="green" label="In interviews" value={stats.interviewCount} sub={`${stats.hiredCount} hired to date`} />
          </div>

          <div className="row" style={{ marginBottom: 16, gap: 10 }}>
            <button className="btn" onClick={() => onNavigate('matches')}><Icon name="trophy" size={16} /> View best candidates</button>
            <button className="btn secondary" onClick={() => onNavigate('applications')}><Icon name="list" size={16} /> Open pipeline</button>
          </div>

          <div className="card flush">
            <div style={{ padding: '20px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2>🏆 Top matches across open roles</h2>
              <button className="btn small ghost" onClick={() => onNavigate('matches')}>View all <Icon name="chevronRight" size={14} /></button>
            </div>
            {stats.top.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><Icon name="trophy" size={26} /></div>
                <h3>No matches yet</h3>
                <p>Add candidates and jobs, then visit Best Candidates to see who ranks on top.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Candidate</th><th>Job</th><th>Skills</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {stats.top.map((c) => (
                      <tr key={`${c.id}-${c.job_title}`} style={{ cursor: 'pointer' }} onClick={() => onNavigate('matches')}>
                        <td>
                          <div className="row">
                            <Avatar name={c.name} size="sm" seed={c.id} />
                            <div>
                              <div className="bold">{c.name}</div>
                              <div className="muted small">{c.title || c.location || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted">{c.job_title}</td>
                        <td>{(c.skills || []).slice(0, 3).map((s) => <span key={`${c.id}-${s}`} className="pill">{s}</span>)}</td>
                        <td>
                          <span className={`badge ${c.score >= 70 ? 'green' : c.score >= 40 ? 'amber' : 'gray'}`}>
                            {c.score} <span className="dot" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 14 }}>Recent pipeline activity</h2>
            {recent.length === 0 ? (
              <p className="muted small">Shortlist a candidate from Best Candidates to start your pipeline.</p>
            ) : (
              <div>
                {recent.map((a) => (
                  <div className="app-row" key={a.id}>
                    <Avatar name={a.candidate_name} size="sm" seed={a.candidate_id} />
                    <div className="primary">
                      <div className="small"><b>{a.candidate_name}</b> <span className="muted">→ {a.job_title}</span></div>
                      <div className="faint small">{timeAgo(a.created_at)}</div>
                    </div>
                    <Badge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}