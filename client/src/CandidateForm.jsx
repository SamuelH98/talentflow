import React, { useState } from 'react';
import {
  Box,
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

const empty = {
  name: '',
  email: '',
  phone: '',
  location: '',
  title: '',
  summary: '',
  years_experience: 0,
  skills: [],
  experience: [],
  education: [],
  resume_text: '',
};

export default function CandidateForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...empty, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open onClose={onClose} maxWidth="md" scroll="paper">
      <DialogTitle sx={{ fontSize: 18, fontWeight: 700 }}>{initial?.id ? 'Edit candidate' : 'Add candidate'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField required label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Current / target title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Location" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Years of experience" type="number" slotProps={{ htmlInput: { min: 0, step: 0.5 } }} value={form.years_experience} onChange={(e) => set('years_experience', e.target.value)} />
          </Grid>
          <Grid size={12}>
            <TextField label="Summary" multiline minRows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          </Grid>
          <Grid size={12}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>Skills</Typography>
              <TagInput value={form.skills} onChange={(v) => set('skills', v)} />
            </Stack>
          </Grid>
          <Grid size={12}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>
                Work experience <Box component="span" sx={{ color: 'text.disabled', fontSize: 12, fontWeight: 400 }}>one item per line</Box>
              </Typography>
              <TagInput value={form.experience} onChange={(v) => set('experience', v)} />
            </Stack>
          </Grid>
          <Grid size={12}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, color: 'text.secondary' }}>Education</Typography>
              <TagInput value={form.education} onChange={(v) => set('education', v)} />
            </Stack>
          </Grid>
          <Grid size={12}>
            <TextField label="Resume / bio text" multiline minRows={3} helperText="optional, used for experience-matching" value={form.resume_text} onChange={(e) => set('resume_text', e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save candidate</Button>
      </DialogActions>
    </Dialog>
  );
}