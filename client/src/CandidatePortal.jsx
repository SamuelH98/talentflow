import React, { useEffect, useMemo, useState } from 'react';
import { api, formatSalary } from './api.js';
import { Icon } from './Icons.jsx';
import { Avatar, Badge, ChipsInput, Modal, Spinner, EmptyState, STAGE_LABELS, timeAgo } from './ui.jsx';

const STAGE_ORDER = ['matched', 'in_review', 'interview', 'hired'];
const STAGE_SHORT = { matched: 'Submitted', in_review: 'In review', interview: 'Interview', hired: 'Offer' };

function ApplyModal({ job, onApply, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', summary: '', skills: [], years_experience: 2 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const quick = () => {
    setForm((f) => ({
      ...f,
      name: 'Taylor Morgan',
      email: 'taylor.morgan@example.com',
      phone: '555-2244',
      summary: 'Product-minded engineer who ships fast and loves learning new stacks.',
      skills: [...new Set([...(f.skills || []), ...(job.skills || []).slice(0, 3)])],
      years_experience: 4,
    }));
  };
  const submit = async () => {
    setBusy(true); setErr('');
    try { await onApply({ ...form, job_id: job.id }); }
    catch (e) { setErr(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`Apply — ${job.title}`} icon="briefcase" onClose={onClose}>
      <div className="banner" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
        <Icon name="clock" /> Takes ~1 minute. We ask only for the essentials.
        <button type="button" className="btn small secondary banner-action" onClick={quick}>Try a sample profile</button>
      </div>
      {err && <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: '#f5c2c2', color: '#991b1b' }}><Icon name="shield" />{err}</div>}
      <div className="form-grid">
        <div className="field required"><label>Full name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field required"><label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label>Years of experience</label><input type="number" min="0" step="0.5" value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} /></div>
        <div className="field full"><label>Skills</label><ChipsInput value={form.skills} onChange={(v) => set('skills', v)} /></div>
        <div className="field full"><label>Short summary</label><textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} /></div>
      </div>
      <div className="footer">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={submit} disabled={busy || !form.name || !form.email}>
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </Modal>
  );
}

function SuccessView({ applied, onDone }) {
  const link = `${window.location.origin}${window.location.pathname}#/portal/status/${applied.tracking_token}`;
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto', padding: '34px 30px', textAlign: 'center' }}>
      <div className="empty-icon" style={{ margin: '0 auto 14px', width: 64, height: 64, borderRadius: 18, color: 'var(--success)', background: 'var(--success-soft)' }}>
        <Icon name="check" size={30} />
      </div>
      <h1 style={{ fontSize: 22 }}>Application submitted</h1>
      <p className="muted" style={{ margin: '10px auto 4px', maxWidth: 380 }}>
        Thanks, {applied.name}. Your application for <b style={{ color: 'var(--text-2)' }}>{applied.job?.title}</b> has been received — we'll review it shortly.
      </p>
      <div className="breakdown" style={{ textAlign: 'left', margin: '20px 0' }}>
        <div className="breakdown-row"><span className="bl" style={{ width: 'auto' }}>Status</span><Badge status="matched" /></div>
      </div>
      <div className="field" style={{ textAlign: 'left' }}>
        <label>Save your tracking link to check status</label>
        <div className="row">
          <code className="code" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '9px 11px' }}>{link}</code>
          <button className="btn small secondary" onClick={() => { navigator.clipboard?.writeText(link); }}>Copy</button>
        </div>
      </div>
      <div className="footer" style={{ justifyContent: 'center', border: 'none' }}>
        <button className="btn secondary" onClick={() => onDone(applied.tracking_token)}>Track my application</button>
        <button className="btn" onClick={() => onDone(null)}>Browse more jobs</button>
      </div>
    </div>
  );
}

