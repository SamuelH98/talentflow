import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Work as WorkIcon,
  ViewKanban as ViewKanbanIcon,
  FilterAlt as FilterAltIcon,
  History as HistoryIcon,
  OpenInNew as OpenInNewIcon,
  Logout as LogoutIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Group as SearchGroupIcon,
  Work as SearchWorkIcon,
  ListAlt as SearchListIcon,
  Close as SearchCloseIcon,
} from '@mui/icons-material';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { PersonAvatar, CompanyMark } from './kit.jsx';
import { buildTheme, DEFAULT_BRAND, THEME_KEY } from './theme.js';

import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Candidates from './Candidates.jsx';
import Jobs from './Jobs.jsx';
import Projects from './Projects.jsx';
import Matches from './Matches.jsx';
import Applications from './Applications.jsx';
import Screening from './Screening.jsx';
import Audit from './Audit.jsx';
import CandidatePortal from './CandidatePortal.jsx';
import { api, getToken, setToken } from './api.js';

const NAV = [
  { key: 'dashboard', label: 'Home', icon: <DashboardIcon fontSize="small" /> },
  { key: 'candidates', label: 'Candidates', icon: <GroupIcon fontSize="small" /> },
  { key: 'jobs', label: 'My Jobs', icon: <WorkIcon fontSize="small" /> },
  { key: 'projects', label: 'Projects', icon: <ViewKanbanIcon fontSize="small" /> },
];

const TOOLS = [
  { key: 'screening', label: 'Screening', icon: <FilterAltIcon fontSize="small" /> },
  { key: 'audit', label: 'Activity log', icon: <HistoryIcon fontSize="small" /> },
];

function parseHash() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => s.split('?')[0]);
}

function hashParams() {
  const h = window.location.hash;
  const qi = h.indexOf('?');
  if (qi < 0) return {};
  return Object.fromEntries(new URLSearchParams(h.slice(qi + 1)));
}

export function ThemeModeToggle() {
  const { mode, setMode } = useColorScheme();
  const dark = mode === 'dark';
  return (
    <IconButton
      onClick={() => setMode(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
      sx={{
        width: 30,
        height: 30,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        color: 'text.secondary',
        '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
      }}
    >
      {dark ? <LightModeIcon sx={{ fontSize: 16 }} /> : <DarkModeIcon sx={{ fontSize: 16 }} />}
    </IconButton>
  );
}

function Brand({ company, sub, brand }) {
  return (
    <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
      <CompanyMark company={company} brand={brand} size={40} w={64} blurBg fit="contain" />
      <Typography sx={{ fontWeight: 750, fontSize: 17, lineHeight: 1.1, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Recruiter</Typography>
    </Stack>
  );
}

function PortalLinkButton({ onClick, children }) {
  return (
    <Button
      startIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
      onClick={onClick}
      color="inherit"
      sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600, '&:hover': { color: 'primary.main' } }}
    >
      {children}
    </Button>
  );
}

function AskOrgDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>Settings are managed by your org</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.55 }}>
          Company branding and settings can only be changed by an organization admin. Please ask your admin to
          make changes here.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}

