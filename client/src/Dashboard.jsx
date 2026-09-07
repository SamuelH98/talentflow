import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Group as GroupIcon,
  BusinessCenter as BriefcaseIcon,
  Inbox as InboxIcon,
  CalendarMonth as CalendarIcon,
  EmojiEvents as TrophyIcon,
  ListAlt as ListIcon,
  ChevronRight as ChevronRightIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, PersonAvatar, Pill, Spinner, StatusChip, timeAgo } from './kit.jsx';

function Kpi({ icon, tone, label, value, sub }) {
  const varName = { green: 'success', amber: 'warning', accent: 'accent2' }[tone] || 'primary';
  return (
    <Paper variant="outlined" sx={{ p: 2.25, height: '100%' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: `var(--mui-palette-${varName}-main)`,
            background: `color-mix(in srgb, var(--mui-palette-${varName}-main) 12%, transparent)`,
          }}
        >
          {icon}
        </Box>
      </Stack>
      <Typography sx={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.02em', mt: 0.25 }}>{value}</Typography>
      <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>{sub}</Typography>
    </Paper>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'default';
  const varName = color === 'default' ? 'text' : color;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.3,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 650,
        color: color === 'default' ? 'text.secondary' : '#fff',
        background: color === 'default'
          ? 'action.selected'
          : `var(--mui-palette-${varName}-main)`,
      }}
    >
      {score}
    </Box>
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
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.75, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Good morning, recruiter.
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5 }}>
            {companyName} — your talent pool and hiring projects at a glance.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => onNavigate('candidates')}>
            Add candidate
          </Button>
          <Button variant="outlined" startIcon={<BriefcaseIcon sx={{ fontSize: 16 }} />} onClick={() => onNavigate('jobs')}>
            Add job
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2.5, alignItems: 'center' }}>{error}</Alert>}

      {!stats ? (
        <Spinner />
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Candidates', value: stats.candidates, sub: `${stats.activeCandidates} active in pipeline`, icon: <GroupIcon fontSize="small" />, tone: 'accent' },
              { label: 'Open jobs', value: stats.openJobs, sub: `${stats.jobs} total roles`, icon: <BriefcaseIcon fontSize="small" />, tone: 'green' },
              { label: 'Applications', value: stats.applications, sub: 'across all shortlists', icon: <InboxIcon fontSize="small" />, tone: 'amber' },
              { label: 'In interviews', value: stats.interviewCount, sub: `${stats.hiredCount} hired to date`, icon: <CalendarIcon fontSize="small" />, tone: 'green' },
            ].map((k) => (
              <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Kpi label={k.label} value={k.value} sub={k.sub} icon={k.icon} tone={k.tone} />
              </Grid>
            ))}
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
            <Button startIcon={<TrophyIcon sx={{ fontSize: 16 }} />} onClick={() => onNavigate('matches')}>
              Find best candidates
            </Button>
            <Button variant="outlined" startIcon={<ListIcon sx={{ fontSize: 16 }} />} onClick={() => onNavigate('projects')}>
              Open projects & pipeline
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ overflow: 'hidden', mb: 2.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.75, pt: 2.5 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>Top matches across open roles</Typography>
<Button variant="contained" size="small" onClick={() => onNavigate('matches')} sx={{ color: '#fff', fontWeight: 600 }}>
                  View all <ChevronRightIcon sx={{ fontSize: 14 }} />
                </Button>
            </Stack>
            {stats.top.length === 0 ? (
              <EmptyState title="No matches yet" message="Add candidates and jobs, then visit Best Candidates to see who ranks on top." />
            ) : (
              <TableContainer>
                <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
                  <TableHead>
                    <TableRow>
                      {['Candidate', 'Job', 'Skills', 'Score'].map((h) => (
                        <TableCell key={h} sx={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.disabled', py: 1.25 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.top.map((c) => (
                      <TableRow key={`${c.id}-${c.job_title}`} hover onClick={() => onNavigate('matches')} sx={{ cursor: 'pointer' }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                            <PersonAvatar name={c.name} size="sm" seed={c.id} />
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</Typography>
                              <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{c.title || c.location || '—'}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{c.job_title}</TableCell>
                        <TableCell>
                          {(c.skills || []).slice(0, 3).map((s) => <Pill key={`${c.id}-${s}`}>{s}</Pill>)}
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={c.score} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.75 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em', mb: 1.75 }}>Recent pipeline activity</Typography>
            {recent.length === 0 ? (
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                Shortlist a candidate from Best Candidates to start your pipeline.
              </Typography>
            ) : (
              <Box>
                {recent.map((a) => (
                  <Stack
                    key={a.id}
                    direction="row"
                    spacing={1.5}
                    sx={{ py: 1.4, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' }, alignItems: 'center' }}
                  >
                    <PersonAvatar name={a.candidate_name} size="sm" seed={a.candidate_id} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13 }}>
                        <b>{a.candidate_name}</b> <span style={{ color: 'inherit' }}>→ {a.job_title}</span>
                      </Typography>
                      <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>{timeAgo(a.created_at)}</Typography>
                    </Box>
                    <StatusChip status={a.status} />
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}