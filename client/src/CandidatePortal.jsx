import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  ArrowBack as ArrowBackIcon,
  BusinessCenter as BusinessCenterIcon,
  CalendarMonth as CalendarMonthIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  FileDownload as FileDownloadIcon,
  FilterAlt as FilterAltIcon,
  Group as GroupIcon,
  LocationOn as LocationOnIcon,
  LockOutlined as LockOutlinedIcon,
  Search as SearchIcon,
  ShieldOutlined as ShieldOutlinedIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { api, formatSalary } from './api.js';
import { brandGradient, DEFAULT_BRAND } from './theme.js';
import { CompanyMark } from './kit.jsx';
import { EmptyState, PersonAvatar, Pill, Spinner, StatusChip, TagInput, timeAgo } from './kit.jsx';

const STAGE_ORDER = ['matched', 'in_review', 'interview', 'hired'];
const STAGE_SHORT = { matched: 'Submitted', in_review: 'In review', interview: 'Interview', hired: 'Offer' };
const STAGE_TEXT = { matched: 'Matched', in_review: 'In review', interview: 'Interview', hired: 'Hired', rejected: 'Closed' };

const soft = (tone) => `color-mix(in srgb, var(--mui-palette-${tone}-main) 10%, transparent)`;

function SectionHead({ icon, title, sub }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.75 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: soft('primary'), flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{title}</Typography>
        {sub && <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.25 }}>{sub}</Typography>}
      </Box>
    </Stack>
  );
}

