import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Candidates from './Candidates.jsx';
import Jobs from './Jobs.jsx';
import Matches from './Matches.jsx';
import Applications from './Applications.jsx';

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split('/').filter(Boolean);
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'candidates', label: 'Candidates', icon: '👩‍💻' },
  { key: 'jobs', label: 'Jobs', icon: '💼' },
  { key: 'matches', label: 'Best Candidates', icon: '🏆' },
  { key: 'applications', label: 'Applications', icon: '📋' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const { user } = await api.me();
        setUser(user);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const navigate = (key) => { window.location.hash = `/${key}`; };

  const logout = () => { setToken(null); setUser(null); navigate('dashboard'); };

  if (loading) return <div className="login-wrap"><div className="muted">Loading…</div></div>;
  if (!user) return <Login onLogin={setUser} />;

  const view = NAV.some((n) => n.key === route[0]) ? route[0] : 'dashboard';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">💼</span> TalentFlow</div>
        <div className="spacer" />
        {user.company && <span className="company">{user.company.name}</span>}
        <span className="user">👤 {user.name}</span>
        <button className="logout" onClick={logout}>Log out</button>
      </header>
      <div className="main">
        <nav className="sidebar">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => navigate(n.key)}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <main className="content">
          {view === 'dashboard' && <Dashboard companyName={user.company?.name} onNavigate={navigate} />}
          {view === 'candidates' && <Candidates />}
          {view === 'jobs' && <Jobs />}
          {view === 'matches' && <Matches />}
          {view === 'applications' && <Applications />}
        </main>
      </div>
    </div>
  );
}