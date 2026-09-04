import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { Icon } from './Icons.jsx';
import { Avatar, ThemeToggle } from './ui.jsx';
import { useTheme } from './theme.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Candidates from './Candidates.jsx';
import Jobs from './Jobs.jsx';
import Matches from './Matches.jsx';
import Applications from './Applications.jsx';
import Screening from './Screening.jsx';
import CandidatePortal from './CandidatePortal.jsx';

function parseHash() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { key: 'candidates', label: 'Candidates', icon: 'users' },
  { key: 'jobs', label: 'Jobs', icon: 'briefcase' },
  { key: 'matches', label: 'Best Candidates', icon: 'trophy' },
  { key: 'applications', label: 'Applications', icon: 'list' },
  { key: 'screening', label: 'Screening', icon: 'filter' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(() => parseHash());
  const [theme, toggleTheme] = useTheme();

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

  const view = (route[0] || 'dashboard');

  if (loading) {
    return <div className="login-wrap"><div className="login-side"><div className="muted">Loading…</div></div></div>;
  }

  // Public candidate portal — accessible with or without login.
  if (view === 'portal') {
    return <CandidatePortal authed={!!user} onBack={user ? () => navigate('dashboard') : null} />;
  }

  if (!user) return <Login onLogin={setUser} theme={theme} toggleTheme={toggleTheme} />;

  const activeView = NAV.some((n) => n.key === view) ? view : 'dashboard';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Avatar name={user.company?.name || user.name} size="md" seed={user.company?.name} />
          <div className="brand-txt">
            <span className="co-name">{user.company?.name || 'TalentFlow'}</span>
            <small>TalentFlow Recruiter</small>
          </div>
        </div>
        <div className="spacer" />
        <button className="portal-link" onClick={() => navigate('portal')} title="Open candidate portal">
          <Icon name="external" size={15} /> Candidate portal
        </button>
        <span className="user"><Avatar name={user.name} size="sm" /> {user.name}</span>
        <ThemeToggle theme={theme} toggle={toggleTheme} />
        <button className="logout" onClick={logout}><Icon name="logout" size={15} /> Log out</button>
      </header>
      <div className="main">
        <nav className="sidebar">
          <div className="nav-section">Recruiting</div>
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item ${activeView === n.key ? 'active' : ''}`} onClick={() => navigate(n.key)}>
              <Icon name={n.icon} />
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
          <div className="sidebar-foot">Powered by TalentFlow — local-first</div>
        </nav>
        <main className="content">
          {activeView === 'dashboard' && <Dashboard companyName={user.company?.name} onNavigate={navigate} />}
          {activeView === 'candidates' && <Candidates />}
          {activeView === 'jobs' && <Jobs />}
          {activeView === 'matches' && <Matches />}
          {activeView === 'applications' && <Applications />}
          {activeView === 'screening' && <Screening />}
        </main>
      </div>
    </div>
  );
}