function OptionCards({ options, value, multi = false, onChange, name }) {
  const sel = (o) => (multi ? (Array.isArray(value) || []).includes(o.value) : value === o.value);
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {options.map((o) => (
        <Box
          key={o.value}
          role="radio"
          aria-checked={sel(o)}
          onClick={() => onChange(o)}
          sx={{
            px: 1.75,
            py: 1,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: sel(o) ? 'primary.main' : 'divider',
            bgcolor: sel(o) ? soft('primary') : 'background.paper',
            cursor: 'pointer',
            fontWeight: 550,
            fontSize: 13.5,
            color: sel(o) ? 'primary.main' : 'text.primary',
            userSelect: 'none',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          {o.label}
        </Box>
      ))}
    </Stack>
  );
}

function ApplyModal({ job, onApply, onExisting, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', summary: '', skills: [], education: [], experience: [], years_experience: '2' });
  const [resumeText, setResumeText] = useState('');
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState('');
  const [parsing, setParsing] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [screening, setScreening] = useState({});
  const [consent, setConsent] = useState(false);
  const [privacy, setPrivacy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.publicQuestionnaire().then((q) => setQuestions(q)).catch(() => {});
    api.publicPrivacy().then((p) => setPrivacy(p)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const answer = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));
  const screeningAnswer = (id, value) => setScreening((s) => ({ ...s, [id]: value }));

  const toggleChoice = (id, value) => {
    setScreening((s) => {
      const cur = Array.isArray(s[id]) ? s[id] : [];
      return { ...s, [id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  };

  const isAnswered = (q) => {
    const v = screening[String(q.id)];
    if (q.type === 'multiple') return Array.isArray(v) && v.length > 0;
    if (q.type === 'single') return typeof v === 'string' && v.length > 0;
    return typeof v === 'string' && v.trim().length > 0;
  };

  const quick = () => {
    setForm((f) => ({
      ...f,
      name: 'Taylor Morgan',
      email: 'taylor.morgan@example.com',
      phone: '555-2244',
      location: 'Austin, TX',
      summary: 'Product-minded engineer who ships fast and loves learning new stacks.',
      skills: [...new Set([...(f.skills || []), ...(job.skills || []).slice(0, 3)])],
      years_experience: '4',
      education: ['B.S. Computer Science — UT Austin'],
      experience: ['Frontend Engineer — Brightwave, 2022–present', 'Junior Developer — Proto Labs, 2019–2022'],
    }));
  };

  const handleFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    setFileStatus('');
    setParsing(true);
    setErr('');
    try {
      const res = await api.resumeParse(f);
      if (!res.ok) throw new Error('parse failed');
      setResumeText(res.text || '');
      const fields = res.fields || {};
      const filled = [];
      const next = { ...form };
      if (fields.name && !next.name) { next.name = fields.name; filled.push('name'); }
      if (fields.email && !next.email) { next.email = fields.email; filled.push('email'); }
      if (fields.phone && !next.phone) { next.phone = fields.phone; filled.push('phone'); }
      if (fields.location && !next.location) { next.location = fields.location; filled.push('location'); }
      if (fields.years_experience != null) { next.years_experience = String(fields.years_experience); filled.push('experience'); }
      if (fields.skills && fields.skills.length) next.skills = [...new Set([...(next.skills || []), ...fields.skills])];
      if (fields.summary && !next.summary) { next.summary = fields.summary; filled.push('summary'); }
      setForm(next);
      setFileStatus(
        `Parsed ${res.filename} — ${filled.length} fields auto-filled` +
        (fields.skills && fields.skills.length ? `, ${fields.skills.length} skills detected` : '') +
        `. Review and edit below before submitting.`
      );
    } catch (ex) {
      setFileStatus('');
      setErr(ex.message || 'Could not parse that file');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const submit = async () => {
    setBusy(true); setErr('');
    const missing = (job.screening_questions || []).filter((q) => q.required && !isAnswered(q));
    if (missing.length) {
      setErr(`Please answer: ${missing.map((q) => q.label).join(' · ')}`);
      setBusy(false);
      return;
    }
    if (!consent) {
      setErr('Please agree to the privacy notice before submitting your application.');
      setBusy(false);
      return;
    }
    const fd = new FormData();
    fd.append('job_id', String(job.id));
    for (const k of ['name', 'email', 'phone', 'location', 'summary', 'years_experience']) fd.append(k, String(form[k] ?? ''));
    fd.append('skills', JSON.stringify(form.skills || []));
    fd.append('education', JSON.stringify(form.education || []));
    fd.append('experience', JSON.stringify(form.experience || []));
    if (consent) fd.append('consent', 'true');
    if (resumeText.trim()) fd.append('resume_text', resumeText);
    if (file) fd.append('resume', file, file.name);
    const q = {};
    for (const [k, v] of Object.entries(answers)) if (v) q[k] = v;
    if (Object.keys(q).length) fd.append('questionnaire', JSON.stringify(q));
    const scr = {};
    for (const [k, v] of Object.entries(screening)) if (v && (!Array.isArray(v) || v.length > 0)) scr[k] = v;
    if (Object.keys(scr).length) fd.append('screening', JSON.stringify(scr));
    try {
      await onApply({ formData: fd, name: form.name });
    } catch (e) {
      if (e && e.status === 409 && e.data && e.data.tracking_token && onExisting) {
        onExisting(e.data.tracking_token);
        return;
      }
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Apply — {job.title}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{job.department || 'General'}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" color="inherit">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Alert
          severity="info"
          variant="outlined"
          icon={<AccessTimeIcon sx={{ color: 'var(--mui-palette-info-main)' }} />}
          action={<Button size="small" color="inherit" onClick={quick}>Try a sample profile</Button>}
          sx={{ mb: 2.5, alignItems: 'center', borderRadius: 2.5 }}
        >
          Takes ~2 minutes. Upload your resume to auto-fill the rest.
        </Alert>

        {err && <Alert severity="error" sx={{ mb: 2.5, alignItems: 'center', borderRadius: 2.5 }}>{err}</Alert>}

        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 0.75 }}>Resume <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>(optional · .pdf, .docx, .txt)</Box></Typography>
            <Box
              component="label"
              htmlFor="portal-resume-input"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                border: '1.5px dashed',
                borderColor: file ? 'success.main' : 'divider',
                borderRadius: 2.5,
                px: 2,
                py: 2.25,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <input type="file" accept=".pdf,.docx,.txt" onChange={handleFile} hidden id="portal-resume-input" />
              {parsing ? (
                <>
                  <CircularProgress size={20} thickness={5} />
                  <Box sx={{ fontSize: 13.5, fontWeight: 600 }}>Parsing your resume…</Box>
                </>
              ) : file ? (
                <>
                  <CheckIcon sx={{ color: 'success.main' }} />
                  <Box>
                    <Box sx={{ fontSize: 13.5, fontWeight: 650 }}>{file.name}</Box>
                    <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>{fileStatus || 'Resume attached'}</Typography>
                  </Box>
                </>
              ) : (
                <>
                  <UploadIcon sx={{ color: 'text.secondary' }} />
                  <Box>
                    <Box sx={{ fontSize: 13.5, fontWeight: 600 }}>Choose a file or drag it here</Box>
                    <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>We&apos;ll read it on your computer using local parsing — nothing is uploaded to a cloud service.</Typography>
                  </Box>
                </>
              )}
            </Box>
            {fileStatus && !parsing && (
              <Typography sx={{ color: 'success.main', fontSize: 12.5, mt: 0.75 }}>
                <CheckIcon sx={{ fontSize: 13, verticalAlign: -2 }} /> {fileStatus.split('.')[0]}.
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField required fullWidth label="Full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField required fullWidth type="email" label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Location" placeholder="City, State" value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Years of experience"
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              value={form.years_experience}
              onChange={(e) => set('years_experience', e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 0.75 }}>Skills</Typography>
            <TagInput value={form.skills} onChange={(v) => set('skills', v)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 0.75 }}>
              Work experience <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>one item per line</Box>
            </Typography>
            <TagInput value={form.experience} onChange={(v) => set('experience', v)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 0.75 }}>Education</Typography>
            <TagInput value={form.education} onChange={(v) => set('education', v)} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline label="Short summary" minRows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          </Grid>
        </Grid>

        {(job.screening_questions || []).length > 0 && (
          <Box sx={{ mt: 3.5 }}>
            <SectionHead icon={<FilterAltIcon fontSize="small" />} title="Before you apply" sub="Answer these screening questions as completely as you can — the team reviews them with your application." />
            <Stack spacing={2.5}>
              {job.screening_questions.map((q) => {
                const id = String(q.id);
                const val = screening[id];
                return (
                  <Box key={q.id}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 650, mb: 0.75 }}>
                      {q.label} {q.required && <Box component="span" sx={{ color: 'error.main' }}>*</Box>}
                    </Typography>
                    {q.description && <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mb: 0.75 }}>{q.description}</Typography>}
                    {q.type === 'paragraph' && (
                      <TextField fullWidth multiline minRows={3} value={val || ''} onChange={(e) => screeningAnswer(id, e.target.value)} />
                    )}
                    {q.type === 'single' && <OptionCards options={q.options} value={val} onChange={(o) => screeningAnswer(id, o.value)} />}
                    {q.type === 'multiple' && <OptionCards options={q.options} value={val} multi onChange={(o) => toggleChoice(id, o.value)} />}
                    {q.type === 'text' && <TextField fullWidth value={val || ''} onChange={(e) => screeningAnswer(id, e.target.value)} />}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        <Box sx={{ mt: 3.5 }}>
          <SectionHead icon={<LockOutlinedIcon fontSize="small" />} title="Voluntary self-identification" sub="Optional — used only for equal employment opportunity reporting, never for hiring decisions." />
          {questions && (
            <Stack spacing={2.5}>
              {questions.questions.map((q) => (
                <Box key={q.key}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>{q.title}</Typography>
                  {q.sub && <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.25 }}>{q.sub}</Typography>}
                  <Box sx={{ mt: 1 }}>
                    <OptionCards options={q.options} value={answers[q.key]} onChange={(o) => answer(q.key, o.value)} />
                  </Box>
                  {q.type === 'single-detail' && q.options.some((o) => o.detail && answers[q.key] === o.value) && (
                    <TextField
                      fullWidth
                      placeholder="How would you describe yourself?"
                      value={answers[q.detailField] || ''}
                      onChange={(e) => answer(q.detailField, e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  )}
                  {q.disclosure && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12.5, color: 'var(--mui-palette-primary-main)' }}>Why we ask?</summary>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>{q.disclosure}</Typography>
                    </details>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Box sx={{ mt: 3.5 }}>
          <SectionHead
            icon={<ShieldOutlinedIcon fontSize="small" />}
            title="Privacy notice & consent"
            sub={`Policy v${privacy?.policy_version || '2026-09-01'} · updated ${privacy?.policy_version ? new Date(privacy.policy_version + 'T00:00:00Z').toLocaleDateString() : 'recently'}`}
          />
          <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.55, mb: 1.25 }}>
            {privacy?.notice || 'We store the details you provide to evaluate your application and keep them only for our hiring team. You can request a copy or deletion of your data at any time from the tracking page.'}
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            label="I have read the privacy notice and consent to my data being stored and processed for this application."
            sx={{ alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 13.5 } }}
          />
          <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.5 }}>
            I can change my mind and ask to <b>export or delete my data</b> at any time using &quot;Manage my data&quot; on the tracking page.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !form.name || !form.email || !consent}>
          {busy ? 'Submitting…' : 'Submit application'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SuccessView({ applied, onDone }) {
  const link = `${window.location.origin}${window.location.pathname}#/portal/status/${applied.tracking_token}`;
  return (
    <Paper variant="outlined" sx={{ maxWidth: 560, mx: 'auto', mt: 5, p: 3.5, textAlign: 'center' }}>
      <Box sx={{ width: 64, height: 64, borderRadius: 4, mx: 'auto', mb: 1.75, display: 'grid', placeItems: 'center', color: 'success.main', bgcolor: soft('success') }}>
        <CheckCircleIcon sx={{ fontSize: 32 }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>Application submitted</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 1, maxWidth: 380, mx: 'auto' }}>
        Thanks, {applied.name}. Your application for <b style={{ color: 'var(--mui-palette-text-primary)' }}>{applied.job?.title}</b> has been received — we&apos;ll review it shortly.
      </Typography>
      <Paper variant="outlined" sx={{ mt: 2.5, px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 13.5 }}>Status</Typography>
        <StatusChip status="matched" />
      </Paper>
      <Box sx={{ textAlign: 'left', mt: 2.25 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 650, mb: 0.75 }}>Save your tracking link to check status</Typography>
        <Stack direction="row" spacing={1}>
          <Box
            sx={{
              flex: 1,
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              fontSize: 12.5,
              py: 1.25,
              px: 1.5,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {link}
          </Box>
          <Button variant="outlined" size="small" onClick={() => { navigator.clipboard?.writeText(link); }} startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}>
            Copy
          </Button>
        </Stack>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={() => onDone(applied.tracking_token)}>Track my application</Button>
        <Button onClick={() => onDone(null)}>Browse more jobs</Button>
      </Stack>
    </Paper>
  );
}

function StatusTracker({ status, lastUpdated }) {
  const idx = STAGE_ORDER.indexOf(status);
  const rejected = status === 'rejected';
  return (
    <Box>
      <Stepper activeStep={rejected ? -1 : idx} sx={{ '& .MuiStepLabel-label': { fontSize: 12.5, mt: 0.5 } }}>
        {STAGE_ORDER.map((s, i) => (
          <Step key={s} completed={!rejected && idx > i}>
            <StepLabel>{STAGE_SHORT[s]}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 2 }}>
        {rejected
          ? 'This application was closed. You can view other open roles at any time.'
          : `Status: ${STAGE_TEXT[status] || status}. Last updated ${timeAgo(lastUpdated)} — we'll keep this page fresh as your application moves forward.`}
      </Typography>
    </Box>
  );
}

function BreakdownRow({ label, children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        py: 1.25,
        '&:not(:last-child)': { borderBottom: '1px solid', borderBottomColor: 'divider' },
      }}
    >
      <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>{label}</Typography>
      <Box sx={{ color: 'text.secondary', fontSize: 13 }}>{children}</Box>
    </Box>
  );
}

function ManageMyData({ initialEmail, onBackToTrack }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [exported, setExported] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const exportData = async () => {
    setBusy(true); setErr(''); setDone('');
    try {
      setExported(await api.publicExport(email));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!exported) return;
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talentflow-data-${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const erase = async () => {
    setBusy(true); setErr(''); setDone('');
    try {
      if (!exported?.erasure_token) throw new Error('Export your data first to receive an erasure token.');
      const res = await api.publicErasure(email, exported.erasure_token);
      setDone(res.message || 'Your data has been deleted.');
      setExported(null);
      setConfirmDelete(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 750, fontSize: 20 }}>Manage my data</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
            Your privacy matters. Export a copy of everything we store about you, or delete your data and applications entirely.
          </Typography>
        </Box>
        {onBackToTrack && (
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />} onClick={onBackToTrack}>Back</Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
        <TextField fullWidth type="email" label="Email you applied with" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button variant="outlined" disabled={busy || !email} onClick={exportData} sx={{ minWidth: 150, height: 56, flexShrink: 0 }}>
          {busy ? 'Working…' : 'Export my data'}
        </Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mt: 1.5, alignItems: 'center' }}>{err}</Alert>}
      {done && <Alert severity="success" sx={{ mt: 1.5, alignItems: 'center' }}>{done}</Alert>}

      {exported && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
            We found the following <b>{(exported.applications || []).length}</b> application{(exported.applications || []).length === 1 ? '' : 's'} on record for <b style={{ color: 'var(--mui-palette-text-primary)' }}>{email}</b>:
          </Typography>
          <Paper variant="outlined" sx={{ px: 2, py: 0.75 }}>
            {(exported.applications || []).map((a, i) => (
              <BreakdownRow key={i} label={a.job || `Application #${i + 1}`}>{a.status}</BreakdownRow>
            ))}
            <BreakdownRow label="Consent">
              v{exported.policy_version} · {exported.applications?.[0]?.consent?.consented_at ? `${timeAgo(exported.applications[0].consent.consented_at)}` : 'recorded'}
            </BreakdownRow>
            <BreakdownRow label="Uploaded resume">{exported.candidate?.resume_filename || 'None'}</BreakdownRow>
          </Paper>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
            <Button startIcon={<FileDownloadIcon sx={{ fontSize: 15 }} />} onClick={download} sx={{ justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              Download my data (JSON)
            </Button>
            {!confirmDelete ? (
              <Button variant="outlined" color="error" startIcon={<DeleteIcon sx={{ fontSize: 15 }} />} onClick={() => setConfirmDelete(true)}>
                Delete my data
              </Button>
            ) : (
              <Button variant="contained" color="error" disabled={busy} startIcon={<DeleteIcon sx={{ fontSize: 15 }} />} onClick={erase}>
                Confirm permanent deletion
              </Button>
            )}
          </Stack>
          {confirmDelete && (
            <Alert severity="error" sx={{ mt: 1.5, alignItems: 'center' }}>
              This permanently deletes {email}&apos;s profile, applications, answers, and uploaded resume. This cannot be undone. Click again to confirm.
            </Alert>
          )}
          <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 1.5 }}>
            The erasure token is your private application tracking link — it proves you are the owner of this data, so no one can delete by email alone.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function TrackCard({ job, candidate, status, lastUpdated, appliedAt, size = 'md' }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <PersonAvatar name={candidate?.name} size={size} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: size === 'lg' ? 18 : 15.5, lineHeight: 1.25 }}>{job?.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{job?.department}{appliedAt ? ` · ${timeAgo(appliedAt)}` : ''}</Typography>
        </Box>
        <StatusChip status={status} />
      </Box>
      <Box sx={{ p: 2.25, pt: 1.75 }}>
        <StatusTracker status={status} lastUpdated={lastUpdated} />
      </Box>
    </Paper>
  );
}

function TrackByIdentity({ onManage }) {
  const [email, setEmail] = useState('');
  const [apps, setApps] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await api.publicLookup(email);
      setApps(res);
      if (res.length === 0) setErr('No applications found for that email address.');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 680 }}>
      <Paper variant="outlined" sx={{ p: 2.75 }}>
        <Typography variant="h5" sx={{ fontWeight: 750, fontSize: 20 }}>Check your applications</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5, mb: 1.75 }}>Enter the email you applied with to see every application and its current stage.</Typography>
        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1} onSubmit={lookup}>
          <TextField fullWidth type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" disabled={busy || !email} sx={{ minWidth: 130, height: 56, flexShrink: 0 }}>{busy ? 'Checking…' : 'Look up'}</Button>
        </Stack>
        {err && <Alert severity="error" sx={{ mt: 1.5, alignItems: 'center' }}>{err}</Alert>}
      </Paper>
      {apps && apps.map((a) => (
        <TrackCard key={a.tracking_token} job={a.job} candidate={a.candidate} status={a.status} lastUpdated={a.last_updated} />
      ))}
      <Paper variant="outlined" sx={{ p: 2.75 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>You applied, now it&apos;s your data</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5, mb: 1.5 }}>
          Get a full copy of the data we hold, or ask us to delete it — GDPR-style rights, no forms needed.
        </Typography>
        <Button variant="outlined" startIcon={<ShieldOutlinedIcon sx={{ fontSize: 15 }} />} onClick={() => onManage(email)}>
          Manage my data
        </Button>
      </Paper>
    </Stack>
  );
}

function TrackByToken({ token, onManage }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try { setData(await api.publicStatus(token)); }
      catch (e) { setErr(e.message); }
    })();
  }, [token]);
  if (err) {
    return (
      <Paper variant="outlined" sx={{ maxWidth: 560, mx: 'auto' }}>
        <EmptyState icon={<ShieldOutlinedIcon />} title="Application not found" message={err} />
      </Paper>
    );
  }
  if (!data) return <Spinner label="Loading your application…" />;
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 800 }}>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, pb: 1.75, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <PersonAvatar name={data.candidate?.name} size="lg" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{data.job?.title}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mt: 0.25 }}>{data.job?.department} · {data.job?.location}</Typography>
          </Box>
          <StatusChip status={data.status} />
        </Box>
        <Box sx={{ p: 2.5 }}>
          <StatusTracker status={data.status} lastUpdated={data.last_updated} />
          <Grid container spacing={1.5} sx={{ mt: 1 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <MetaCell label="Applied" value={timeAgo(data.applied_at)} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <MetaCell label="Department" value={data.job?.department || '—'} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <MetaCell label="Location" value={data.job?.location || '—'} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <MetaCell label={data.status === 'rejected' ? 'Outcome' : 'Next step'} value={data.status === 'rejected' ? 'Not selected at this time' : 'A recruiter will reach out with next steps'} />
            </Grid>
          </Grid>
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.75 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>You applied, now it&apos;s your data</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.5, mb: 1.5 }}>
          Get a full copy of the data we hold, or ask us to delete it — no forms needed.
        </Typography>
        <Button variant="outlined" startIcon={<ShieldOutlinedIcon sx={{ fontSize: 15 }} />} onClick={() => onManage(data.candidate?.email)}>
          Manage my data
        </Button>
      </Paper>
    </Stack>
  );
}

