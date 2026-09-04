import React, { useState } from 'react';
import { api, setToken } from './api.js';
import { Icon } from './Icons.jsx';
import { ThemeToggle } from './ui.jsx';

export default function Login({ onLogin, theme, toggleTheme }) {
  const [email, setEmail] = useState('demo@acmetalent.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openPortal = () => { window.location.hash = '/portal'; };

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="logo">
          <span className="logo-mark"><Icon name="briefcase" size={22} /></span>
          TalentFlow
        </div>
        <div>
          <h1>Find your best hires,<br />faster.</h1>
          <p>One local workspace to collect candidates, define roles, and rank the strongest matches for every opening.</p>
          <div className="hero-points">
            <div className="hero-point">
              <span className="chip-icon"><Icon name="trophy" size={18} /></span>
              <div><b>Ranked shortlists, automatically</b><span>Every candidate is scored against every role with a transparent breakdown.</span></div>
            </div>
            <div className="hero-point">
              <span className="chip-icon"><Icon name="users" size={18} /></span>
              <div><b>A candidate-facing portal</b><span>Let applicants apply in one click and track their status in real time.</span></div>
            </div>
            <div className="hero-point">
              <span className="chip-icon"><Icon name="shield" size={18} /></span>
              <div><b>Local by default</b><span>All data lives in a SQLite file on your machine. No cloud, no accounts.</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="login-side">
        <div className="login-side-top">
          <span className="login-brand-mini">Recruiter console</span>
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
        <form className="login-card" onSubmit={submit}>
          <h1>Recruiter sign in</h1>
          <div className="sub">Welcome back — manage your pipeline.</div>
          {error && <div className="banner" style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}><Icon name="shield" />{error}</div>}
          <div className="field required">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field required">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="login-hint">
            Demo login: <code>demo@acmetalent.com</code> / <code>password</code>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" className="portal-link" onClick={openPortal}>
              <Icon name="external" size={14} /> Not a recruiter? Browse open jobs as a candidate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}