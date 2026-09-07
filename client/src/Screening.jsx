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
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { api } from './api.js';
import { ConfirmDialog, EmptyState, Pill, StatusChip } from './kit.jsx';

const TYPE_LABELS = {
  text: 'Short answer',
  paragraph: 'Paragraph / long answer',
  single: 'Single choice',
  multiple: 'Multiple choice',
};

function emptyQuestion() {
  return { label: '', description: '', type: 'text', options: [], default_enabled: true, default_required: false };
}

function QuestionForm({ initial, onSave, onClose }) {
  const [q, setQ] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));

  const setOption = (i, k, v) => {
    const options = [...q.options];
    options[i] = { ...options[i], [k]: v };
    if (k === 'label' && !options[i].value) options[i].value = v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    set('options', options);
  };

  const save = async () => {
    setErr('');
    if (!q.label.trim()) { setErr('Question text is required.'); return; }
    if ((q.type === 'single' || q.type === 'multiple') && q.options.filter((o) => o.label.trim() && o.value.trim()).length < 2) {
      setErr('Choice questions need at least two options.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        label: q.label.trim(),
        description: q.description.trim() || null,
        type: q.type,
        options: q.type === 'single' || q.type === 'multiple' ? q.options.filter((o) => o.label.trim() && o.value.trim()).map((o) => ({ value: o.value.trim(), label: o.label.trim() })) : [],
        default_enabled: q.default_enabled,
        default_required: q.default_required,
      };
      if (q.id) await api.updateScreeningQuestion(q.id, payload);
      else await api.createScreeningQuestion(payload);
      await onSave();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choices = q.type === 'single' || q.type === 'multiple';
  return (
    <Dialog open onClose={onClose} maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700 }}>{q.id ? 'Edit question' : 'Add question'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              required
              label="Question"
              value={q.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="e.g. Are you available to start immediately?"
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Description"
              helperText="optional — extra context shown to candidates"
              value={q.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              select
              label="Answer type"
              value={q.type}
              onChange={(e) => { set('type', e.target.value); if (e.target.value === 'text' || e.target.value === 'paragraph') set('options', []); }}
            >
              {Object.entries(TYPE_LABELS).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          {choices && (
            <Grid size={12}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary', mb: 1 }}>Answer options</Typography>
              <Stack spacing={1}>
                {q.options.map((o, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <TextField
                      size="small"
                      value={o.value}
                      sx={{ width: 150 }}
                      slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, color: 'text.disabled' } } }}
                    />
                    <TextField
                      size="small"
                      value={o.label}
                      placeholder="Option label"
                      onChange={(e) => setOption(i, 'label', e.target.value)}
                    />
                    <IconButton size="small" onClick={() => set('options', q.options.filter((_, j) => j !== i))} color="inherit" title="Remove">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" variant="outlined" sx={{ mt: 1.25 }} onClick={() => set('options', [...q.options, { value: '', label: '' }])}>
                Add option
              </Button>
            </Grid>
          )}
          <Grid size={12}>
            <FormControlLabel control={<Checkbox checked={q.default_enabled} onChange={(e) => set('default_enabled', e.target.checked)} />} label="Apply to all jobs by default" />
          </Grid>
          <Grid size={12}>
            <FormControlLabel control={<Checkbox checked={q.default_required} onChange={(e) => set('default_required', e.target.checked)} />} label="Required by default" />
          </Grid>
        </Grid>
        {err && <Alert severity="error" sx={{ mt: 2, alignItems: 'center' }}>{err}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save question'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Screening() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteQ, setDeleteQ] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await api.screeningQuestions()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async () => {
    try { await api.deleteScreeningQuestion(deleteQ.id); setDeleteQ(null); await load(); } catch (e) { setError(e.message); }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.75, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Screening questions</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.5, maxWidth: 640 }}>
            Build a reusable question library. Each job lets you pick which questions apply, mark them required, and set the order.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAdding(true)}>Add question</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, alignItems: 'center' }}>{error}</Alert>}
      {loading && <Typography sx={{ color: 'text.secondary' }}>Loading…</Typography>}

      {!loading && items.length === 0 && (
        <Paper variant="outlined">
          <EmptyState title="No screening questions yet" message="Add a question and it'll show on the candidate portal apply form — on every job by default, or just the jobs you choose." />
        </Paper>
      )}

      <Stack spacing={1.5}>
        {items.map((q) => (
          <Paper variant="outlined" key={q.id} sx={{ p: 2.25 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{q.label}</Typography>
              <Stack direction="row" spacing={1}>
                <StatusChip status={q.default_enabled ? 'open' : 'closed'} />
                <ChipLabel label={q.default_enabled ? 'On by default' : 'Manual'} />
                {q.default_required && <ChipLabel label="Required" tone="warning" />}
              </Stack>
            </Stack>
            {q.description && <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.75 }}>{q.description}</Typography>}
            <Box sx={{ mt: 0.75 }}>
              <Pill>{TYPE_LABELS[q.type] || q.type}</Pill>
              {q.type === 'single' || q.type === 'multiple' ? q.options.map((o) => <Pill key={o.value}>{o.label}</Pill>) : null}
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => { setAdding(false); setEditing(q); }}>Edit</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => setDeleteQ(q)}>Delete</Button>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {adding && <QuestionForm initial={emptyQuestion()} onSave={async () => { setAdding(false); await load(); }} onClose={() => setAdding(false)} />}
      {editing && <QuestionForm initial={editing} onSave={async () => { setEditing(null); await load(); }} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleteQ}
        title="Delete this question?"
        message={`"${deleteQ?.label || ''}" will be removed from every job that uses it; past answers stay on file.`}
        onConfirm={remove}
        onClose={() => setDeleteQ(null)}
      />
    </Box>
  );
}

function ChipLabel({ label, tone }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 650,
        color: tone === 'warning' ? 'var(--mui-palette-warning-main)' : 'text.secondary',
        background: tone === 'warning'
          ? 'color-mix(in srgb, var(--mui-palette-warning-main) 12%, transparent)'
          : 'action.selected',
      }}
    >
      {label}
    </Box>
  );
}