function MetaCell({ label, value }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.disabled' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 600, mt: 0.5, lineHeight: 1.3 }}>{value}</Typography>
    </Box>
  );
}

function JobGrid({ jobs, search, onApply }) {
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.title, j.department, j.location, ...(j.skills || [])]
        .filter(Boolean)
        .some((t) => t.toLowerCase().includes(q))
    );
  }, [jobs, q]);

  if (jobs.length === 0) {
    return <EmptyState icon={<BusinessCenterIcon />} title="No open roles right now" message="Check back soon — new roles are added regularly." />;
  }
  if (filtered.length === 0) {
    return <EmptyState icon={<SearchIcon />} title="No matches for that search" message="Try a different keyword, skill, or location." />;
  }
  return (
    <Grid container spacing={2.5}>
      {filtered.map((j) => (
        <Grid key={j.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography sx={{ fontWeight: 750, fontSize: 17, lineHeight: 1.3 }}>{j.title}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em' }}>{j.department || 'General'}</Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: 13.5,
                mt: 1.25,
                mb: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: 40,
              }}
            >
              {j.description || 'Join the team and help us build great products.'}
            </Typography>
            <Stack direction="row" spacing={1.75} sx={{ flexWrap: 'wrap', gapY: 0.5, mb: 1.5, color: 'text.secondary', fontSize: 12.5 }}>
              {j.location && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 14 }} /> {j.location}
                </Box>
              )}
              {j.years_required > 0 && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 14 }} /> {j.years_required}+ yrs
                </Box>
              )}
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <GroupIcon sx={{ fontSize: 14 }} /> {(j.skills || []).length} skills
              </Box>
            </Stack>
            <Box sx={{ flexWrap: 'wrap' }}>
              {(j.skills || []).slice(0, 5).map((s) => <Pill key={s}>{s}</Pill>)}
            </Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1.75, borderTop: '1px solid', borderColor: 'divider', flex: 1, alignSelf: 'flex-end', width: '100%' }}>
              <Button onClick={() => onApply(j)}>Apply now</Button>
              {formatSalary(j.min_salary, j.max_salary) && (
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: 'var(--mui-palette-primary-main)' }}>{formatSalary(j.min_salary, j.max_salary)}</Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function CompanyBrand({ company, brand }) {
  const name = company?.name || 'TalentFlow';
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
      <CompanyMark company={company} brand={brand} />
      <Box sx={{ lineHeight: 1.1 }}>
        <Box sx={{ fontWeight: 750, fontSize: 16 }}>{name}</Box>
        <Typography sx={{ color: 'text.disabled', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Careers</Typography>
      </Box>
    </Stack>
  );
}

function PortalTopBar({ company, brand, onBack, showJobsBack, onJobsBack }) {
  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 20, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2.5, md: 3.5 }, height: 64, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CompanyBrand company={company} brand={brand} />
        <Box sx={{ flex: 1 }} />
        {showJobsBack && (
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />} onClick={onJobsBack} sx={{ color: '#ffffff' }}>
            Back to open jobs
          </Button>
        )}
        {onBack && (
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />} onClick={onBack} sx={{ color: '#ffffff' }}>
            Back to recruiter dashboard
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default function CandidatePortal({ authed, onBack }) {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [companyName, setCompanyName] = useState(null);
  const [companyBrand, setCompanyBrand] = useState(null);
  const [company, setCompany] = useState(null);
  const [search, setSearch] = useState('');
  const [applyJob, setApplyJob] = useState(null);
  const [result, setResult] = useState(null);
  const [statusToken, setStatusToken] = useState(() => {
    const h = window.location.hash.split('/');
    return h.length >= 4 && h[1] === 'portal' && h[2] === 'status' ? h[3] : null;
  });
  const [manageEmail, setManageEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setJobs(await api.publicJobs()); }
      catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const c = await api.publicCompany(); setCompany(c); setCompanyName(c.name); setCompanyBrand(c.brand_color || DEFAULT_BRAND); }
      catch { /* fall back to TalentFlow brand */ }
    })();
  }, []);

  useEffect(() => {
    if (statusToken) window.location.hash = `/portal/status/${statusToken}`;
  }, [statusToken]);

  const apply = async ({ formData, name }) => {
    const res = await api.publicApply(formData);
    setResult({ ...res, name });
    setApplyJob(null);
  };

  const existingApplication = (token) => {
    setApplyJob(null);
    setResult(null);
    setTab('track');
    setStatusToken(token);
  };

  const handleTab = (t) => {
    setTab(t);
    if (t === 'jobs') window.location.hash = '/portal';
    else if (t === 'track') window.location.hash = '/portal/track';
  };

  const content = statusToken ? (
    <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', px: { xs: 2.5, md: 3.5 }, py: 4 }}>
      {manageEmail ? (
        <ManageMyData initialEmail={manageEmail} onBackToTrack={() => setManageEmail(null)} />
      ) : (
        <TrackByToken token={statusToken} onManage={setManageEmail} />
      )}
    </Box>
  ) : (
    <Box sx={{ maxWidth: 1080, mx: 'auto', width: '100%', px: { xs: 2.5, md: 3.5 }, pb: 5 }}>
      <Box sx={{ py: { xs: 4, md: 5 }, textAlign: 'center' }}>
        <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 28, md: 36 }, letterSpacing: '-0.03em' }}>
          {jobs.length} open roles
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 15, mt: 1, maxWidth: 480, mx: 'auto' }}>
          Find a role that fits you — apply in under a minute and track your application in real time.
        </Typography>
        {tab === 'jobs' && (
          <Box sx={{ maxWidth: 480, mx: 'auto', mt: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by title, skill, or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled' }} /></InputAdornment> } }}
            />
          </Box>
        )}
      </Box>

      <Paper variant="outlined" sx={{ display: 'inline-flex', p: 0.5, gap: 0.5, borderRadius: 3, mb: 3, bgcolor: 'background.paper' }}>
        <Button
          size="small"
          startIcon={<BusinessCenterIcon sx={{ fontSize: 16 }} />}
          onClick={() => handleTab('jobs')}
          variant={tab === 'jobs' ? 'contained' : 'text'}
          color={tab === 'jobs' ? 'primary' : 'inherit'}
          sx={{ borderRadius: 2.5, px: 2, color: tab === 'jobs' ? undefined : 'text.secondary', fontWeight: 600 }}
        >
          Browse jobs
        </Button>
        <Button
          size="small"
          startIcon={<CalendarMonthIcon sx={{ fontSize: 16 }} />}
          onClick={() => handleTab('track')}
          variant={tab === 'track' ? 'contained' : 'text'}
          color={tab === 'track' ? 'primary' : 'inherit'}
          sx={{ borderRadius: 2.5, px: 2, color: tab === 'track' ? undefined : 'text.secondary', fontWeight: 600 }}
        >
          Track application
        </Button>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2.5, alignItems: 'center' }}>{error}</Alert>}

      {tab === 'jobs' && (
        <>
          {loading ? <Spinner label="Loading open roles…" /> : <JobGrid jobs={jobs} search={search} onApply={setApplyJob} />}
          {!loading && jobs.length > 0 && (
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mt: 3, textAlign: 'center' }}>
              Apply to any role with just your name, email, and a couple of details. No account needed.
            </Typography>
          )}
        </>
      )}

      {tab === 'track' && (manageEmail
        ? <ManageMyData initialEmail={manageEmail} onBackToTrack={() => setManageEmail(null)} />
        : <TrackByIdentity onManage={(email) => setManageEmail(email)} />)}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <PortalTopBar
        company={company}
        brand={companyBrand}
        onBack={onBack}
        showJobsBack={!!statusToken}
        onJobsBack={() => { setStatusToken(null); setTab('jobs'); window.location.hash = '/portal'; }}
      />
      <Box sx={{ flex: 1 }}>
        {content}
        {!statusToken && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', py: 2.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Powered by TalentFlow — a local-first hiring workspace.</Typography>
            <Typography sx={{ color: 'text.disabled', fontSize: 12 }}>Your data never leaves this computer.</Typography>
          </Box>
        )}
      </Box>

      {applyJob && <ApplyModal job={applyJob} onApply={apply} onExisting={existingApplication} onClose={() => setApplyJob(null)} />}
      {result && <SuccessView applied={result} onDone={(token) => { setResult(null); if (token) { setStatusToken(token); setTab('track'); } }} />}
    </Box>
  );
}