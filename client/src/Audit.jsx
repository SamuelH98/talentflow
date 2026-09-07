import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { api } from './api.js';
import { EmptyState, Spinner, timeAgo } from './kit.jsx';

const ACTION_LABELS = {
  'auth.login': 'Sign-in',
  'candidate.create': 'Candidate added',
  'candidate.update': 'Candidate updated',
  'candidate.delete': 'Candidate deleted',
  'candidate.resume_download': 'Resume downloaded',
  'candidate.erasure': 'Candidate data erased (self-service)',
  'job.create': 'Job published',
  'job.update': 'Job updated',
  'job.delete': 'Job deleted',
  'application.create': 'Application created',
  'application.status': 'Stage changed',
};

function short(msg) {
  const cut = msg && msg.length > 64 ? `${msg.slice(0, 64)}…` : msg;
  return cut;
}

export default function Audit({ companyName }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setRows(await api.auditLog(100)); }
      catch (e) { setError(e.message); }
    })();
  }, []);

  if (error) return <Alert severity="error" sx={{ alignItems: 'center' }}>{error}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Activity log</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13.5, my: 0.75, mb: 2 }}>
        Recent recruiter actions within {companyName || 'your company'}. Immutable audit trail — candidate/self-service erasures are included.
      </Typography>

      {!rows ? (
        <Spinner label="Loading activity…" />
      ) : rows.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState icon={<HistoryIcon />} title="No activity recorded yet" message="Recruiter actions — sign-ins, candidates, jobs, and stage changes — will appear here." />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
              <TableHead>
                <TableRow>
                  {['When', 'Who', 'Action', 'Detail'].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.disabled', py: 1.25 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell title={r.created_at} sx={{ color: 'text.secondary', fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(r.created_at)}</TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{r.user_email || <Box component="span" sx={{ color: 'text.disabled', fontSize: 12.5 }}>system</Box>}</TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          px: 1.25,
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 650,
                          color: 'text.secondary',
                          background: 'action.selected',
                          border: '1px solid',
                          borderColor: 'divider',
                          py: 0.25,
                        }}
                      >
                        {ACTION_LABELS[r.action] || r.action}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{short(r.detail)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}