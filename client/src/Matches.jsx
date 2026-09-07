import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { api, getToken } from './api.js';
import { BreakdownBars, EmptyState, Pill, ScoreCircle, Spinner } from './kit.jsx';

function CandidateCard({ c, job, onShortlist }) {
  const [open, setOpen] = useState(false);
  return (
    <Paper variant="outlined" sx={{ p: 2.25, mb: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <ScoreCircle score={c.score} />
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{c.name}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            {c.title || 'No title'} · {c.location || '—'}
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : 'Details'}
        </Button>
        <Button size="small" onClick={() => onShortlist(job, c)}>Shortlist</Button>
      </Stack>
      {open && (
        <Box sx={{ mt: 1.5 }}>
          {c.summary && <Typography sx={{ fontSize: 13 }}>{c.summary}</Typography>}
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>Skills</Typography>
            <Box>{(c.skills || []).map((s) => <Pill key={s}>{s}</Pill>)}</Box>
          </Stack>
          <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 1.5 }}>Match breakdown</Typography>
          <BreakdownBars b={c.breakdown} />
          {c.breakdown?.skillHits?.length > 0 && (
            <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 1 }}>
              Overlapping skills: {c.breakdown.skillHits.join(', ')}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default function Matches({ query: jobQuery = '' }) {
  const [jobs, setJobs] = useState([]);
  const [candCount, setCandCount] = useState({ total: 0, active: 0 });
  const [selectedJob, setSelectedJob] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shortlistMsg, setShortlistMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [jobList, candList, matches] = await Promise.all([api.jobs(), api.candidates(), api.matchesAll()]);
        setJobs(jobList);
        setCandCount({ total: candList.length, active: candList.filter((c) => c.status !== 'archived').length });
        const fromQuery = jobQuery ? Number(jobQuery) : 0;
        const initial = jobList.find((j) => j.id === fromQuery) || jobList[0];
        if (initial) {
          setSelectedJob(initial);
          const full = await api.jobMatches(initial.id);
          setData(full);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobQuery]);

  const selectJob = async (id) => {
    setSelectedJob(jobs.find((j) => j.id === id));
    setLoading(true); setError('');
    try { setData(await api.jobMatches(id)); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const shortlist = async (job, c) => {
    try {
      await api.createApplication({ job_id: job.id, candidate_id: c.id, score: c.score, notes: `Matched ${c.score}/100` });
      setShortlistMsg(`Shortlisted ${c.name} for ${job.title}`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!getToken()) return null;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.75, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Best Candidates</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5, maxWidth: 640 }}>
            Ranked by skills, experience fit and required years. Scoring: 50% skill match · 30% experience fit · 20% required years.
          </Typography>
        </Box>
        <Box sx={{ minWidth: 220 }}>
          <InputLabel shrink htmlFor="job-select" sx={{ fontSize: 12, color: 'text.secondary' }}>Job</InputLabel>
          <Select id="job-select" size="small" value={selectedJob?.id || ''} onChange={(e) => selectJob(Number(e.target.value))} fullWidth>
            {jobs.map((j) => <MenuItem key={j.id} value={j.id}>{j.title}</MenuItem>)}
          </Select>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}
      {loading && <Spinner label="Loading matches…" />}

      {!loading && data && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2.25, height: '100%' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>Job</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 700, mt: 0.25 }}>{data.job.title}</Typography>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>matching against {candCount.active} active candidates</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2.25, height: '100%' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>Candidates ranked</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.02em', mt: 0.25 }}>{data.candidates.length}</Typography>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>from {candCount.total} total in pipeline</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2.25, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>Top match</Typography>
                <Box sx={{ mt: 1 }}>
                  {data.candidates[0] ? <ScoreCircle score={data.candidates[0].score} /> : <Typography sx={{ fontSize: 18 }}>—</Typography>}
                </Box>
                <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>{data.candidates[0]?.name || 'no candidates'}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Typography sx={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em', mb: 1.5 }}>Ranked candidates</Typography>
          {data.candidates.length === 0 ? (
            <Paper variant="outlined">
              <EmptyState title="No candidates" message="Add candidates to see who matches." />
            </Paper>
          ) : (
            <Box>
              {data.candidates.map((c, i) => (
                <Stack key={c.id} direction="row" sx={{ alignItems: 'flex-start' }} spacing={1.25}>
                  <Typography sx={{ minWidth: 30, textAlign: 'center', pt: 2.5, fontWeight: 700, color: 'text.disabled', fontSize: 18 }}>
                    {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <CandidateCard c={c} job={data.job} onShortlist={shortlist} />
                  </Box>
                </Stack>
              ))}
            </Box>
          )}
        </>
      )}

      <Snackbar
        open={!!shortlistMsg}
        autoHideDuration={3000}
        onClose={() => setShortlistMsg('')}
        message={shortlistMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}