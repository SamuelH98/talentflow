import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Archive as ArchiveIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Feed as FeedIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Unarchive as UnarchiveIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, PersonAvatar, Pill, PIPELINE_STAGES, Spinner, StageChip, timeAgo } from './kit.jsx';
import CandidateForm from './CandidateForm.jsx';

function StageMenu({ value, onChange, label }) {
  const [anchor, setAnchor] = useState(null);
  const selected = PIPELINE_STAGES.find((s) => s.key === value);
  return (
    <>
      <Button
        size="small"
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: 'inherit', fontWeight: 700 }}
      >
        {label || (selected?.label ?? value)}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {PIPELINE_STAGES.map((s) => (
          <MenuItem
            key={s.key}
            selected={s.key === value}
            onClick={() => { setAnchor(null); if (s.key !== value) onChange(s.key); }}
          >
            {s.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function AddToProjectDialog({ open, onClose, jobs, onPick }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Add to a project</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {err && <Alert severity="error" sx={{ mb: 1.5, alignItems: 'center' }}>{err}</Alert>}
        {jobs.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>
            No open projects yet. Create a job first, then shortlist candidates here.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {jobs.map((j) => (
              <Button
                key={j.id}
                variant="outlined"
                color="inherit"
                disabled={busy}
                onClick={async () => { setBusy(true); setErr(''); try { await onPick(j); onClose(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }}
                sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'inherit', color: 'text.primary', borderRadius: 2, px: 1.5, py: 1 }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 650 }}>{j.title}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{[j.department, j.location].filter(Boolean).join(' · ') || 'No location'}</Typography>
              </Button>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

function Insight({ label, value }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', fontSize: 12.5 }}>
      <WorkIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
      <span><b style={{ color: 'text.primary' }}>{label}</b> {value}</span>
    </Stack>
  );
}

export default function CandidateProfile({ candidateId, open, onClose, onChanged }) {
  const [cand, setCand] = useState(null);
  const [apps, setApps] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState({});

  const load = async (id) => {
    setErr('');
    try {
      const [c, a, j] = await Promise.all([api.candidate(id), api.applications(), api.jobs()]);
      setCand(c);
      setApps(a.filter((x) => x.candidate_id === id));
      setJobs(j.filter((x) => x.status === 'open'));
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    if (open && candidateId) {
      setCand(null); setApps(null); setTab(0); setNoteDraft({});
      load(candidateId);
    }
  }, [open, candidateId]);

  const appById = useMemo(() => new Map((apps || []).map((a) => [a.id, a])), [apps]);

  const refresh = () => onChanged && onChanged();

  const changeStage = async (appId, status) => {
    try {
      await api.updateApplicationStatus(appId, { status });
      await load(candidateId); refresh();
    } catch (e) { setErr(e.message); }
  };

  const addToProject = async (job) => {
    await api.createApplication({
      job_id: job.id,
      candidate_id: candidateId,
      score: null,
      notes: 'Added from candidate profile',
    });
    await load(candidateId); refresh();
  };

  const saveNotes = async (appId) => {
    try {
      await api.updateApplicationStatus(appId, { notes: noteDraft[appId] ?? '' });
      await load(candidateId); refresh();
    } catch (e) { setErr(e.message); }
  };

  const toggleArchive = async () => {
    try {
      await api.updateCandidate(candidateId, { status: cand?.status === 'archived' ? 'active' : 'archived' });
      await load(candidateId); refresh();
    } catch (e) { setErr(e.message); }
  };

  const saveEdit = async (form) => {
    await api.updateCandidate(candidateId, form);
    setEditing(false);
    await load(candidateId); refresh();
  };

  const archived = cand?.status === 'archived';
  const singleApp = apps && apps.length === 1 ? apps[0] : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 660, md: 700 }, maxWidth: '100%' } } }}
    >
      {!cand && (
        <Box sx={{ p: 4 }}>
          {err && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{err}</Alert>}
          <Spinner label="Loading candidate…" />
        </Box>
      )}

      {cand && (
        <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', px: 3, py: 1.25 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>Candidate profile</Typography>
              <IconButton size="small" onClick={onClose} aria-label="Close candidate profile">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {err && <Alert severity="error" sx={{ m: 2.5, alignItems: 'center' }}>{err}</Alert>}

          <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2.25 }}>
            <Stack direction="row" spacing={1.75} sx={{ alignItems: 'flex-start' }}>
              <PersonAvatar name={cand.name} seed={cand.id} size="lg" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 750, letterSpacing: '-0.01em' }}>{cand.name}</Typography>
                  {archived && <Chip size="small" label="Archived" sx={{ bgcolor: 'action.selected', color: 'text.secondary', fontWeight: 650, fontSize: 12 }} />}
                  {singleApp && <StageChip status={singleApp.status} />}
                </Stack>
                {cand.title && <Typography sx={{ fontSize: 14, fontWeight: 600, mt: 0.4 }}>{cand.title}</Typography>}
                <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.4 }}>
                  {(cand.location ? `📍 ${cand.location}` : 'No location') + (cand.email ? ` · ✉️ ${cand.email}` : '') + (cand.phone ? ` · ☎️ ${cand.phone}` : '')}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                  <Insight label="Experience" value={`${cand.years_experience} yrs`} />
                  {singleApp && <Insight label="In" value={singleApp.job_title} />}
                </Stack>
              </Box>
              <Stack direction="column" spacing={0.75}>
                <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAdding(true)}>
                  Add to project
                </Button>
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                  <IconButton size="small" title="Edit profile" aria-label="Edit candidate profile" onClick={() => setEditing(true)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" title={archived ? 'Reactivate' : 'Archive'} aria-label={archived ? 'Reactivate candidate' : 'Archive candidate'} onClick={toggleArchive}>
                    {archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                  </IconButton>
                </Stack>
              </Stack>
            </Stack>
          </Box>

          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ px: 2.5, pt: 1, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { textTransform: 'inherit', fontSize: 13.5, fontWeight: 650, minHeight: 40 } }}>
            <Tab label="About" />
            <Tab label="Applications" />
            <Tab label="Notes" />
          </Tabs>

          <Box sx={{ px: 3, py: 2.5 }}>
            {tab === 0 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.75 }}>About</Typography>
                  <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {cand.summary || cand.resume_text || 'No summary provided.'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>Work experience</Typography>
                  {cand.experience?.length ? (
                    <Stack spacing={1}>
                      {cand.experience.map((e) => (
                        <Stack key={e} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.disabled', mt: 0.7, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 13.5 }}>{e}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>No experience listed.</Typography>}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>Education</Typography>
                  {cand.education?.length ? (
                    <Stack spacing={1}>
                      {cand.education.map((e) => (
                        <Stack key={e} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.disabled', mt: 0.7, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 13.5 }}>{e}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>No education listed.</Typography>}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>Skills</Typography>
                  {cand.skills?.length ? <Box>{cand.skills.map((s) => <Pill key={s}>{s}</Pill>)}</Box> : <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>No skills listed.</Typography>}
                </Box>
              </Stack>
            )}

            {tab === 1 && (
              apps === null ? <Spinner label="Loading applications…" /> :
              apps.length === 0 ? (
                <EmptyState icon={<WorkIcon sx={{ fontSize: 26 }} />} title="Not in any project yet" message="Add this candidate to a project to move them through your hiring pipeline." />
              ) : (
                <Stack spacing={1.5}>
                  {apps.map((a) => (
                    <Box key={a.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper', p: 1.75 }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{a.job_title}</Typography>
                          <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.25 }}>
                            Added {timeAgo(a.created_at)}{a.score != null ? ` · match ${a.score}` : ''}
                          </Typography>
                        </Box>
                        <StageMenu value={a.status} label={a.status} onChange={(s) => changeStage(a.id, s)} />
                      </Stack>
                      {a.notes && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, bgcolor: 'background.default', borderRadius: 1.5, p: 1 }}>{a.notes}</Typography>}
                    </Box>
                  ))}
                </Stack>
              )
            )}

            {tab === 2 && (
              apps === null ? <Spinner label="Loading notes…" /> :
              apps.length === 0 ? (
                <EmptyState icon={<FeedIcon sx={{ fontSize: 26 }} />} title="No notes yet" message="Add this candidate to a project, then you can keep private recruiter notes here." />
              ) : (
                <Stack spacing={2}>
                  {apps.map((a) => (
                    <Box key={a.id}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.75 }}>Notes — {a.job_title}</Typography>
                      <TextField
                        multiline
                        minRows={2}
                        placeholder="Private notes for this candidate & project…"
                        value={noteDraft[a.id] ?? a.notes ?? ''}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                      />
                      <Button size="small" sx={{ mt: 0.75 }} disabled={appById.get(a.id)?.notes === (noteDraft[a.id] ?? a.notes ?? '')} onClick={() => saveNotes(a.id)}>
                        Save note
                      </Button>
                    </Box>
                  ))}
                </Stack>
              )
            )}
          </Box>
        </Box>
      )}

      {cand && <AddToProjectDialog open={adding} onClose={() => setAdding(false)} jobs={jobs || []} onPick={addToProject} />}
      {cand && editing && <CandidateForm initial={cand} onSave={saveEdit} onClose={() => setEditing(false)} />}
    </Drawer>
  );
}