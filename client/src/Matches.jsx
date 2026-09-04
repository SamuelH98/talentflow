import React, { useEffect, useState } from 'react';
import { api, getToken } from './api.js';

function ScoreCircle({ score }) {
  const cls = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  return <div className={`score-circle ${cls}`}>{score}</div>;
}

function Breakdown({ b }) {
  if (!b) return null;
  const rows = [
    { label: 'Skills', val: b.skillScore },
    { label: 'Experience', val: b.expScore },
    { label: 'Years', val: b.yearsScore },
  ];
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div className="breakdown-row" key={r.label}>
          <span>{r.label}</span>
          <div className="bar-bg"><div className="bar" style={{ width: `${r.val}%` }} /></div>
          <span className="bold" style={{ width: 34 }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function CandidateCard({ c, job, onShortlist }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row">
        <ScoreCircle score={c.score} />
        <div style={{ flex: 1 }}>
          <div className="bold" style={{ fontSize: 15 }}>{c.name}</div>
          <div className="muted small">{c.title || 'No title'} · {c.location || '—'}</div>
        </div>
        <button className="btn small secondary" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'Details'}</button>
        <button className="btn small" onClick={() => onShortlist(job, c)}>Shortlist</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {c.summary && <p className="small">{c.summary}</p>}
          <div className="small">
            <div className="muted" style={{ marginBottom: 4 }}>Skills</div>
            <div>{(c.skills || []).map((s) => <span key={s} className="pill">{s}</span>)}</div>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>Match breakdown</div>
          <Breakdown b={c.breakdown} />
          {c.breakdown?.skillHits?.length > 0 && (
            <div className="small muted" style={{ marginTop: 8 }}>
              Overlapping skills: {c.breakdown.skillHits.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const [jobs, setJobs] = useState([]);
  const [candCount, setCandCount] = useState({ total: 0, active: 0 });
  const [selectedJob, setSelectedJob] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shortlistMsg, setShortlistMsg] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    (async () => {
      try {
        const [jobList, candList, matches] = await Promise.all([api.jobs(), api.candidates(), api.matchesAll()]);
        setJobs(jobList);
        setCandCount({ total: candList.length, active: candList.filter((c) => c.status !== 'archived').length });
        const fromQuery = Number(q.get('job'));
        const initial = jobList.find((j) => j.id === fromQuery) || jobList[0];
        if (initial) {
          setSelectedJob(initial);
          const full = await api.jobMatches(initial.id);
          setData(full);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectJob = async (id) => {
    setSelectedJob(jobs.find((j) => j.id === id));
    setLoading(true); setError('');
    try { setData(await api.jobMatches(id)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const shortlist = async (job, c) => {
    try {
      await api.createApplication({ job_id: job.id, candidate_id: c.id, score: c.score, notes: `Matched ${c.score}/100` });
      setShortlistMsg(`Shortlisted ${c.name} for ${job.title}`);
      setTimeout(() => setShortlistMsg(''), 3000);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!getToken()) return null;

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>Best Candidates</h1>
          <p className="muted">
            Ranked by skills, experience fit and required years.
            Scoring: 50% skill match · 30% experience fit · 20% required years.
          </p>
        </div>
        <select className="status-select" value={selectedJob?.id || ''} onChange={(e) => selectJob(Number(e.target.value))}>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </div>

      {shortlistMsg && <div className="toast">{shortlistMsg}</div>}
      {error && <div className="toast error">{error}</div>}
      {loading && <div className="muted">Loading matches…</div>}

      {!loading && data && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">Job</div>
              <div className="value" style={{ fontSize: 18 }}>{data.job.title}</div>
              <div className="sub">matching against {candCount.active} active candidates</div>
            </div>
            <div className="stat">
              <div className="label">Candidates ranked</div>
              <div className="value">{data.candidates.length}</div>
              <div className="sub">from {candCount.total} total in pipeline</div>
            </div>
            <div className="stat">
              <div className="label">Top match</div>
              <div className="value">{data.candidates[0] ? <ScoreCircle score={data.candidates[0].score} /> : '—'}</div>
              <div className="sub">{data.candidates[0]?.name || 'no candidates'}</div>
            </div>
          </div>

          <div className="row between" style={{ marginBottom: 12 }}>
            <h2>Ranked candidates</h2>
          </div>
          {data.candidates.length === 0 ? (
            <div className="card empty"><h3>No candidates</h3><p>Add candidates to see who matches.</p></div>
          ) : (
            data.candidates.map((c, i) => (
              <div className="row" key={c.id} style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 36, textAlign: 'center', paddingTop: 18, fontWeight: 700, color: '#94a3b8', fontSize: 18 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <CandidateCard c={c} job={data.job} onShortlist={shortlist} />
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}