function StatusTracker({ status, lastUpdated }) {
  const idx = STAGE_ORDER.indexOf(status);
  const rejected = status === 'rejected';
  return (
    <div>
      <div className="stepper" style={{ justifyContent: 'space-between' }}>
        {STAGE_ORDER.map((s, i) => {
          const done = !rejected && idx >= i;
          const current = !rejected && idx === i;
          return (
            <React.Fragment key={s}>
              <div className={`step ${done ? (current ? 'current' : 'done') : ''}`}>
                <span className="step-dot">{done && !current ? <Icon name="check" size={12} /> : <b style={{ fontSize: 11 }}>{i + 1}</b>}</span>
                <span className="step-label">{STAGE_SHORT[s]}</span>
              </div>
              {i < STAGE_ORDER.length - 1 && <div className="step-line" />}
            </React.Fragment>
          );
        })}
      </div>
      <div className="muted small" style={{ marginTop: 14 }}>
        {rejected
          ? 'This application was closed. You can view other open roles at any time.'
          : `Status: ${STAGE_LABELS[status]}. Last updated ${timeAgo(lastUpdated)} — we'll keep this page fresh as your application moves forward.`}
      </div>
    </div>
  );
}

function TrackByIdentity() {
  const [email, setEmail] = useState('');
  const [apps, setApps] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await api.publicLookup(email);
      setApps(res);
      if (res.length === 0) setErr('No applications found for that email address.');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Check your applications</h2>
        <p className="muted small" style={{ marginBottom: 16 }}>Enter the email you applied with to see every application and its current stage.</p>
        <form className="lookup-form" onSubmit={lookup}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn" disabled={busy || !email}>{busy ? 'Checking…' : 'Look up'}</button>
        </form>
        {err && <div className="banner" style={{ marginTop: 14, background: 'var(--danger-soft)', borderColor: '#f5c2c2', color: '#991b1b' }}><Icon name="shield" />{err}</div>}
      </div>
      {apps && apps.map((a) => (
        <div className="track-card" key={a.tracking_token}>
          <div className="tc-head">
            <Avatar name={a.candidate?.name} />
            <div style={{ flex: 1 }}>
              <div className="bold" style={{ fontSize: 16 }}>{a.job?.title}</div>
              <div className="muted small">{a.job?.department}</div>
            </div>
            <Badge status={a.status} />
          </div>
          <div className="tc-body">
            <StatusTracker status={a.status} lastUpdated={a.last_updated} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackByToken({ token, setToken }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try { setData(await api.publicStatus(token)); }
      catch (e) { setErr(e.message); }
    })();
  }, [token]);
  if (err) return <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}><EmptyState icon="shield" title="Application not found" message={err} /></div>;
  if (!data) return <Spinner label="Loading your application…" />;
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="track-card">
        <div className="tc-head">
          <Avatar name={data.candidate?.name} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{data.job?.title}</div>
            <div className="muted small">{data.job?.department} · {data.job?.location}</div>
          </div>
          <Badge status={data.status} />
        </div>
        <div className="tc-body">
          <StatusTracker status={data.status} lastUpdated={data.last_updated} />
          <div className="tc-meta">
            <div className="cell"><div className="lbl">Applied</div><div className="val">{timeAgo(data.applied_at)}</div></div>
            <div className="cell"><div className="lbl">Department</div><div className="val">{data.job?.department || '—'}</div></div>
            <div className="cell"><div className="lbl">Location</div><div className="val">{data.job?.location || '—'}</div></div>
            {data.status === 'rejected' ? (
              <div className="cell"><div className="lbl">Outcome</div><div className="val">Not selected at this time</div></div>
            ) : (
              <div className="cell"><div className="lbl">Next step</div><div className="val">A recruiter will reach out with next steps</div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JobGrid({ jobs, search, onApply }) {
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.title, j.department, j.location, ...(j.skills || [])]
        .filter(Boolean)
        .some((t) => t.toLowerCase().includes(q))
    );
  }, [jobs, q]);

  if (jobs.length === 0) {
    return <EmptyState icon="briefcase" title="No open roles right now" message="Check back soon — new roles are added regularly." />;
  }
  if (filtered.length === 0) {
    return <EmptyState icon="search" title="No matches for that search" message="Try a different keyword, skill, or location." />;
  }
  return (
    <div className="portal-jobs">
      {filtered.map((j) => (
        <div className="portal-job" key={j.id}>
          <div className="pj-title">{j.title}</div>
          <div className="pj-dept">{j.department || 'General'}</div>
          <p className="pj-desc">{j.description || 'Join the team and help us build great products.'}</p>
          <div className="pj-meta">
            {j.location && <span><Icon name="pin" /> {j.location}</span>}
            {j.years_required > 0 && <span><Icon name="clock" /> {j.years_required}+ yrs</span>}
            <span><Icon name="users" /> {(j.skills || []).length} skills</span>
          </div>
          <div style={{ flexWrap: 'wrap' }}>
            {(j.skills || []).slice(0, 5).map((s) => <span key={s} className="pill">{s}</span>)}
          </div>
          <div className="pj-foot" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => onApply(j)}>Apply now</button>
            {formatSalary(j.min_salary, j.max_salary) && <span className="pj-salary">{formatSalary(j.min_salary, j.max_salary)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CandidatePortal({ authed, onBack }) {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [applyJob, setApplyJob] = useState(null);
  const [result, setResult] = useState(null);
  const [statusToken, setStatusToken] = useState(() => {
    const h = window.location.hash.split('/');
    return h.length >= 4 && h[1] === 'portal' && h[2] === 'status' ? h[3] : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setJobs(await api.publicJobs()); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (statusToken) window.location.hash = `/portal/status/${statusToken}`;
  }, [statusToken]);

  const apply = async (payload) => {
    const res = await api.publicApply(payload);
    setResult({ ...res, name: payload.name });
    setApplyJob(null);
  };

  const handleTab = (t) => {
    setTab(t);
    if (t === 'jobs') window.location.hash = '/portal';
    else if (t === 'track') window.location.hash = '/portal/track';
  };

  if (statusToken) {
    return (
      <div className="portal">
        <div className="portal-top">
          <div className="portal-brand"><span className="pmark"><Icon name="briefcase" size={18} /></span> TalentFlow <span className="muted" style={{ fontWeight: 600 }}>Careers</span></div>
          <div className="spacer" />
          <button className="portal-link" onClick={() => { setStatusToken(null); setTab('jobs'); window.location.hash = '/portal'; }}>
            <Icon name="arrowLeft" size={15} /> Back to open jobs
          </button>
        </div>
        <div className="portal-body" style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          <TrackByToken token={statusToken} />
        </div>
      </div>
    );
  }

  return (
    <div className="portal">
      <div className="portal-top">
        <div className="portal-brand"><span className="pmark"><Icon name="briefcase" size={18} /></span> TalentFlow <span className="muted" style={{ fontWeight: 600 }}>Careers</span></div>
        <div className="spacer" />
        {authed && onBack && (
          <button className="portal-link" onClick={onBack}><Icon name="arrowLeft" size={15} /> Back to recruiter dashboard</button>
        )}
      </div>

      <div className="portal-hero">
        <h1>{jobs.length} open roles{search ? '' : ''}</h1>
        <p>Find a role that fits you — apply in under a minute and track your application in real time.</p>
        {tab === 'jobs' && (
          <div className="portal-search">
            <Icon name="search" size={17} />
            <input placeholder="Search by title, skill, or location…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      <div className="portal-body">
        <div style={{ marginBottom: 4 }}>
          <div className="portal-seg">
            <button className={tab === 'jobs' ? 'active' : ''} onClick={() => handleTab('jobs')}><Icon name="briefcase" /> Browse jobs</button>
            <button className={tab === 'track' ? 'active' : ''} onClick={() => handleTab('track')}><Icon name="calendar" /> Track application</button>
          </div>
        </div>

        {error && <div className="banner" style={{ marginTop: 16, background: 'var(--danger-soft)', borderColor: '#f5c2c2', color: '#991b1b' }}><Icon name="shield" />{error}</div>}

        {tab === 'jobs' && (
          <>
            {loading ? <Spinner label="Loading open roles…" /> : <JobGrid jobs={jobs} search={search} onApply={setApplyJob} />}
            {!loading && jobs.length > 0 && <p className="muted small" style={{ marginTop: 22, textAlign: 'center' }}>Apply to any role with just your name, email, and a couple of details. No account needed.</p>}
          </>
        )}

        {tab === 'track' && <TrackByIdentity />}
      </div>

      <div className="footer-bar">
        <span>Powered by TalentFlow — a local-first hiring workspace.</span>
        <span className="muted small">Your data never leaves this computer.</span>
      </div>

      {applyJob && <ApplyModal job={applyJob} onApply={apply} onClose={() => setApplyJob(null)} />}
      {result && <SuccessView applied={result} onDone={(token) => { setResult(null); if (token) { setStatusToken(token); setTab('track'); } }} />}
    </div>
  );
}