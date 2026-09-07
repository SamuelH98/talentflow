import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { KeyboardArrowDown as KeyboardArrowDownIcon, KeyboardArrowUp as KeyboardArrowUpIcon, FilterAlt as FilterAltIcon } from '@mui/icons-material';
import { api } from './api.js';

export default function JobQuestions({ job, onClose }) {
  const [rows, setRows] = useState(null);
  const [inherited, setInherited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.jobScreening(job.id);
        setRows(cfg.questions);
        setInherited(cfg.inherited);
      } catch (e) { setErr(e.message); }
    })();
  }, [job.id]);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    setRows((r) => { const next = [...r]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  };
  const setFlag = (i, k, v) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api.saveJobScreening(job.id, rows.map((q) => ({ question_id: q.id, enabled: q.enabled, required: q.required })));
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const enabledCount = (rows || []).filter((q) => q.enabled).length;

  return (
    <Dialog open onClose={onClose} maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterAltIcon fontSize="small" /> Screening questions — {job.title}
      </DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{err}</Alert>}
        {!rows && <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>}
        {rows && (
          <>
            <Alert severity="info" sx={{ mb: 2, alignItems: 'flex-start' }}>
              {inherited
                ? `Inheriting company defaults — ${enabledCount} question${enabledCount === 1 ? '' : 's'} will appear for this job. Saving below overrides the defaults for this job.`
                : `${enabledCount} enabled for this job (custom set, no longer inherited).`}
            </Alert>
            <Stack spacing={1}>
              {rows.map((q, i) => (
                <Stack
                  key={q.id}
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1.25,
                    bgcolor: 'background.default',
                    opacity: q.enabled ? 1 : 0.62,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: q.enabled ? 700 : 400 }}>{q.label}</Typography>
                    {!q.enabled && <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>Not asked on this job's apply form</Typography>}
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => move(i, 1)} disabled={i === rows.length - 1} title="Move down">
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <FormControlLabel
                    sx={{ mr: 0, whiteSpace: 'nowrap' }}
                    control={<Checkbox checked={!!q.required} onChange={(e) => setFlag(i, 'required', e.target.checked)} disabled={!q.enabled} />}
                    label="Required"
                  />
                  <Switch checked={!!q.enabled} onChange={(e) => setFlag(i, 'enabled', e.target.checked)} />
                </Stack>
              ))}
            </Stack>
            {saved && <Alert severity="success" sx={{ mt: 2 }}>Saved — candidates will see the new set.</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button onClick={save} disabled={busy || !rows || saved}>{busy ? 'Saving…' : 'Save for this job'}</Button>
      </DialogActions>
    </Dialog>
  );
}