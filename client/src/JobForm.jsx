import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TagInput } from './kit.jsx';

export const emptyJob = {
  title: '',
  department: '',
  location: '',
  description: '',
  requirements: [],
  skills: [],
  years_required: 0,
  min_salary: null,
  max_salary: null,
};

export default function JobForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...emptyJob, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open onClose={onClose} maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700 }}>{initial?.id ? 'Edit job' : 'Add job'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField required label="Job title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Department" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Location" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Years experience required" type="number" slotProps={{ htmlInput: { min: 0, step: 0.5 } }} value={form.years_required} onChange={(e) => set('years_required', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Min salary (USD)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={form.min_salary || ''} onChange={(e) => set('min_salary', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Max salary (USD)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={form.max_salary || ''} onChange={(e) => set('max_salary', e.target.value)} />
          </Grid>
          <Grid size={12}>
            <TextField label="Description" multiline minRows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Grid>
          <Grid size={12}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>Required skills</Typography>
              <TagInput value={form.skills} onChange={(v) => set('skills', v)} />
            </Stack>
          </Grid>
          <Grid size={12}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>
                Requirements <Box component="span" sx={{ color: 'text.disabled', fontSize: 12, fontWeight: 400 }}>short phrases, used for experience-matching</Box>
              </Typography>
              <TagInput value={form.requirements} onChange={(v) => set('requirements', v)} />
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save job</Button>
      </DialogActions>
    </Dialog>
  );
}