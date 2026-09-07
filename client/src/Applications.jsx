import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { ChevronRight as ChevronRightIcon, FilterAlt as FilterAltIcon } from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, Pill, StatusChip } from './kit.jsx';

const STATUSES = ['matched', 'in_review', 'interview', 'hired', 'rejected'];

export default function Applications({ query = '' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await api.applications()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const q = query.trim().toLowerCase();
  const visible = q ? items.filter((a) => [a.candidate_name, a.job_title, a.notes].join(' ').toLowerCase().includes(q)) : items;

  const updateStatus = async (id, status) => {
    try {
      await api.updateApplicationStatus(id, { status });
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <Box>
      <Box sx={{ mb: 2.75 }}>
        <Typography variant="h4" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Applications</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5 }}>
          {visible.length} shortlist{visible.length === 1 ? '' : 's'}
          {q ? ` matching “${query}”` : ' — click an application to review screening answers.'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}
      {loading && <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>}

      {!loading && visible.length === 0 && (
        <Paper variant="outlined">
          <EmptyState title={q ? 'No matching applications' : 'No applications yet'} message={q ? `Nothing matched “${query}”. Try a different search.` : 'Shortlist a candidate from the Best Candidates view.'} />
        </Paper>
      )}

      {!loading &&
        visible.map((a) => (
          <Paper variant="outlined" key={a.id} sx={{ mb: 1.25, overflow: 'hidden', '&.MuiPaper-root': { borderRadius: 3 } }}>
            <Accordion
              expanded={expanded === a.id}
              onChange={(_, isOpen) => setExpanded(isOpen ? a.id : null)}
              disableGutters
              elevation={0}
              sx={{ bgcolor: 'transparent', '&::before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ChevronRightIcon sx={{ color: 'text.disabled', transform: expanded === a.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                  <StatusChip status={a.status} />
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{a.candidate_name}</Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>for {a.job_title}</Typography>
                    {a.notes && <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>{a.notes}</Typography>}
                  </Box>
                  {a.score != null && <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{Math.round(a.score)}</Typography>}
                  <Box sx={{ maxWidth: 200 }}>
                    {(a.candidate_skills || []).slice(0, 3).map((s) => <Pill key={s}>{s}</Pill>)}
                  </Box>
                  <Typography sx={{ color: 'text.secondary', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                    {(a.screening_answers || []).length} answers
                  </Typography>
                  <Box onClick={(e) => e.stopPropagation()} sx={{ minWidth: 130 }}>
                    <Select
                      size="small"
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      sx={{ fontSize: 13 }}
                    >
                      {STATUSES.map((s) => <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>)}
                    </Select>
                  </Box>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ bgcolor: 'background.default', px: 2.5, py: 2 }}>
                <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <FilterAltIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.disabled' }}>
                    Screening answers
                  </Typography>
                </Box>
                {(a.screening_answers || []).length === 0 && (
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>No screening answers submitted.</Typography>
                )}
                {(a.screening_answers || []).map((sa) => (
                  <Box key={sa.question} sx={{ px: 1.5, py: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>{sa.question}</Typography>
                    {sa.answer ? (
                      <Typography sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap', mt: 0.25 }}>{sa.answer}</Typography>
                    ) : (
                      <Typography sx={{ fontSize: 13.5, color: 'text.disabled' }}>—</Typography>
                    )}
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          </Paper>
        ))}
    </Box>
  );
}