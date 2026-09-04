import React, { useState } from 'react';
import { api, setToken } from './api.js';

export default function Login({ onLogin }) {
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

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>💼 TalentFlow</h1>
        <div className="sub">Rank the right candidates for every role.</div>
        {error && <div className="toast error" style={{ position: 'static', marginBottom: 12, transform: 'none', boxShadow: 'none', textAlign: 'center' }}>{error}</div>}
        <div className="field required">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field required">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="login-hint">Demo login: <b>demo@acmetalent.com</b> / <b>password</b></div>
      </form>
    </div>
  );
}