function SettingsModal({ company, brand, onClose, onChanged }) {
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [adopting, setAdopting] = useState(null);

  const query = q.trim();
  React.useEffect(() => {
    if (query.length < 2) { setCandidates(null); setLoading(false); return; }
    setLoading(true);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.lookupCompanies(query);
        if (live) { setCandidates(r.candidates || []); setErr(''); }
      } catch (e) {
        if (live) { setCandidates([]); setErr(e.message || 'Could not search companies'); }
      } finally {
        if (live) setLoading(false);
      }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [query]);

  const adopt = async (c) => {
    setAdopting(c.name);
    setErr('');
    try {
      const res = await api.adoptCompanyBranding({ name: c.name, logoUrl: c.logoUrl, linkedinUrl: c.linkedinUrl });
      onChanged(res.company);
      onClose();
    } catch (e) {
      setErr(e.message || 'Could not adopt this company\'s branding');
      setAdopting(null);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>Company branding</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {err && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{err}</Alert>}

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CompanyMark company={company} brand={brand} size={40} rounded={9} />
          <Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Current organization</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{company?.name}</Typography>
          </Box>
        </Stack>

        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>Find a company</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.55, mb: 1.5 }}>
          Search any public company. The app will pull its logo from the web, set it as your org title, derive a
          matching brand color, and build a custom light &amp; dark theme around it.
        </Typography>
        <TextField
          autoFocus
          placeholder="Search any company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          slotProps={{ htmlInput: { 'aria-label': 'Search any company on LinkedIn' } }}
          sx={{ mb: 1.5 }}
        />

        {candidates !== null && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            {candidates.length === 0 ? (
              <Typography sx={{ p: 1.5, fontSize: 13, color: 'text.secondary' }}>
                {loading ? 'Searching the web…' : 'No companies found. Try a different name.'}
              </Typography>
            ) : candidates.map((c) => (
              <Stack key={c.name} direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 1, '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                <CompanyMark company={{ name: c.name, logo_path: null }} brand={null} size={38} rounded={8} logoSrc={c.logoUrl} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</Typography>
                  {c.linkedinUrl && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                    </Typography>
                  )}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={adopting === c.name}
                  onClick={() => adopt(c)}
                >
                  {adopting === c.name ? 'Applying…' : 'Use'}
                </Button>
              </Stack>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} sx={{ color: 'text.secondary' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const QUICK_LINKS = [
  { key: 'candidates', label: 'Candidates' },
  { key: 'jobs', label: 'My Jobs' },
  { key: 'projects', label: 'Projects' },
  { key: 'screening', label: 'Screening' },
  { key: 'audit', label: 'Activity log' },
];

function GlobalSearch({ onPick }) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const debouncedQ = value.trim();

  React.useEffect(() => {
    if (!debouncedQ) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.search(debouncedQ);
        setResults(r);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  const groups = results && [
    results.candidates.length && { key: 'candidates', label: 'Candidates', icon: <SearchGroupIcon fontSize="small" />, items: results.candidates.map((i) => ({ id: i.id, title: i.name, sub: i.title, type: 'candidate' })) },
    results.jobs.length && { key: 'jobs', label: 'Jobs', icon: <SearchWorkIcon fontSize="small" />, items: results.jobs.map((i) => ({ id: i.id, title: i.title, sub: i.location || i.department, type: 'job' })) },
    results.applications.length && { key: 'applications', label: 'Applications', icon: <SearchListIcon fontSize="small" />, items: results.applications.map((i) => ({ id: i.id, title: i.candidate_name, sub: i.job_title, type: 'application' })) },
  ].filter(Boolean);

  const total = results ? results.candidates.length + results.jobs.length + results.applications.length : 0;

  const pick = (appKey, q = debouncedQ) => {
    setOpen(false);
    setValue('');
    setResults(null);
    onPick(appKey, q);
  };

  const submit = (e) => {
    if (e.key !== 'Enter') return;
    if (debouncedQ) pick('candidates', debouncedQ);
  };

  return (
    <Box
      sx={{ position: 'relative', width: { xs: '100%', md: 320 }, maxWidth: 420, flexGrow: { xs: 1, md: 0 }, flexShrink: 0 }}
      onBlur={() => setTimeout(() => setOpen(false), 120)}
    >
      <SearchIcon sx={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'text.disabled', pointerEvents: 'none', zIndex: 1 }} />
      <TextField
        size="small"
        placeholder="Search…"
        value={value}
        fullWidth
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={submit}
        slotProps={{
          input: {
            sx: {
              pl: 3.5, pr: 3, py: 0.35,
              height: 30,
              borderRadius: 2.5,
              bgcolor: 'action.selected',
              border: '1px solid',
              borderColor: 'divider',
              fontSize: 12.5,
              '& fieldset': { border: 'none' },
              '&:hover': { borderColor: 'text.disabled' },
              '&:focus-within': { borderColor: 'primary.main', bgcolor: 'background.paper' },
              '&::placeholder': { color: 'text.disabled', opacity: 1 },
            },
          },
          inputProps: { 'aria-label': 'Global search' },
        }}
      />
      {value && (
        <IconButton
          size="small"
          onClick={() => { setValue(''); setResults(null); setOpen(true); }}
          sx={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'text.disabled' }}
          aria-label="Clear search"
        >
          <SearchCloseIcon sx={{ fontSize: 15 }} />
        </IconButton>
      )}
      {open && (
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: { xs: 0, sm: 360 },
            zIndex: 1500,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.25,
            boxShadow: '0 8px 24px rgba(16,24,40,0.12)',
            overflow: 'hidden',
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {!debouncedQ && (
            <>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.disabled', px: 2, pt: 1.25, pb: 0.5 }}>
                Jump to
              </Typography>
              {QUICK_LINKS.map((s) => (
                <ListItemButton key={s.key} onClick={() => pick(s.key, '')} sx={{ px: 2, py: 0.8 }}>
                  <ListItemIcon sx={{ minWidth: 30, color: 'text.disabled' }}><SearchIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                  <ListItemText primary={<Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</Typography>} />
                </ListItemButton>
              ))}
            </>
          )}

          {debouncedQ && loading && (
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 2, py: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid', borderColor: 'divider', borderTopColor: 'primary.main', animation: 'spin 0.7s linear infinite' }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Searching…</Typography>
            </Stack>
          )}

          {debouncedQ && !loading && results && groups.length === 0 && (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>No matches for “{debouncedQ}”</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>
                Browse <Box component="span" onClick={() => pick('candidates')} sx={{ color: 'primary.main', cursor: 'pointer' }}>candidates</Box>,{' '}
                <Box component="span" onClick={() => pick('jobs')} sx={{ color: 'primary.main', cursor: 'pointer' }}>jobs</Box>, or{' '}
                <Box component="span" onClick={() => pick('applications')} sx={{ color: 'primary.main', cursor: 'pointer' }}>applications</Box> anyway.
              </Typography>
            </Box>
          )}

          {debouncedQ && !loading && results && groups.length > 0 && (
            <>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 12, color: 'text.disabled', fontWeight: 600 }}>
                  {total} result{total === 1 ? '' : 's'} for “{debouncedQ}”
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>↵ opens Candidates</Typography>
              </Stack>
              {groups.map((g) => (
                <Box key={g.key} sx={{ py: 0.5 }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.disabled', px: 2, py: 0.75 }}>
                    {g.label}
                  </Typography>
                  {g.items.map((it) => (
                    <ListItemButton key={`${g.key}-${it.id}`} onClick={() => pick(g.key)} sx={{ px: 2, py: 0.9 }}>
                      <ListItemIcon sx={{ minWidth: 30, color: 'text.disabled' }}>{g.icon}</ListItemIcon>
                      <ListItemText
                        primary={<Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{it.title}</Typography>}
                        secondary={<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{it.sub}</Typography>}
                      />
                    </ListItemButton>
                  ))}
                </Box>
              ))}
            </>
          )}
        </Box>
      )}
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </Box>
  );
}

function AppShell({ user, activeView, navigate, logout, brand, onCompanyChanged }) {
  const isDesktop = useMediaQuery((t) => t.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleGlobalPick = (section, query) => {
    setSearchQuery(query);
    navigate(section);
  };

  const navItem = (n, compact) => (
    <Box
      key={n.key}
      onClick={() => { navigate(n.key); setOpen(false); if (searchQuery) setSearchQuery(''); }}
      title={n.label}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        py: 0.9,
        px: 1,
        borderRadius: 2,
        mx: compact ? 1 : 0,
        cursor: 'pointer',
        color: 'nav.contrastText',
        opacity: activeView === n.key ? 1 : 0.68,
        bgcolor: activeView === n.key ? 'rgba(255,255,255,0.14)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', opacity: 1 },
        textAlign: 'center',
      }}
    >
      <Box sx={{ display: 'flex', color: 'inherit' }}>{n.icon}</Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1, color: activeView === n.key ? '#fff' : 'inherit' }}>{n.label.replace('My Jobs', 'Jobs')}</Typography>
    </Box>
  );

  const rail = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 1.25, bgcolor: 'nav.main' }}>
      <Box sx={{ px: 1.25, mb: 0.5 }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'nav.contrastText', opacity: 0.55, textAlign: 'center' }}>
          Hire
        </Typography>
      </Box>
      {NAV.map((n) => navItem(n, true))}
      <Box sx={{ height: 14 }} />
      {TOOLS.map((n) => navItem(n, true))}
      <Box sx={{ mt: 'auto', px: 1.5, pb: 1, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 9, color: 'nav.contrastText', opacity: 0.45, lineHeight: 1.35 }}>
          {user.company?.name}
          <br />Powered by TalentFlow
        </Typography>
      </Box>
    </Box>
  );

  const list = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 1, bgcolor: 'nav.main' }}>
      <ListSubheader component="div" sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'nav.contrastText', opacity: 0.65, my: 0.5, bgcolor: 'inherit' }}>
        Recruiting
      </ListSubheader>
      <List dense>
        {NAV.map((n) => (
          <ListItemButton
            key={n.key}
            selected={activeView === n.key}
            onClick={() => { navigate(n.key); setOpen(false); if (searchQuery) setSearchQuery(''); }}
            sx={{ color: activeView === n.key ? undefined : 'nav.contrastText' }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: n.key === activeView ? '#fff' : 'nav.contrastText', opacity: n.key === activeView ? 1 : 0.7 }}>
              {n.icon}
            </ListItemIcon>
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
        <ListSubheader component="div" sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'nav.contrastText', opacity: 0.65, my: 0.5, bgcolor: 'inherit' }}>
          Recruiting tools
        </ListSubheader>
        {TOOLS.map((n) => (
          <ListItemButton
            key={n.key}
            selected={activeView === n.key}
            onClick={() => { navigate(n.key); setOpen(false); }}
            sx={{ color: activeView === n.key ? undefined : 'nav.contrastText' }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: n.key === activeView ? '#fff' : 'nav.contrastText', opacity: n.key === activeView ? 1 : 0.7 }}>
              {n.icon}
            </ListItemIcon>
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto', px: 2, py: 1.5, fontSize: 12, color: 'nav.contrastText', opacity: 0.6, borderTop: '1px dashed', borderColor: 'divider' }}>
        Powered by TalentFlow — local-first
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1200 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 60,
            px: { xs: 2, md: 2.75 },
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'saturate(1.4) blur(8px)',
          }}
        >
          {!isDesktop && (
            <IconButton onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
          )}
          <Brand company={user.company} sub="Recruiter" brand={brand} />
          <Box sx={{ flex: { xs: 0, md: 1 } }} />
          <GlobalSearch onPick={handleGlobalPick} />
          <Box sx={{ flex: { xs: 0, md: 1 } }} />
          <PortalLinkButton onClick={() => navigate('portal')}>Candidate portal</PortalLinkButton>
          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={0.75}>
            <PersonAvatar name={user.name} size="sm" />
            <Typography sx={{ color: 'text.secondary', fontSize: 13, display: { xs: 'none', sm: 'block' } }}>{user.name}</Typography>
          </Stack>
          {user.role === 'admin' && (
            <>
              <IconButton
                onClick={() => setSettingsOpen(true)}
                title="Organization settings"
                aria-label="Organization settings"
                sx={{
                  width: 30,
                  height: 30,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
                }}
              >
                <SettingsIcon sx={{ fontSize: 16 }} />
              </IconButton>
              {settingsOpen && (
                <SettingsModal
                  company={user.company}
                  brand={brand}
                  onClose={() => setSettingsOpen(false)}
                  onChanged={onCompanyChanged}
                />
              )}
            </>
          )}
          {user.role !== 'admin' && (
            <IconButton
              onClick={() => setAskOpen(true)}
              title="Organization settings"
              aria-label="Organization settings"
              sx={{
                width: 30,
                height: 30,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                color: 'text.secondary',
                '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
              }}
            >
              <SettingsIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <AskOrgDialog open={askOpen} onClose={() => setAskOpen(false)} />
          <ThemeModeToggle />
          <Button
            startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
            onClick={logout}
            color="inherit"
            sx={{ color: 'text.secondary', fontSize: 13, '&:hover': { color: 'error.main' } }}
          >
            Log out
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex' }}>
        {isDesktop ? (
          <Box
            sx={{
              width: 76,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'nav.main',
              alignSelf: 'flex-start',
              position: 'sticky',
              top: 60,
              height: 'calc(100vh - 60px)',
              overflowY: 'auto',
            }}
          >
            {rail}
          </Box>
        ) : (
          <Drawer open={open} onClose={() => setOpen(false)} sx={{ '& .MuiDrawer-paper': { width: 240, bgcolor: 'nav.main' } }}>
            {list}
          </Drawer>
        )}

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3.5 }, minWidth: 0 }}>
          {activeView === 'dashboard' && <Dashboard companyName={user.company?.name} onNavigate={navigate} />}
          {activeView === 'candidates' && <Candidates query={hashParams().q || searchQuery} />}
          {activeView === 'jobs' && <Jobs query={hashParams().q || searchQuery} />}
          {activeView === 'projects' && <Projects jobId={hashParams().job} />}
          {activeView === 'matches' && <Matches query={hashParams().job} />}
          {activeView === 'applications' && <Applications query={searchQuery} />}
          {activeView === 'screening' && <Screening />}
          {activeView === 'audit' && <Audit companyName={user.company?.name} />}
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(() => parseHash());
  const [publicCompany, setPublicCompany] = useState(null);

  React.useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (user) return;
    let cancelled = false;
    api.publicCompany()
      .then((c) => { if (!cancelled) setPublicCompany(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const navigate = (key) => { window.location.hash = `/${key}`; };
  const logout = () => { setToken(null); setUser(null); navigate('dashboard'); };

  const brand = (user?.company?.brand_color) || publicCompany?.brand_color || DEFAULT_BRAND;
  const navColor = (user?.company?.nav_color) || publicCompany?.nav_color || null;
  const accentColor = (user?.company?.accent_color) || publicCompany?.accent_color || null;
  const recruiterThemeM = React.useMemo(() => buildTheme({ kind: 'recruiter', brand, nav: navColor, accent: accentColor }), [brand, navColor, accentColor]);
  const portalThemeM = React.useMemo(() => buildTheme({ kind: 'portal', brand, nav: navColor, accent: accentColor }), [brand, navColor, accentColor]);

  const syncCompany = (company) => setUser((u) => (u ? { ...u, company } : u));

  const view = route[0] || 'dashboard';
  const VALID_VIEWS = new Set([...NAV.map((n) => n.key), ...TOOLS.map((n) => n.key), 'matches', 'applications']);
  const activeView = VALID_VIEWS.has(view) ? view : 'dashboard';

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', color: 'text.secondary' }}>
        Loading…
      </Box>
    );
  }

  if (view === 'portal') {
    return (
      <ThemeProviderWrapper theme={portalThemeM} defaultMode="light">
        <CandidatePortal authed={!!user} onBack={user ? () => navigate('dashboard') : null} />
      </ThemeProviderWrapper>
    );
  }

  return (
    <ThemeProviderWrapper theme={recruiterThemeM} defaultMode="system">
      {user ? (
        <AppShell user={user} activeView={activeView} navigate={navigate} logout={logout} brand={brand} onCompanyChanged={syncCompany} />
      ) : (
        <Login onLogin={setUser} brand={brand} company={publicCompany} />
      )}
    </ThemeProviderWrapper>
  );
}

function ThemeProviderWrapper({ theme, defaultMode, children }) {
  return (
    <ThemeProvider theme={theme} defaultMode={defaultMode} modeStorageKey={THEME_KEY} disableTransitionOnChange>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}