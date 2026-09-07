import React from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Stack, Typography } from '@mui/material';
import { Close, Delete as DeleteIcon, Inbox as InboxIcon, WarningAmber } from '@mui/icons-material';
import { brandGradient, displayOnBrand } from './theme.js';

export function CompanyMark({ company, brand, size = 32, rounded = 2.5, boxShadow = '0 1px 3px rgba(16, 24, 40, 0.12)', logoSrc, pad = 0.5, w, blurBg, fit = 'contain' }) {
  const name = company?.name || 'TalentFlow';
  const logo = logoSrc || (company?.logo_path ? `/api/company/logo?v=${encodeURIComponent(company.logo_path)}` : null);
  if (logo) {
    const img = (
      <Box
        component="img"
        src={logo}
        alt={`${name} logo`}
        sx={{
          width: w ?? size,
          height: size,
          objectFit: fit,
          flexShrink: 0,
        }}
      />
    );
    if (blurBg) {
      return (
        <Stack
          direction="row"
          sx={{ position: 'relative', alignItems: 'center', justifyContent: 'center', px: 0.5, flexShrink: 0, width: 'fit-content' }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: Math.max(w ?? size, size) + 24,
              height: size - 6,
              borderRadius: 3.5,
              bgcolor: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {React.cloneElement(img, { sx: { ...img.props.sx, position: 'relative', zIndex: 1 } })}
        </Stack>
      );
    }
    return img;
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: rounded,
        display: 'grid',
        placeItems: 'center',
        color: displayOnBrand(brand),
        background: brandGradient(brand),
        fontWeight: 800,
        fontSize: Math.max(10, size * 0.44),
        boxShadow,
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </Box>
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const t = new Date(String(dateStr).includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const TONES = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #64748b, #475569)',
  'linear-gradient(135deg, #8b5cf6, #d946ef)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
];

export function toneFor(str, seedNum) {
  if (seedNum != null && seedNum !== '' && !Number.isNaN(Number(seedNum))) return TONES[Number(seedNum) % TONES.length];
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return TONES[h % TONES.length];
}

export function PersonAvatar({ name, seed, size = 'md', ...rest }) {
  const px = size === 'sm' ? 30 : size === 'lg' ? 48 : 38;
  const fs = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return (
    <Avatar
      sx={{
        width: px,
        height: px,
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: toneFor(name, seed),
      }}
      {...rest}
    >
      {initials(name)}
    </Avatar>
  );
}

const STATUS_META = {
  active: { color: 'success', label: 'Active' },
  archived: { color: 'default', label: 'Archived' },
  open: { color: 'success', label: 'Open' },
  closed: { color: 'default', label: 'Closed' },
  matched: { color: 'default', label: 'Matched' },
  in_review: { color: 'warning', label: 'In review' },
  interview: { color: 'primary', label: 'Interview' },
  hired: { color: 'success', label: 'Hired' },
  rejected: { color: 'error', label: 'Rejected' },
};

export const PIPELINE_STAGES = [
  { key: 'matched', label: 'Candidates', color: 'default' },
  { key: 'in_review', label: 'Reached out', color: 'warning' },
  { key: 'interview', label: 'Interviewing', color: 'primary' },
  { key: 'hired', label: 'Hired', color: 'success' },
  { key: 'rejected', label: 'Rejected', color: 'error' },
];

export function stageLabel(status) {
  return STATUS_META[status]?.label || String(status || '');
}

export function StageChip({ status }) {
  const meta = STATUS_META[status] || { color: 'default', label: status };
  return (
    <Chip
      size="small"
      color={meta.color}
      label={stageLabel(status)}
      sx={{
        height: 22,
        borderRadius: '999px',
        fontWeight: 650,
        fontSize: 12,
        '& .MuiChip-label': { px: 1, py: 0 },
        ...(meta.color === 'default' && { bgcolor: 'action.selected', color: 'text.secondary' }),
      }}
    />
  );
}

export function StatusChip({ status }) {
  const meta = STATUS_META[status] || { color: 'default', label: status };
  return (
    <Chip
      size="small"
      color={meta.color}
      label={meta.label}
      sx={{
        height: 22,
        borderRadius: '999px',
        fontWeight: 650,
        fontSize: 12,
        '& .MuiChip-label': { px: 1, py: 0 },
        ...(meta.color === 'default' && {
          bgcolor: 'action.selected',
          color: 'text.secondary',
        }),
      }}
    />
  );
}

export function Pill({ children }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={children}
      sx={{
        m: 0.25,
        borderRadius: 7,
        height: 'auto',
        py: 0.15,
        px: 0.5,
        fontSize: 12,
        fontWeight: 550,
        color: 'text.secondary',
        borderColor: 'divider',
        '& .MuiChip-label': { p: '1px 4px' },
      }}
    />
  );
}

export function TagInput({ value = [], onChange, placeholder = 'Type & press Enter' }) {
  const inputRef = React.useRef(null);
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        py: 0.5,
        px: 1,
        minHeight: 40,
        cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((s) => (
        <Chip
          key={s}
          size="small"
          label={s}
          onDelete={() => onChange(value.filter((x) => x !== s))}
          deleteIcon={<Close fontSize="small" />}
          sx={{
            bgcolor: 'action.selected',
            color: 'primary.main',
            fontWeight: 600,
            borderRadius: 7,
            height: 26,
            '& .MuiChip-deleteIcon': { fontSize: 15, color: 'primary.main' },
          }}
        />
      ))}
      <input
        ref={inputRef}
        style={{
          border: 'none',
          outline: 'none',
          flex: 1,
          minWidth: 130,
          padding: 4,
          font: 'inherit',
          background: 'transparent',
          color: 'inherit',
        }}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const v = e.target.value.trim();
            if (v && !value.includes(v)) onChange([...value, v]);
            e.target.value = '';
          }
        }}
      />
    </Box>
  );
}

