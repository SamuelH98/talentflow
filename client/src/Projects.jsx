import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Search as SearchIcon, ViewKanban as KanbanIcon } from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, PersonAvatar, PIPELINE_STAGES, Spinner } from './kit.jsx';
import CandidateProfile from './CandidateProfile.jsx';

export default function Projects({ jobId: preselected }) {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [js, as] = await Promise.all([api.jobs(), api.applications()]);
      setJobs(js);
      setApplications(as);
      setSelected((prev) => {
        if (prev && js.some((j) => j.id === prev)) return prev;
        return preselected && js.some((j) => j.id === Number(preselected)) ? Number(preselected) : (js[0]?.id ?? null);
      });
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [preselected]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (preselected && jobs.some((j) => j.id === Number(preselected))) setSelected(Number(preselected));
  }, [preselected, jobs]);

  const jobApps = useMemo(
    () => applications.filter((a) => a.job_id === selected),
    [applications, selected]
  );

  const move = async (app, dir) => {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === app.status);
    const nextIdx = Math.max(0, Math.min(PIPELINE_STAGES.length - 1, idx + dir));
    const next = PIPELINE_STAGES[nextIdx];
    if (next.key === app.status) return;
    try {
      await api.updateApplicationStatus(app.id, { status: next.key });
      setApplications((list) => list.map((a) => (a.id === app.id ? { ...a, status: next.key } : a)));
    } catch (e) { setError(e.message); }
  };

  const selectedJob = jobs.find((j) => j.id === selected);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 21, fontWeight: 750, letterSpacing: '-0.02em' }}>Projects</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.4 }}>
            Pick a project and move candidates through the hiring pipeline.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SearchIcon sx={{ fontSize: 16 }} />}
          onClick={() => { window.location.hash = '/candidates'; }}
        >
          Search candidates
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}

      {loading ? (
        <Spinner label="Loading projects…" />
      ) : jobs.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState
            icon={<KanbanIcon sx={{ fontSize: 26 }} />}
            title="No projects yet"
            message="Create a job — it becomes a project with a hiring pipeline."
            action={<Button size="small" onClick={() => { window.location.hash = '/jobs'; }}>Go to My Jobs</Button>}
          />
        </Paper>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Paper variant="outlined" sx={{ width: { xs: '100%', lg: 260 }, flexShrink: 0, overflow: 'hidden' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', px: 2, pt: 1.5, pb: 1 }}>
              All projects
            </Typography>
            <Box>
              {jobs.map((j) => {
                const count = applications.filter((a) => a.job_id === j.id).length;
                return (
                  <Box
                    key={j.id}
                    onClick={() => setSelected(j.id)}
                    sx={{
                      px: 2,
                      py: 1.25,
                      cursor: 'pointer',
                      borderLeft: '3px solid',
                      borderColor: selected === j.id ? 'primary.main' : 'transparent',
                      bgcolor: selected === j.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, fontWeight: selected === j.id ? 750 : 600 }}>{j.title}</Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {j.status === 'open' ? 'Open' : 'Closed'} · {count} candidate{(count === 1 ? '' : 's')}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {selectedJob && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 750 }}>{selectedJob.title}</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>— {selectedJob.department || 'No department'}</Typography>
              </Stack>
              <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 1.5, minHeight: 400 }}>
                {PIPELINE_STAGES.map((s) => {
                  const cards = jobApps.filter((a) => a.status === s.key);
                  return (
                    <Box key={s.key} sx={{ flex: '1 1 0', minWidth: 185, maxWidth: 264, display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: `var(--mui-palette-${s.color === 'default' ? 'text' : s.color}-main)` }} />
                        <Typography sx={{ fontSize: 13, fontWeight: 750 }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.disabled', fontWeight: 700 }}>{cards.length}</Typography>
                      </Stack>
                      <Box sx={{ flex: 1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.02)', border: '1px dashed', borderColor: 'divider', p: 0.75, minHeight: 120 }}>
                        {cards.length === 0 ? (
                          <Typography sx={{ fontSize: 12, color: 'text.disabled', textAlign: 'center', p: 2 }}>No candidates</Typography>
                        ) : (
                          <Stack spacing={0.75}>
                            {cards.map((a) => (
                              <Box
                                key={a.id}
                                onClick={() => setOpenId(a.candidate_id)}
                                sx={{
                                  bgcolor: 'background.paper',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 2,
                                  p: 1,
                                  cursor: 'pointer',
                                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(16,24,40,0.08)' },
                                }}
                              >
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                  <PersonAvatar name={a.candidate_name} seed={a.candidate_id} size="sm" />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {a.candidate_name}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {a.candidate_title || a.candidate_location || '—'}
                                    </Typography>
                                  </Box>
                                </Stack>
                                <Stack direction="row" spacing={0.25} sx={{ mt: 0.5, justifyContent: 'flex-end' }}>
                                  <IconButton size="small" disabled={s.key === 'matched'} onClick={(e) => { e.stopPropagation(); move(a, -1); }} title="Move to previous stage" aria-label="Move to previous stage">
                                    <ChevronLeft sx={{ fontSize: 16 }} />
                                  </IconButton>
                                  <IconButton size="small" disabled={s.key === 'rejected'} onClick={(e) => { e.stopPropagation(); move(a, 1); }} title="Move to next stage" aria-label="Move to next stage">
                                    <ChevronRight sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Stack>
      )}

      <CandidateProfile candidateId={openId} open={!!openId} onClose={() => setOpenId(null)} onChanged={load} />
    </Box>
  );
}