import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  FilterAlt as FilterIcon,
  ViewKanban as KanbanIcon,
} from '@mui/icons-material';
import { api, formatSalary } from './api.js';
import { ConfirmDialog, EmptyState, Pill, Spinner, stageLabel, StatusChip, TagInput } from './kit.jsx';
import JobForm from './JobForm.jsx';
import JobQuestions from './JobQuestions.jsx';
import JobDetail from './JobDetail.jsx';

const STAGE_ORDER = ['matched', 'in_review', 'interview', 'hired', 'rejected'];

export default function Jobs({ query = '' }) {
  const [items, setItems] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [questionsJob, setQuestionsJob] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [jobs, apps] = await Promise.all([api.jobs(), api.applications()]);
      setItems(jobs);
      setApplications(apps);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => items.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (q && ![j.title, j.department, j.location, j.description].join(' ').toLowerCase().includes(q)) return false;
    return true;
  }), [items, q, statusFilter]);

  const appCounts = useMemo(() => {
    const map = {};
    for (const a of applications) {
      map[a.job_id] = map[a.job_id] || {};
      map[a.job_id][a.status] = (map[a.job_id][a.status] || 0) + 1;
    }
    return map;
  }, [applications]);

  const save = async (form) => {
    try {
      if (editing) await api.updateJob(editing.id, form);
      else await api.createJob(form);
      setEditing(null); setAdding(false); await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async () => {
    try { await api.deleteJob(deleteId); setDeleteId(null); await load(); } catch (e) { setError(e.message); }
  };

  const openPipeline = (id) => { window.location.hash = `/projects?job=${id}`; };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 21, fontWeight: 750, letterSpacing: '-0.02em' }}>My jobs</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.4 }}>
            {visible.length} job{(visible.length === 1 ? '' : 's')} — manage requirements, applicants, and hiring pipelines
          </Typography>
        </Box>
        <Button startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAdding(true)}>Add job</Button>
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ mb: 2 }}>
        {[{ key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'closed', label: 'Closed' }].map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            clickable
            onClick={() => setStatusFilter(s.key)}
            sx={{
              fontWeight: 700,
              fontSize: 12.5,
              height: 30,
              borderRadius: 2,
              ...(statusFilter === s.key
                ? { bgcolor: 'primary.main', color: '#fff' }
                : { bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', color: 'text.secondary' }),
            }}
          />
        ))}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}

      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : visible.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState
            icon={<Box sx={{ fontSize: 36 }}>💼</Box>}
            title={q || statusFilter !== 'all' ? 'No matching jobs' : 'No jobs yet'}
            message={q || statusFilter !== 'all' ? 'Try a different search or status.' : 'Create a job to start hiring — candidates will be matched automatically.'}
          />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {visible.map((j, idx) => {
            const counts = appCounts[j.id] || {};
            const total = STAGE_ORDER.reduce((n, s) => n + (counts[s] || 0), 0);
            return (
              <Stack
                key={j.id}
                direction="row"
                spacing={1.75}
                sx={{
                  p: 2,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  ...(idx !== 0 && { borderTop: '1px solid', borderColor: 'divider' }),
                }}
                onClick={() => setDetailId(j.id)}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: 'action.selected', display: 'grid', placeItems: 'center', color: 'primary.main', flexShrink: 0 }}>
                  <KanbanIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 750 }}>{j.title}</Typography>
                    <StatusChip status={j.status} />
                  </Stack>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.3 }}>
                    {[j.department, j.location, j.years_required ? `${j.years_required}+ yrs` : null, formatSalary(j.min_salary, j.max_salary)].filter(Boolean).join(' · ') || 'No details yet'}
                  </Typography>
                  {j.description && (
                    <Typography sx={{ fontSize: 13, mt: 0.5, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {j.description}
                    </Typography>
                  )}
                  {(j.skills || []).length > 0 && (
                    <Box sx={{ mt: 0.75 }}>
                      {(j.skills || []).slice(0, 5).map((s) => <Pill key={s}>{s}</Pill>)}
                    </Box>
                  )}
                  {total > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      {STAGE_ORDER.filter((s) => (counts[s] || 0) > 0).map((s) => (
                        <Chip key={s} size="small" label={`${counts[s]} · ${stageLabel(s)}`} sx={{ height: 20, fontSize: 11.5, fontWeight: 650, bgcolor: 'action.selected', color: 'text.secondary' }} />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.25, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); openPipeline(j.id); }} title="Open the hiring pipeline">
                    Pipeline
                  </Button>
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); window.location.hash = `/matches?job=${j.id}`; }}>
                    Find candidates
                  </Button>
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setQuestionsJob(j); }}>
                    Questions
                  </Button>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditing(j); }} title="Edit job" aria-label={`Edit ${j.title}`}>
                    <FilterIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteId(j.id); }} title="Delete job" aria-label={`Delete ${j.title}`} sx={{ color: 'error.main' }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              </Stack>
            );
          })}
        </Paper>
      )}

      {adding && <JobForm onSave={save} onClose={() => setAdding(false)} />}
      {editing && <JobForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      {questionsJob && <JobQuestions job={questionsJob} onClose={() => setQuestionsJob(null)} />}
      {detailId && <JobDetail jobId={detailId} onClose={() => setDetailId(null)} onPipeline={openPipeline} />}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete this job?"
        message="This removes the role and its shortlists. Past applications stay on file."
        onConfirm={remove}
        onClose={() => setDeleteId(null)}
      />
    </Box>
  );
}