export function ConfirmDialog({ open, title = 'Confirm', message = '', confirmLabel = 'Delete', onConfirm, onClose, danger = true }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs">
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
        <Button size="small" color="inherit" onClick={onClose} sx={{ minWidth: 0, borderRadius: 2 }} aria-label="Close">
          <Close fontSize="small" />
        </Button>
      </Box>
      <DialogTitle sx={{ py: 0, fontSize: 18, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 13.5 }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          color={danger ? 'error' : 'primary'}
          startIcon={<DeleteIcon fontSize="small" />}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EmptyState({ icon = <InboxIcon />, title = 'Nothing here yet', message = '', action }) {
  return (
    <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 7, px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 4, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', display: 'grid', placeItems: 'center', color: 'text.disabled', mb: 1 }}>
        {icon}
      </Box>
      <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      {message && <Typography sx={{ fontSize: 13.5, maxWidth: 340 }}>{message}</Typography>}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <CircularProgress size={30} thickness={4} />
      {label && <Typography sx={{ fontSize: 13 }}>{label}</Typography>}
    </Box>
  );
}

export function ScoreCircle({ score }) {
  const bg = score >= 70 ? 'linear-gradient(135deg, #22c55e, #159a4d)' : score >= 40 ? 'linear-gradient(135deg, #fbbf24, #d97706)' : 'linear-gradient(135deg, #94a3b8, #64748b)';
  return (
    <Box
      sx={{
        width: 46,
        height: 46,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 750,
        fontSize: 14,
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.2)',
      }}
    >
      {score}
    </Box>
  );
}

export function BreakdownBars({ b }) {
  if (!b) return null;
  const rows = [
    { label: 'Skills', val: b.skillScore },
    { label: 'Experience', val: b.expScore },
    { label: 'Years', val: b.yearsScore },
  ];
  return (
    <Box sx={{ mt: 1.5 }}>
      {rows.map((r) => (
        <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.1, fontSize: 13 }}>
          <Box sx={{ width: 96, fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}>{r.label}</Box>
          <LinearProgress variant="determinate" value={r.val} sx={{ flex: 1 }} />
          <Box sx={{ width: 34, fontWeight: 700, textAlign: 'right', color: 'text.primary' }}>{r.val}</Box>
        </Box>
      ))}
    </Box>
  );
}

export function ErrorBanner({ children, ...rest }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        borderRadius: 3,
        bgcolor: 'error.main',
        color: '#fff',
        px: 2,
        py: 1.5,
        mb: 3,
        fontSize: 13.5,
        ...(rest.sx || {}),
      }}
    >
      <WarningAmber fontSize="small" />
      {children}
    </Box>
  );
}