import React, { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { EmojiEvents as TrophyIcon, Group as GroupIcon, ShieldOutlined as ShieldIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { api, setToken } from './api.js';
import { ThemeModeToggle } from './App.jsx';
import { brandGradient, DEFAULT_BRAND } from './theme.js';
import { CompanyMark } from './kit.jsx';

function HeroPoint({ icon, title, children }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 2.5,
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#fff' }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{children}</Typography>
      </Box>
    </Stack>
  );
}

export default function Login({ onLogin, brand, company }) {
  const [email, setEmail] = useState('demo@acmetalent.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const effBrand = company?.brand_color || brand || DEFAULT_BRAND;
  const effName = company?.name || 'TalentFlow';

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
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, bgcolor: 'background.paper' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 60px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          background: brandGradient(effBrand),
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)',
            top: -140,
            right: -140,
            pointerEvents: 'none',
          }}
        />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CompanyMark company={company} brand={effBrand} size={42} rounded={11} boxShadow="0 2px 6px rgba(16, 24, 40, 0.2)" />
          <Box sx={{ lineHeight: 1.1 }}>
            <Typography sx={{ fontWeight: 750, fontSize: 20, color: '#fff' }}>{effName}</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>
              Powered by TalentFlow
            </Typography>
          </Box>
        </Stack>

        <Box>
          <Typography component="h1" sx={{ color: '#fff', fontSize: 34, lineHeight: 1.15, letterSpacing: '-0.02em', mb: 1.5 }}>
            Find your best hires,<br />faster.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, maxWidth: 420 }}>
            One local workspace to collect candidates, define roles, and rank the strongest matches for every opening.
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 3.5 }}>
            <HeroPoint icon={<TrophyIcon sx={{ fontSize: 18 }} />} title="Ranked shortlists, automatically">
              Every candidate is scored against every role with a transparent breakdown.
            </HeroPoint>
            <HeroPoint icon={<GroupIcon sx={{ fontSize: 18 }} />} title="A candidate-facing portal">
              Let applicants apply in one click and track their status in real time.
            </HeroPoint>
            <HeroPoint icon={<ShieldIcon sx={{ fontSize: 18 }} />} title="Local by default">
              All data lives in a SQLite file on your machine. No cloud, no accounts.
            </HeroPoint>
          </Stack>
        </Box>
      </Box>

      <Stack sx={{ alignItems: 'center', px: 5, py: 4 }}>
        <Box sx={{ width: '100%', maxWidth: 380, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.disabled' }}>
            Recruiter console
          </Typography>
          <ThemeModeToggle />
        </Box>

        <Box component="form" onSubmit={submit} sx={{ width: '100%', maxWidth: 380, mt: 3 }}>
          <Typography variant="h1" sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Recruiter sign in
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3.5, fontSize: 14 }}>Welcome back — manage your pipeline.</Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            margin="normal"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            margin="normal"
          />

          <Button type="submit" size="large" disabled={busy} sx={{ width: '100%', mt: 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <Box
            sx={{
              mt: 2.5,
              fontSize: 13,
              color: 'text.secondary',
              textAlign: 'center',
              bgcolor: 'background.default',
              border: '1px dashed',
              borderColor: 'text.disabled',
              borderRadius: 2,
              px: 1.5,
              py: 1.25,
            }}
          >
            Demo login: <b>demo@acmetalent.com</b> / <b>password</b>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={openPortal}
              color="inherit"
              sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600, '&:hover': { color: 'primary.main' } }}
            >
              Not a recruiter? Browse open jobs as a candidate
            </Button>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}