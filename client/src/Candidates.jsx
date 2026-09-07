import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ArchiveIcon,
  Clear as ClearIcon,
  FilterAlt as FilterIcon,
  Search as SearchIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, PersonAvatar, Pill, Spinner, StatusChip, TagInput } from './kit.jsx';
import CandidateForm from './CandidateForm.jsx';
import CandidateProfile from './CandidateProfile.jsx';

function FilterLabel({ children }) {
  return <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5, color: 'text.secondary' }}>{children}</Typography>;
}

export default function Candidates({ query = '' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: query, title: '', location: '', skills: [], minYrs: '', maxYrs: '', status: 'all' });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await api.candidates()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (query) setFilters((f) => ({ ...f, q: query })); }, [query]);

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const title = filters.title.trim().toLowerCase();
    const location = filters.location.trim().toLowerCase();
    const skills = (filters.skills || []).map((s) => s.toLowerCase());
    return items.filter((c) => {
      if (filters.status !== 'all' && c.status !== filters.status) return false;
      if (q && ![c.name, c.email, c.title, c.location, c.summary, c.resume_text, (c.skills || []).join(' ')].join(' ').toLowerCase().includes(q)) return false;
      if (title && !String(c.title || '').toLowerCase().includes(title)) return false;
      if (location && !String(c.location || '').toLowerCase().includes(location)) return false;
      if (skills.length) {
        const candSkills = (c.skills || []).map((s) => s.toLowerCase());
        if (!skills.every((s) => candSkills.some((cs) => cs.includes(s)))) return false;
      }
      const yrs = Number(c.years_experience) || 0;
      if (filters.minYrs !== '' && yrs < Number(filters.minYrs)) return false;
      if (filters.maxYrs !== '' && yrs > Number(filters.maxYrs)) return false;
      return true;
    });
  }, [items, filters]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clearAll = () => setFilters({ q: '', title: '', location: '', skills: [], minYrs: '', maxYrs: '', status: 'all' });
  const hasFilters = filters.q || filters.title || filters.location || filters.skills.length || filters.minYrs !== '' || filters.maxYrs !== '' || filters.status !== 'all';

  const save = async (form) => {
    try {
      if (editing) await api.updateCandidate(editing.id, form);
      else await api.createCandidate(form);
      setEditing(null); setAdding(false); await load();
    } catch (e) { setError(e.message); }
  };

  const toggleArchive = async (c) => {
    try { await api.updateCandidate(c.id, { status: c.status === 'archived' ? 'active' : 'archived' }); await load(); } catch (e) { setError(e.message); }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 21, fontWeight: 750, letterSpacing: '-0.02em' }}>Candidate search</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.4 }}>
            {visible.length} candidate{(visible.length === 1 ? '' : 's')}{hasFilters ? ' match your criteria' : ' in your talent pool'}
          </Typography>
        </Box>
        <Button startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAdding(true)}>Add candidate</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Paper
          variant="outlined"
          sx={{ width: { xs: '100%', md: 270 }, flexShrink: 0, p: 2, position: { md: 'sticky' }, top: 78, maxHeight: { md: 'calc(100vh - 110px)' }, overflowY: 'auto' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <FilterIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 14, fontWeight: 750 }}>Filters</Typography>
            </Stack>
            {hasFilters && (
              <Button size="small" startIcon={<ClearIcon sx={{ fontSize: 14 }} />} onClick={clearAll} sx={{ color: 'text.secondary', fontSize: 12.5, textTransform: 'inherit' }}>
                Clear all
              </Button>
            )}
          </Stack>

          <Stack spacing={1.75}>
            <Box>
              <FilterLabel>Keywords</FilterLabel>
              <TextField
                size="small"
                placeholder="Name, title, skill…"
                value={filters.q}
                onChange={(e) => set('q', e.target.value)}
                slotProps={{ input: { startAdornment: <SearchIcon sx={{ fontSize: 15, color: 'text.disabled', mr: 0.75 }} /> } }}
              />
            </Box>
            <Box>
              <FilterLabel>Job title</FilterLabel>
              <TextField size="small" placeholder="e.g. Frontend engineer" value={filters.title} onChange={(e) => set('title', e.target.value)} />
            </Box>
            <Box>
              <FilterLabel>Location</FilterLabel>
              <TextField size="small" placeholder="City, region…" value={filters.location} onChange={(e) => set('location', e.target.value)} />
            </Box>
            <Box>
              <FilterLabel>Must have skills</FilterLabel>
              <TagInput value={filters.skills} onChange={(v) => set('skills', v)} placeholder="Type & press Enter" />
            </Box>
            <Stack direction="row" spacing={1}>
              <Box sx={{ flex: 1 }}>
                <FilterLabel>Min yrs</FilterLabel>
                <TextField size="small" type="number" slotProps={{ htmlInput: { min: 0, step: 0.5 } }} value={filters.minYrs} onChange={(e) => set('minYrs', e.target.value)} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FilterLabel>Max yrs</FilterLabel>
                <TextField size="small" type="number" slotProps={{ htmlInput: { min: 0, step: 0.5 } }} value={filters.maxYrs} onChange={(e) => set('maxYrs', e.target.value)} />
              </Box>
            </Stack>
            <Box>
              <FilterLabel>Status</FilterLabel>
              <TextField select size="small" value={filters.status} onChange={(e) => set('status', e.target.value)} slotProps={{ select: { native: true } }}>
                <option value="all">All candidates</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </TextField>
            </Box>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Spinner label="Loading candidates…" />
          ) : visible.length === 0 ? (
            <Paper variant="outlined">
              <EmptyState
                icon={<Box sx={{ fontSize: 34 }}>{hasFilters ? '🔍' : '👩‍💻'}</Box>}
                title={hasFilters ? 'No candidates match' : 'No candidates yet'}
                message={hasFilters ? 'Loosen or clear a filter to widen the pool.' : `Click "Add candidate" to build your talent pool.`}
                action={hasFilters ? <Button size="small" onClick={clearAll}>Clear all filters</Button> : null}
              />
            </Paper>
          ) : (
            <Stack spacing={1}>
              {visible.map((c) => (
                <Paper
                  key={c.id}
                  variant="outlined"
                  sx={{ p: 1.75, cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(16,24,40,0.06)' } }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <PersonAvatar name={c.name} seed={c.id} />
                    <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => setOpenId(c.id)}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 750 }}>{c.name}</Typography>
                        {c.status !== 'active' && <StatusChip status={c.status} />}
                      </Stack>
                      {c.title && <Typography sx={{ fontSize: 13.5, fontWeight: 550, color: 'text.secondary' }}>{c.title}</Typography>}
                      <Typography sx={{ fontSize: 12.5, color: 'text.disabled', mt: 0.3 }}>
                        {(c.location ? `📍 ${c.location}` : 'No location')} · {c.years_experience} yrs experience
                      </Typography>
                      {(c.skills || []).length > 0 && (
                        <Box sx={{ mt: 0.75 }}>
                          {(c.skills || []).slice(0, 4).map((s) => <Pill key={s}>{s}</Pill>)}
                          {(c.skills || []).length > 4 && <Pill>+{(c.skills.length - 4)} more</Pill>}
                        </Box>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setOpenId(c.id)}>Open profile</Button>
                      <IconButton size="small" title={c.status === 'archived' ? 'Reactivate' : 'Archive'} aria-label={c.status === 'archived' ? 'Reactivate candidate' : 'Archive candidate'} onClick={() => toggleArchive(c)}>
                        {c.status === 'archived' ? <UnarchiveIcon sx={{ fontSize: 18 }} /> : <ArchiveIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                      <Button size="small" variant="outlined" onClick={() => setEditing(c)}>Edit</Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>

      {adding && <CandidateForm onSave={save} onClose={() => setAdding(false)} />}
      {editing && <CandidateForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      <CandidateProfile candidateId={openId} open={!!openId} onClose={() => setOpenId(null)} onChanged={load} />
    </Box>
  );
}