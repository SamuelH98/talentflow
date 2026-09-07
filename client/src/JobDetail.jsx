import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Route as RouteIcon } from '@mui/icons-material';
import { api, formatSalary } from './api.js';
import { Pill, Spinner, StatusChip } from './kit.jsx';

export default function JobDetail({ jobId, onClose, onPipeline }) {
  const [job, setJob] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!jobId) return;
    setJob(null); setErr('');
    api.job(jobId).then(setJob).catch((e) => setErr(e.message));
  }, [jobId]);

  const openMatches = () => { window.location.hash = `/matches?job=${jobId}`; };

  return (
    <Drawer open onClose={onClose} anchor="right" slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560, md: 600 }, maxWidth: '100%' } } }}>
      {!job ? (
        <Box sx={{ p: 4 }}>{err ? <Typography sx={{ color: 'error.main' }}>{err}</Typography> : <Spinner label="Loading job…" />}</Box>
      ) : (
        <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', px: 3, py: 1.25 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>Job post</Typography>
              <IconButton size="small" onClick={onClose} aria-label="Close job detail">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontSize: 20, fontWeight: 750, letterSpacing: '-0.01em' }}>{job.title}</Typography>
              <StatusChip status={job.status} />
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5 }}>
              {[job.department, job.location, job.years_required ? `${job.years_required}+ yrs` : null, formatSalary(job.min_salary, job.max_salary)].filter(Boolean).join(' · ') || 'No details yet'}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button size="small" startIcon={<RouteIcon sx={{ fontSize: 15 }} />} onClick={() => onPipeline(job.id)}>
                Open pipeline
              </Button>
              <Button size="small" variant="outlined" onClick={openMatches}>Find best candidates</Button>
            </Stack>
          </Box>

          <Stack spacing={2.25} sx={{ px: 3, py: 2.5 }}>
            {job.description && (
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>About the job</Typography>
                <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{job.description}</Typography>
              </Box>
            )}
            {job.requirements?.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>Requirements</Typography>
                <Stack spacing={1}>
                  {job.requirements.map((r) => (
                    <Stack key={r} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.disabled', mt: 0.7, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 13.5 }}>{r}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
            {job.skills?.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>Required skills</Typography>
                <Box>{job.skills.map((s) => <Pill key={s}>{s}</Pill>)}</Box>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}